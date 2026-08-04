// 解析 LLM 输出：提取思考过程 / 工具调用 / 最终答案
import type { ChatMessage, ToolCall } from "../llm/types.js";

export interface ParsedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ParsedOutput {
  thought?: string;
  toolCalls?: ParsedToolCall[];
  finalAnswer?: string;
  rawContent: string | null;
}

const THOUGHT_PATTERN = /^\s*\[思考\]([\s\S]*?)(?:\n\n|$)/;

/**
 * 解析 DeepSeek 返回的 assistant message。
 * - 优先看 tool_calls 字段（OpenAI 兼容协议，结构化，不需要自己拿正则怼 JSON）
 * - content 开头若匹配 [思考]... 则提取为 thought，剩余部分作为最终答案
 * - 工具调用参数 JSON.parse 失败时抛出可读错误，由上层 runtime 捕获并记入 trace
 */
export function parseAssistantMessage(message: ChatMessage): ParsedOutput {
  const rawContent = message.content;
  const result: ParsedOutput = { rawContent };

  let remainingContent = rawContent ?? "";
  const thoughtMatch = THOUGHT_PATTERN.exec(remainingContent);
  if (thoughtMatch) {
    result.thought = thoughtMatch[1].trim();
    remainingContent = remainingContent.slice(thoughtMatch[0].length).trim();
  }

  if (message.tool_calls && message.tool_calls.length > 0) {
    result.toolCalls = message.tool_calls.map((call: ToolCall) => {
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = call.function.arguments
          ? JSON.parse(call.function.arguments)
          : {};
      } catch (err) {
        throw new Error(
          `工具调用参数 JSON 解析失败: ${call.function.name} - ${(err as Error).message}`
        );
      }
      return {
        id: call.id,
        name: call.function.name,
        arguments: parsedArgs,
      };
    });
    // 有 tool_calls 时，剩余 content（如果有）当作附带说明，不当作最终答案
    return result;
  }

  // 没有 tool_calls，剩余 content 就是最终答案
  result.finalAnswer = remainingContent || rawContent || "";
  return result;
}
