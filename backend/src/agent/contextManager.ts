// Context 管理：最大轮次限制 + 基础压缩策略
import type { ChatMessage } from "../llm/types.js";

export const MAX_LOOP_COUNT = 6;
// 压缩阈值：按字符数估算 token（中文场景下比 tiktoken 更直观、无需额外依赖）
const COMPRESS_CHAR_THRESHOLD = 8000;
// 触发压缩后，保留最近 N 条 user/assistant 消息原文不动
const KEEP_RECENT_MESSAGES = 6;

function estimateChars(messages: ChatMessage[]): number {
  return messages.reduce((sum, m) => sum + (m.content?.length ?? 0), 0);
}

/**
 * 基础压缩：
 * - 未超过阈值：原样返回
 * - 超过阈值：保留最前面的 system 消息 + 最近 KEEP_RECENT_MESSAGES 条消息，
 *   中间部分折叠成一条摘要 system 消息（拼接关键 user 提问 + assistant 最终答案，跳过工具调用细节）。
 * 这是题目要求的"基础压缩"，非生产级（不做语义摘要、不调 LLM 二次总结）。
 */
export function compressIfNeeded(messages: ChatMessage[]): ChatMessage[] {
  if (estimateChars(messages) <= COMPRESS_CHAR_THRESHOLD) {
    return messages;
  }

  const systemMessages = messages.filter((m) => m.role === "system");
  const nonSystem = messages.filter((m) => m.role !== "system");

  if (nonSystem.length <= KEEP_RECENT_MESSAGES) {
    return messages; // 消息条数本身就不多，不压缩（可能是单条超长消息，压缩也无益）
  }

  const toCompress = nonSystem.slice(0, nonSystem.length - KEEP_RECENT_MESSAGES);
  const toKeep = nonSystem.slice(nonSystem.length - KEEP_RECENT_MESSAGES);

  const summaryLines: string[] = [];
  for (const m of toCompress) {
    if (m.role === "user" && m.content) {
      summaryLines.push(`用户曾问: ${truncate(m.content, 100)}`);
    } else if (m.role === "assistant" && m.content) {
      summaryLines.push(`Agent曾答: ${truncate(m.content, 100)}`);
    }
    // 跳过 tool 消息细节和 assistant 的 tool_calls 意图，保留概要即可
  }

  const summaryMessage: ChatMessage = {
    role: "system",
    content: `[历史对话摘要，早期消息已压缩]\n${summaryLines.join("\n")}`,
  };

  return [...systemMessages, summaryMessage, ...toKeep];
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "..." : text;
}

/**
 * 工具执行结果可能是大 JSON（比如 github_reader 读整个文件），
 * 塞进 context 前做长度截断，避免撑爆上下文。
 */
export function truncateToolResult(result: unknown, maxChars = 16000): string {
  if (result === undefined) return "undefined";
  if (result === null) return "null";
  const str = typeof result === "string" ? result : (JSON.stringify(result) ?? String(result));
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars) + `\n...[因长文章已做安全截断，原始长度 ${str.length} 字符]`;
}
