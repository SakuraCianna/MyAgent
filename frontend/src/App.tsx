// 主应用：左侧会话列表 + 右侧聊天窗口（含 ChatGPT 风格内嵌 GitHub 设置） + 可折叠执行 Trace 视图
import { useEffect, useRef, useState } from "react";
import { api, sendMessageStream } from "./api/client";
import type { SessionDto, TraceEntry } from "./api/client";
import { SessionSidebar } from "./components/SessionSidebar";
import { ChatWindow, type ChatMessageView } from "./components/ChatWindow";
import { ToolTraceView } from "./components/ToolTraceView";
import { PluginsView } from "./components/PluginsView";
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

  // 实时保存 activeId 到 ref，解决闭包中 activeId 无法感知会话切换的问题
  const activeIdRef = useRef(activeId);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

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

  const activeAbortControllerRef = useRef<AbortController | null>(null);

  // 切换会话或组件卸载时，自动取消正在进行的流式网络请求，防止后端/网络句柄泄露
  useEffect(() => {
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    setMessages([]);
    setTrace([]);
    setShowTrace(false);
    if (!activeId) return;
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
      // 如果删除的是当前选中的会话，立即同步清空 UI
      if (activeIdRef.current === id) {
        setMessages([]);
        setTrace([]);
      }
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (activeIdRef.current === id) {
          const nextActive = next[0]?.id ?? null;
          setActiveId(nextActive);
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

    // 记录发起请求时的 sessionId，用于检测用户是否切换了对话
    const requestSessionId = activeId;

    // 先乐观追加用户消息
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    // 追加一个空的 assistant 气泡，后续逐 token 填充（打字机效果）
    const assistantPlaceholderId = `streaming-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantPlaceholderId, role: "assistant", content: "" },
    ]);

    const abortCtrl = new AbortController();
    activeAbortControllerRef.current = abortCtrl;

    try {
      await sendMessageStream(
        activeId,
        text,
        {
          onToken: (token) => {
            // 通过 activeIdRef.current 校验：只有当前画面展示的正是该会话时才更新 UI，彻底解决串屏 Bug！
            if (activeIdRef.current !== requestSessionId) return;
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = {
                  ...last,
                  content: last.content + token,
                };
              }
              return next;
            });
          },
          onToolCall: (name) => {
            if (activeIdRef.current !== requestSessionId) return;
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = {
                  ...last,
                  content: last.content + `\n\n[TOOL_CALL:${name}]\n\n`,
                };
              }
              return next;
            });
          },
          onDone: () => {
            setSending(false);
            if (activeIdRef.current === requestSessionId) {
              refreshTrace(requestSessionId);
            }
            setSessions((prev) =>
              prev
                .map((s) => (s.id === requestSessionId ? { ...s, updatedAt: new Date().toISOString() } : s))
                .sort((a, b) => (a.id === requestSessionId ? -1 : b.id === requestSessionId ? 1 : 0))
            );
          },
          onError: (message) => {
            if (activeIdRef.current !== requestSessionId) {
              setSending(false);
              return;
            }
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant" && last.content === "") {
                next[next.length - 1] = { ...last, content: `出错了：${message}` };
              } else {
                next.push({ role: "assistant", content: `出错了：${message}` });
              }
              return next;
            });
            setSending(false);
          },
        },
        abortCtrl.signal
      );
    } catch (err) {
      const msg = (err as Error).message;
      setError(formatErrorMessage(err));
      if (activeIdRef.current === requestSessionId) {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant" && last.content === "") {
            next[next.length - 1] = { ...last, content: `出错了：${msg}` };
          }
          return next;
        });
      }
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

  const [currentNav, setCurrentNav] = useState<"chat" | "plugins">("chat");

  return (
    <div className="app-shell">
      <SessionSidebar
        sessions={sessions}
        activeId={activeId}
        currentNav={currentNav}
        onNavChange={setCurrentNav}
        onSelect={setActiveId}
        onCreate={handleNewSession}
        onDelete={handleDeleteSession}
        activeSession={activeSession}
      />
      {currentNav === "chat" ? (
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
      ) : (
        <PluginsView
          activeSession={activeSession}
          onGithubChange={handleGithubChange}
          onBackToChat={() => setCurrentNav("chat")}
        />
      )}
    </div>
  );
}
