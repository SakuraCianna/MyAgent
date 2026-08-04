// 对话路由：触发一次 Agent Runtime loop
import { Router } from "express";
import { runAgentLoop } from "../agent/runtime.js";
import { getSessionOrThrow } from "../session/sessionManager.js";

export const chatRouter = Router();

chatRouter.post("/", async (req, res) => {
  try {
    const { sessionId, message } = req.body ?? {};
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      res.status(400).json({ error: "sessionId 不能为空" });
      return;
    }
    if (typeof message !== "string" || !message.trim()) {
      res.status(400).json({ error: "message 不能为空" });
      return;
    }

    // 确认 session 存在（不存在会抛错，返回 404）
    getSessionOrThrow(sessionId);

    const result = await runAgentLoop(sessionId, message.trim());
    res.json({
      finalAnswer: result.finalAnswer,
      loopCount: result.loopCount,
    });
  } catch (err) {
    const message = (err as Error).message;
    const status = message.includes("不存在") ? 404 : 500;
    res.status(status).json({ error: message });
  }
});
