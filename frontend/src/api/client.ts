// 调用后端 REST API 的统一客户端

const API_BASE = "/api";

export interface SessionDto {
  id: string;
  title: string;
  githubEnabled: boolean;
  githubRepo: string | null;
  githubConnected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatReply {
  finalAnswer: string;
  loopCount: number;
}

export interface TraceEntry {
  id: string;
  sessionId: string;
  loopIndex: number;
  type: string;
  payload: unknown;
  createdAt: string;
}

export interface ToolInfo {
  name: string;
  description: string;
  requiresToggle: string | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let message = `请求失败: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type SseEventType = "token" | "tool_call" | "tool_result" | "done" | "error";

export interface StreamCallbacks {
  /** 接收到一个文本 token 时触发，用于逐字渲染 */
  onToken: (token: string) => void;
  /** LLM 调用某个工具时触发 */
  onToolCall?: (name: string) => void;
  /** 工具执行完毕时触发 */
  onToolResult?: (name: string) => void;
  /** 整个 Agent loop 完成（done 事件）时触发 */
  onDone?: (loopCount: number) => void;
  /** 出错时触发 */
  onError?: (message: string) => void;
}

/**
 * 通过 SSE 流式发送消息。后端会逐 token 推送给前端，实现打字机效果。
 */
export async function sendMessageStream(
  sessionId: string,
  message: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${API_BASE}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, message }),
    signal,
  });

  if (!res.ok) {
    let errMsg = `请求失败: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) errMsg = body.error;
    } catch { /* ignore */ }
    throw new Error(errMsg);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const dataStr = trimmed.slice(5).trim();
      if (!dataStr) continue;

      try {
        const event = JSON.parse(dataStr) as { type: SseEventType; data: unknown };
        switch (event.type) {
          case "token":
            callbacks.onToken(event.data as string);
            break;
          case "tool_call":
            callbacks.onToolCall?.((event.data as { name: string }).name);
            break;
          case "tool_result":
            callbacks.onToolResult?.((event.data as { name: string }).name);
            break;
          case "done":
            callbacks.onDone?.((event.data as { loopCount: number }).loopCount);
            break;
          case "error":
            callbacks.onError?.((event.data as { message: string }).message);
            break;
        }
      } catch {
        // ignore malformed SSE line
      }
    }
  }
}

export const api = {
  listSessions: () => request<{ sessions: SessionDto[] }>("/sessions"),
  createSession: (title?: string) =>
    request<{ session: SessionDto }>("/sessions", {
      method: "POST",
      body: JSON.stringify({ title }),
    }),
  getSession: (id: string) => request<{ session: SessionDto }>(`/sessions/${id}`),
  renameSession: (id: string, title: string) =>
    request<{ session: SessionDto }>(`/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),
  deleteSession: (id: string) =>
    request<void>(`/sessions/${id}`, { method: "DELETE" }),
  setGithubConnection: (
    id: string,
    opts: { enabled: boolean; token?: string; repo?: string }
  ) =>
    request<{ session: SessionDto }>(`/sessions/${id}/github`, {
      method: "PUT",
      body: JSON.stringify(opts),
    }),
  getTrace: (id: string) => request<{ trace: TraceEntry[] }>(`/sessions/${id}/trace`),
  getSessionMessages: (id: string) =>
    request<{ messages: Array<{ id: string; role: "user" | "assistant"; content: string; createdAt: string }> }>(
      `/sessions/${id}/messages`
    ),
  sendMessage: (sessionId: string, message: string) =>
    request<ChatReply>("/chat", {
      method: "POST",
      body: JSON.stringify({ sessionId, message }),
    }),
  listTools: () => request<{ tools: ToolInfo[] }>("/tools"),
};

