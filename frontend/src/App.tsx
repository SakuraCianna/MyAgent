// 主应用：左侧会话列表 + 右侧聊天窗口（含 ChatGPT 风格内嵌 GitHub 设置） + 可折叠执行 Trace 视图
import { useEffect, useRef, useState } from "react";
import { api } from "./api/client";
import type { SessionDto, TraceEntry } from "./api/client";
import { SessionSidebar } from "./components/SessionSidebar";
import { ChatWindow, type ChatMessageView } from "./components/ChatWindow";
import { ToolTraceView } from "./components/ToolTraceView";
import "./styles/app.css";

export default function App() {
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [trace, setTrace] = useState<TraceEntry[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTrace, setShowTrace] = useState(false);
  const initialized = useRef(false);

  const activeSession = sessions.find((s) => s.id === activeId) ?? null;

  function formatErrorMessage(err: unknown): string {
    const msg = (err as Error).message || String(err);
    if (msg.includes("500") || msg.includes("fetch") || msg.includes("Failed to fetch") || msg.includes("ECONNREFUSED")) {
      return "网络连接失败 (500): 后端服务未连接，请先在终端运行 cd backend && npm run dev 启动服务";
    }
    return msg;
  }

  // 初始化：加载会话列表，没有会话则自动创建一个
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    (async () => {
      try {
        const { sessions: list } = await api.listSessions();
        if (list.length === 0) {
          const { session } = await api.createSession("新会话");
          setSessions([session]);
          setActiveId(session.id);
        } else {
          setSessions(list);
          setActiveId(list[0].id);
        }
      } catch (err) {
        setError(formatErrorMessage(err));
      }
    })();
  }, []);

  // 切换会话时，重新拉取该会话的历史消息与 Trace 历史
  useEffect(() => {
    if (!activeId) return;
    setMessages([]);
    setTrace([]);
    setShowTrace(false);
    refreshMessages(activeId);
    refreshTrace(activeId);
  }, [activeId]);

  async function refreshMessages(sessionId: string) {
    try {
      const { messages: list } = await api.getSessionMessages(sessionId);
      setMessages(
        list.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      );
    } catch {
      // 失败静默
    }
  }

  async function refreshTrace(sessionId: string) {
    try {
      const { trace: t } = await api.getTrace(sessionId);
      setTrace(t);
    } catch {
      // trace 拉取失败不影响主流程
    }
  }

  async function handleNewSession() {
    try {
      const { session } = await api.createSession();
      setSessions((prev) => [session, ...prev]);
      setActiveId(session.id);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDeleteSession(id: string) {
    try {
      await api.deleteSession(id);
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (activeId === id) {
          setActiveId(next[0]?.id ?? null);
        }
        return next;
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleSend(text: string) {
    if (!activeId || !text.trim() || sending) return;
    setError(null);
    setSending(true);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    try {
      const reply = await api.sendMessage(activeId, text);
      setMessages((prev) => [...prev, { role: "assistant", content: reply.finalAnswer }]);
      refreshTrace(activeId);
      setSessions((prev) =>
        prev
          .map((s) => (s.id === activeId ? { ...s, updatedAt: new Date().toISOString() } : s))
          .sort((a, b) => (a.id === activeId ? -1 : b.id === activeId ? 1 : 0))
      );
    } catch (err) {
      setError((err as Error).message);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `出错了：${(err as Error).message}` },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function handleGithubChange(opts: { enabled: boolean; token?: string; repo?: string }) {
    if (!activeId) return;
    try {
      const { session } = await api.setGithubConnection(activeId, opts);
      setSessions((prev) => prev.map((s) => (s.id === activeId ? session : s)));
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }

  // 错误提示 4 秒自动消失机制
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  return (
    <div className="app-shell">
      <SessionSidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={setActiveId}
        onCreate={handleNewSession}
        onDelete={handleDeleteSession}
      />
      <div className="app-main">
        <header className="app-header">
          <h1 className="app-title">{activeSession?.title ?? "最小可用 Agent Runtime"}</h1>
          <div className="app-header-actions">
            <button
              className="trace-toggle-btn"
              onClick={() => setShowTrace((v) => !v)}
              title="查看 Agent 执行 Trace 轨迹"
            >
              {showTrace ? "隐藏 Trace 轨迹" : "查看 Trace 轨迹"}
            </button>
          </div>
        </header>

        {error && (
          <div className="app-error-banner">
            <span>{error}</span>
            <button
              type="button"
              className="error-close-btn"
              onClick={() => setError(null)}
              title="关闭提醒"
            >
              ✕
            </button>
          </div>
        )}

        <div className="app-body">
          <ChatWindow
            messages={messages}
            loading={sending}
            session={activeSession}
            onSend={handleSend}
            onGithubChange={handleGithubChange}
          />
          {showTrace && <ToolTraceView trace={trace} />}
        </div>
      </div>
    </div>
  );
}
