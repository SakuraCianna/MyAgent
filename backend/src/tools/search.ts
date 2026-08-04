// search 工具：优先走 Tavily API，没有 API Key 时降级为本地 mock
import { registerTool } from "./registry.js";

interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

interface TavilyResponse {
  results: TavilyResult[];
  answer?: string;
}

async function searchViaTavily(query: string): Promise<{
  source: "tavily";
  answer?: string;
  results: Array<{ title: string; url: string; snippet: string }>;
}> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("未配置 TAVILY_API_KEY");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: 5,
      include_answer: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Tavily API 返回错误状态 ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as TavilyResponse;
  return {
    source: "tavily",
    answer: data.answer,
    results: (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content?.slice(0, 300) ?? "",
    })),
  };
}

function searchViaMock(query: string): {
  source: "mock";
  results: Array<{ title: string; url: string; snippet: string }>;
} {
  return {
    source: "mock",
    results: [
      {
        title: `关于"${query}"的模拟搜索结果 1`,
        url: "https://example.com/mock-result-1",
        snippet: `这是一条本地 mock 搜索结果，用于在没有配置 TAVILY_API_KEY 时演示 search 工具的调用流程。查询词: ${query}`,
      },
      {
        title: `关于"${query}"的模拟搜索结果 2`,
        url: "https://example.com/mock-result-2",
        snippet: `Mock 数据兜底，实际部署时请在 .env 中配置 TAVILY_API_KEY 以启用真实搜索。`,
      },
    ],
  };
}

registerTool({
  name: "search",
  description:
    "在互联网上搜索信息，返回相关网页标题、链接和摘要。适用于查询时效性信息、事实核查等场景。若未配置搜索 API Key，将返回本地模拟数据。",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "搜索关键词或问题",
      },
    },
    required: ["query"],
  },
  execute: async (args) => {
    const query = String(args.query ?? "").trim();
    if (!query) {
      throw new Error("query 参数不能为空");
    }
    try {
      return await searchViaTavily(query);
    } catch (err) {
      // Tavily 不可用（未配置 key 或请求失败）时降级到 mock，保证工具始终可用
      console.warn(`[search] Tavily 调用失败，降级为 mock: ${(err as Error).message}`);
      return searchViaMock(query);
    }
  },
});
