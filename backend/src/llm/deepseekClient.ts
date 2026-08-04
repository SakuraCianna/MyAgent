// DeepSeek Chat Completions 客户端封装（OpenAI 兼容协议）
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatMessage,
  ToolSchema,
} from "./types.js";

const DEEPSEEK_API_URL =
  process.env.DEEPSEEK_API_URL ?? "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

export class DeepSeekError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "DeepSeekError";
  }
}

/**
 * 调用 DeepSeek Chat Completions 接口。
 * 不依赖任何 agent 框架 / OpenAI SDK，仅用原生 fetch 直接对接 REST API。
 */
export async function chatCompletion(
  messages: ChatMessage[],
  tools: ToolSchema[]
): Promise<ChatCompletionResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new DeepSeekError("缺少 DEEPSEEK_API_KEY 环境变量，请在 .env 中配置");
  }

  const body: ChatCompletionRequest = {
    model: DEEPSEEK_MODEL,
    messages,
    temperature: 0.3,
  };
  if (tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  let response: Response;
  try {
    response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new DeepSeekError(
      `请求 DeepSeek API 网络失败: ${(err as Error).message}`
    );
  }

  if (!response.ok) {
    let errBody: unknown;
    try {
      errBody = await response.json();
    } catch {
      errBody = await response.text().catch(() => undefined);
    }
    throw new DeepSeekError(
      `DeepSeek API 返回错误状态 ${response.status}`,
      response.status,
      errBody
    );
  }

  const data = (await response.json()) as ChatCompletionResponse;
  return data;
}
