// Agent 执行 trace / 日志记录
import { randomUUID } from "node:crypto";
import { getDb } from "../db/client.js";

export type TraceType =
  | "loop_start"
  | "llm_request"
  | "llm_response"
  | "tool_call"
  | "tool_result"
  | "tool_error"
  | "final_answer"
  | "max_loop_reached"
  | "compress"
  | "error";

export interface TraceEntry {
  id: string;
  sessionId: string;
  loopIndex: number;
  type: TraceType;
  payload: unknown;
  createdAt: string;
}

/**
 * 记录一条 trace：写入 sqlite trace_logs 表，同时输出结构化 console.log 便于调试。
 * 不抛出异常（trace 记录失败不应影响主流程）。
 */
export function logTrace(
  sessionId: string,
  loopIndex: number,
  type: TraceType,
  payload: unknown
): void {
  const id = randomUUID();
  const payloadJson = safeStringify(payload);

  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO trace_logs (id, session_id, loop_index, type, payload_json) VALUES (?, ?, ?, ?, ?)`
    ).run(id, sessionId, loopIndex, type, payloadJson);
  } catch (err) {
    console.error(`[trace] 写入 trace_logs 失败: ${(err as Error).message}`);
  }

  console.log(
    `[trace] session=${sessionId} loop=${loopIndex} type=${type} payload=${truncateForLog(payloadJson)}`
  );
}

export function getTraceForSession(sessionId: string): TraceEntry[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, session_id as sessionId, loop_index as loopIndex, type, payload_json as payloadJson, created_at as createdAt
       FROM trace_logs WHERE session_id = ? ORDER BY created_at ASC`
    )
    .all(sessionId) as Array<{
    id: string;
    sessionId: string;
    loopIndex: number;
    type: TraceType;
    payloadJson: string;
    createdAt: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    sessionId: r.sessionId,
    loopIndex: r.loopIndex,
    type: r.type,
    payload: safeParse(r.payloadJson),
    createdAt: r.createdAt,
  }));
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ error: "无法序列化的 payload" });
  }
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}

function truncateForLog(str: string, max = 300): string {
  return str.length > max ? str.slice(0, max) + "..." : str;
}
