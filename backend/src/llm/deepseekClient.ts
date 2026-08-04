// DeepSeek Chat Completions 客户端封装（OpenAI 兼容协议），支持标准与 SSE 流式传输
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
 * 调用 DeepSeek Chat Completions 接口（非流式）。
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
    max_tokens: 8192,
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
    const errDetail = typeof errBody === "object" ? JSON.stringify(errBody) : String(errBody ?? "");
    throw new DeepSeekError(
      `DeepSeek API 返回错误状态 ${response.status}${errDetail ? `: ${errDetail}` : ""}`,
      response.status,
      errBody
    );
  }

  const data = (await response.json()) as ChatCompletionResponse;
  return data;
}

/**
 * 调用 DeepSeek Chat Completions 接口（SSE 真流式）。
 * 在生成文本 token 时回调 onChunk 实时推送给客户端。
 */
export async function chatCompletionStream(
  messages: ChatMessage[],
  tools: ToolSchema[],
  onChunk: (token: string) => void
): Promise<ChatCompletionResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return chatCompletion(messages, tools);
  }

  const body = {
    model: DEEPSEEK_MODEL,
    messages,
    temperature: 0.3,
    max_tokens: 8192,
    stream: true,
    ...(tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
  };

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
  } catch {
    return chatCompletion(messages, tools);
  }

  if (!response.ok || !response.body) {
    return chatCompletion(messages, tools);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";
  type ToolCallItem = NonNullable<ChatCompletionResponse["choices"][0]["message"]["tool_calls"]>[number];
  let toolCalls: ToolCallItem[] | undefined = undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const dataStr = trimmed.slice(5).trim();
      if (dataStr === "[DONE]") break;

      try {
        const json = JSON.parse(dataStr);
        const delta = json.choices?.[0]?.delta;
        if (delta?.content) {
          fullContent += delta.content;
          onChunk(delta.content);
        }
        if (delta?.tool_calls) {
          if (!toolCalls) toolCalls = [];
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCalls[idx]) {
              toolCalls[idx] = {
                id: tc.id || `call_${Date.now()}_${idx}`,
                type: "function",
                function: {
                  name: tc.function?.name || "",
                  arguments: tc.function?.arguments || "",
                },
              };
            } else {
              if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
              if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
            }
          }
        }
      } catch {
        // Ignore chunk parsing errors
      }
    }
  }

  return {
    id: `stream_${Date.now()}`,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant" as const,
          content: fullContent || null,
          tool_calls: toolCalls,
        },
        finish_reason: toolCalls ? "tool_calls" : "stop",
      },
    ],
  };
}
