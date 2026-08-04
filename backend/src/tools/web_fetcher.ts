// web_fetcher 工具：抓取指定 URL 网页正文内容，模仿 ChatGPT 深度网页阅读 (Web Browsing) 能力
import { registerTool } from "./registry.js";

registerTool({
  name: "web_fetcher",
  description:
    "抓取并提取指定网址 (http/https) 的网页正文内容。当用户提供一个网页链接并要求阅读、总结或提取其中的内容时使用。",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "需要读取抓取的完整网页链接 URL，例如 'https://example.com/article'",
      },
    },
    required: ["url"],
  },
  execute: async (args) => {
    const rawUrl = String(args.url ?? "").trim();
    if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) {
      throw new Error("必须提供有效的 http:// 或 https:// 网页链接");
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(rawUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
        },
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`网页响应状态码异常: ${res.status} ${res.statusText}`);
      }

      const html = await res.text();
      // 简易正则过滤 script, style, html 标签
      const cleanText = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const truncated = cleanText.length > 16000 ? cleanText.slice(0, 16000) + "...(已截断超长网页内容)" : cleanText;

      return {
        url: rawUrl,
        status: res.status,
        contentLength: cleanText.length,
        text: truncated || "网页未解析出有效的文本内容",
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`抓取网页失败 [${rawUrl}]: ${msg}`);
    }
  },
});
