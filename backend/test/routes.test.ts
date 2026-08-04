process.env.DB_PATH = ":memory:";
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Server } from "node:http";
import { sessionsRouter } from "../src/routes/sessions.js";
import { chatRouter } from "../src/routes/chat.js";
import { toolsRouter } from "../src/routes/tools.js";
import { registerAllTools } from "../src/tools/registry.js";
import { createSession } from "../src/session/sessionManager.js";

test("Express REST Routes Integration Test Suite", async (t) => {
  await registerAllTools();

  const app = express();
  app.use(express.json());
  app.use("/api/sessions", sessionsRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api/tools", toolsRouter);

  let server: Server;
  let baseUrl: string;

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      baseUrl = `http://localhost:${port}/api`;
      resolve();
    });
  });

  t.after(() => {
    server.close();
  });

  await t.test("GET /api/sessions returns session list", async () => {
    const res = await fetch(`${baseUrl}/sessions`);
    assert.equal(res.status, 200);
    const data = (await res.json()) as { sessions: unknown[] };
    assert.ok(Array.isArray(data.sessions));
  });

  await t.test("POST /api/sessions creates new session", async () => {
    const res = await fetch(`${baseUrl}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "API 测试会话" }),
    });
    assert.equal(res.status, 201);
    const data = (await res.json()) as { session: { id: string; title: string } };
    assert.equal(data.session.title, "API 测试会话");

    // GET /api/sessions/:id
    const getRes = await fetch(`${baseUrl}/sessions/${data.session.id}`);
    assert.equal(getRes.status, 200);

    // PATCH /api/sessions/:id
    const patchRes = await fetch(`${baseUrl}/sessions/${data.session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "重命名 API 会话" }),
    });
    assert.equal(patchRes.status, 200);

    // PUT /api/sessions/:id/github
    const putGhRes = await fetch(`${baseUrl}/sessions/${data.session.id}/github`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true, token: "ghp_api_token", repo: "owner/repo" }),
    });
    assert.equal(putGhRes.status, 200);

    // GET /api/sessions/:id/trace
    const traceRes = await fetch(`${baseUrl}/sessions/${data.session.id}/trace`);
    assert.equal(traceRes.status, 200);

    // DELETE /api/sessions/:id
    const delRes = await fetch(`${baseUrl}/sessions/${data.session.id}`, {
      method: "DELETE",
    });
    assert.equal(delRes.status, 204);

    // GET deleted 404
    const getDelRes = await fetch(`${baseUrl}/sessions/${data.session.id}`);
    assert.equal(getDelRes.status, 404);
  });

  await t.test("GET /api/tools returns tool list", async () => {
    const res = await fetch(`${baseUrl}/tools`);
    assert.equal(res.status, 200);
    const data = (await res.json()) as { tools: Array<{ name: string }> };
    assert.ok(Array.isArray(data.tools));
    assert.ok(data.tools.some((t) => t.name === "calculator"));
  });

  await t.test("POST /api/chat error handling for missing parameters & invalid sessionId", async () => {
    // Missing sessionId
    const res1 = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });
    assert.equal(res1.status, 400);

    // Missing message
    const res2 = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "some-id" }),
    });
    assert.equal(res2.status, 400);

    // Session non-existent
    const res3 = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "non-existent-id", message: "hello" }),
    });
    assert.equal(res3.status, 404);
  });

  await t.test("POST /api/chat triggers agent loop with mocked LLM", async () => {
    const s = createSession("Chat API Test");
    const originalFetch = globalThis.fetch;
    process.env.DEEPSEEK_API_KEY = "test_key";

    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.includes("/chat/completions")) {
        return new Response(
          JSON.stringify({
            choices: [{ message: { role: "assistant", content: "REST API 对接正常" } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url, init);
    }) as typeof fetch;

    const res = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: s.id, message: "测试聊天 API" }),
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as { finalAnswer: string; loopCount: number };
    assert.equal(data.finalAnswer, "REST API 对接正常");

    globalThis.fetch = originalFetch;
  });
});
