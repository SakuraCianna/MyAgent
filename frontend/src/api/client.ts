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
