// SSE 流式对话路由：触发 Agent Runtime loop 并逐 token 推送给客户端
import { Router } from "express";
import { runAgentLoopStream } from "../agent/runtime.js";
import { getSessionOrThrow } from "../session/sessionManager.js";
import type { SseEvent } from "../agent/runtime.js";

export const chatStreamRouter = Router();

chatStreamRouter.post("/", async (req, res) => {
  const { sessionId, message } = req.body ?? {};
  if (typeof sessionId !== "string" || !sessionId.trim()) {
    res.status(400).json({ error: "sessionId 不能为空" });
    return;
  }
  if (typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "message 不能为空" });
    return;
  }

  try {
    getSessionOrThrow(sessionId);
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
    return;
  }

  // 设置 SSE 响应头
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // 写 SSE event 帮助函数
  const writeEvent = (event: SseEvent) => {
    if (res.writableEnded) return;
    const payload = JSON.stringify(
      event.type === "token" ? { type: event.type, data: event.data } : event
    );
    res.write(`data: ${payload}\n\n`);
  };

  try {
    await runAgentLoopStream(sessionId, message.trim(), writeEvent);
  } catch (err) {
    if (!res.writableEnded) {
      const msg = (err as Error).message;
      res.write(`data: ${JSON.stringify({ type: "error", data: { message: msg } })}\n\n`);
    }
  } finally {
    if (!res.writableEnded) {
      res.end();
    }
  }
});
