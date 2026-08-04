// Session 相关路由：创建/列表/重命名/删除、GitHub 开关设置
import { Router } from "express";
import {
  createSession,
  listSessions,
  getSessionOrThrow,
  renameSession,
  deleteSession,
  setGithubConnection,
} from "../session/sessionManager.js";
import { getTraceForSession } from "../agent/trace.js";
import { getDb } from "../db/client.js";

export const sessionsRouter = Router();

sessionsRouter.get("/", (_req, res) => {
  try {
    res.json({ sessions: listSessions() });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

sessionsRouter.post("/", (req, res) => {
  try {
    const title = typeof req.body?.title === "string" ? req.body.title : undefined;
    res.status(201).json({ session: createSession(title) });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

sessionsRouter.get("/:id", (req, res) => {
  try {
    res.json({ session: getSessionOrThrow(req.params.id) });
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

sessionsRouter.patch("/:id", (req, res) => {
  try {
    const title = String(req.body?.title ?? "");
    res.json({ session: renameSession(req.params.id, title) });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

sessionsRouter.delete("/:id", (req, res) => {
  try {
    deleteSession(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

// GitHub 连接开关：点击 ChatGPT 风格的图标按钮后，前端调用这个接口启用/禁用
sessionsRouter.put("/:id/github", (req, res) => {
  try {
    const { enabled, token, repo } = req.body ?? {};
    const session = setGithubConnection(req.params.id, {
      enabled: Boolean(enabled),
      token: typeof token === "string" ? token : undefined,
      repo: typeof repo === "string" ? repo : undefined,
    });
    res.json({ session });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

sessionsRouter.get("/:id/trace", (req, res) => {
  try {
    res.json({ trace: getTraceForSession(req.params.id) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

sessionsRouter.get("/:id/messages", (req, res) => {
  try {
    const session = getSessionOrThrow(req.params.id);
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, role, content, created_at FROM messages WHERE session_id = ? AND role IN ('user', 'assistant') ORDER BY created_at ASC`
      )
      .all(session.id) as unknown as Array<{ id: string; role: string; content: string | null; created_at: string }>;

    res.json({
      messages: rows.map((r) => ({
        id: r.id,
        role: r.role,
        content: r.content ?? "",
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
