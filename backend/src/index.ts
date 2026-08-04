// Express 启动入口
import "dotenv/config";
import express from "express";
import cors from "cors";
import { registerAllTools } from "./tools/registry.js";
import { sessionsRouter } from "./routes/sessions.js";
import { chatRouter } from "./routes/chat.js";
import { toolsRouter } from "./routes/tools.js";

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use("/api/sessions", sessionsRouter);
app.use("/api/chat", chatRouter);
app.use("/api/tools", toolsRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// 兜底错误处理，避免未捕获异常导致进程崩溃
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[unhandled error]", err);
  res.status(500).json({ error: (err as Error)?.message ?? "服务器内部错误" });
});

async function bootstrap() {
  await registerAllTools();
  app.listen(PORT, () => {
    console.log(`[server] Agent 后端已启动: http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("[bootstrap] 启动失败", err);
  process.exit(1);
});
