// 工具相关路由：返回工具列表（供前端展示，例如显示 GitHub 工具是否可用）
import { Router } from "express";
import { listAllTools } from "../tools/registry.js";

export const toolsRouter = Router();

toolsRouter.get("/", (_req, res) => {
  try {
    const tools = listAllTools().map((t) => ({
      name: t.name,
      description: t.description,
      requiresToggle: t.requiresToggle ?? null,
    }));
    res.json({ tools });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
