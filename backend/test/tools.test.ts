process.env.DB_PATH = ":memory:";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getTool, registerAllTools } from "../src/tools/registry.js";
import { createSession } from "../src/session/sessionManager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.resolve(__dirname, "../data/docs");

test("Tools Full Coverage Test Suite", async (t) => {
  await registerAllTools();

  // Setup test doc
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }
  const testDocPath = path.join(DOCS_DIR, "sample_guide.md");
  fs.writeFileSync(testDocPath, "这是一个关于 Agent Runtime 核心指南的示例文档。包含关键字：光辰智能。");

  t.after(() => {
    if (fs.existsSync(testDocPath)) {
      fs.unlinkSync(testDocPath);
    }
  });

  await t.test("calculator tool full expression & error coverage", async () => {
    const calc = getTool("calculator");
    assert.ok(calc);

    // Normal calculations
    const res1 = await calc.execute({ expression: "(10 + 20) * 2 - 5 % 3" }, { sessionId: "s1" });
    assert.deepEqual(res1, { expression: "(10 + 20) * 2 - 5 % 3", result: 58 });

    // Modulo
    const res2 = await calc.execute({ expression: "10 % 3" }, { sessionId: "s1" });
    assert.deepEqual(res2, { expression: "10 % 3", result: 1 });

    // Divide by zero
    await assert.rejects(
      async () => calc.execute({ expression: "1 / 0" }, { sessionId: "s1" }),
      /除数不能为 0/
    );

    // Empty expression
    await assert.rejects(
      async () => calc.execute({ expression: "" }, { sessionId: "s1" }),
      /expression 参数不能为空/
    );

    // Invalid syntax / characters
    await assert.rejects(
      async () => calc.execute({ expression: "2 + abc" }, { sessionId: "s1" }),
      /不支持的字符/
    );

    // Mismatched parentheses
    await assert.rejects(
      async () => calc.execute({ expression: "(2 + 3" }, { sessionId: "s1" }),
      /括号不匹配/
    );

    // Unexpected operator
    await assert.rejects(
      async () => calc.execute({ expression: "2 ++ 3" }, { sessionId: "s1" }),
      /格式错误/
    );
  });

  await t.test("weather tool error & result coverage", async () => {
    const weather = getTool("weather");
    assert.ok(weather);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          current_condition: [
            { temp_C: "25", humidity: "60", FeelsLikeC: "26", windspeedKmph: "10", weatherDesc: [{ value: "Sunny" }] },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )) as typeof fetch;

    try {
      const res = (await weather.execute({ city: "上海" }, { sessionId: "s1" })) as {
        city: string;
        condition: string;
        temperatureC: number;
      };
      assert.equal(res.city, "上海");
      assert.equal(res.temperatureC, 25);
    } finally {
      globalThis.fetch = originalFetch;
    }

    await assert.rejects(
      async () => weather.execute({ city: "  " }, { sessionId: "s1" }),
      /city 参数不能为空/
    );
  });

  await t.test("search tool query validation & Tavily API mock", async () => {
    const search = getTool("search");
    assert.ok(search);

    // Empty query
    await assert.rejects(
      async () => search.execute({ query: "" }, { sessionId: "s1" }),
      /query 参数不能为空/
    );

    // Mock fallback when key missing
    const mockRes = (await search.execute({ query: "DeepSeek" }, { sessionId: "s1" })) as {
      results: unknown[];
    };
    assert.ok(Array.isArray(mockRes.results));

    // Test with Tavily API key and mock fetch
    const originalFetch = globalThis.fetch;
    process.env.TAVILY_API_KEY = "mock_tavily_key";
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          results: [{ title: "Tavily Search Result", url: "https://tavily.com", content: "Content" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const tavilyRes = (await search.execute({ query: "DeepSeek" }, { sessionId: "s1" })) as {
      results: Array<{ title: string }>;
    };
    assert.equal(tavilyRes.results[0].title, "Tavily Search Result");

    process.env.TAVILY_API_KEY = "";
    globalThis.fetch = originalFetch;
  });

  await t.test("todo tool full CRUD, session isolation and error handling", async () => {
    const todo = getTool("todo");
    assert.ok(todo);
    const sessionA = createSession("Todo Session A");
    const sessionB = createSession("Todo Session B");

    // Add
    const addRes = (await todo.execute({ action: "add", content: "写论文" }, { sessionId: sessionA.id })) as {
      added: { id: string; content: string };
    };
    const todoId = addRes.added.id;
    assert.equal(addRes.added.content, "写论文");

    // Complete
    const compRes = (await todo.execute({ action: "complete", id: todoId }, { sessionId: sessionA.id })) as {
      completedId: string;
    };
    assert.equal(compRes.completedId, todoId);

    // Complete error (non-existent id or wrong session)
    await assert.rejects(
      async () => todo.execute({ action: "complete", id: todoId }, { sessionId: sessionB.id }),
      /未找到待办事项/
    );

    // Delete
    const delRes = (await todo.execute({ action: "delete", id: todoId }, { sessionId: sessionA.id })) as {
      deletedId: string;
    };
    assert.equal(delRes.deletedId, todoId);

    // Delete error
    await assert.rejects(
      async () => todo.execute({ action: "delete", id: "fake-id" }, { sessionId: sessionA.id }),
      /未找到待办事项/
    );

    // Missing parameters
    await assert.rejects(
      async () => todo.execute({ action: "add", content: "" }, { sessionId: sessionA.id }),
      /需要提供 content/
    );
    await assert.rejects(
      async () => todo.execute({ action: "complete", id: "" }, { sessionId: sessionA.id }),
      /需要提供 id/
    );
    await assert.rejects(
      async () => todo.execute({ action: "delete", id: "" }, { sessionId: sessionA.id }),
      /需要提供 id/
    );
    await assert.rejects(
      async () => todo.execute({ action: "invalid" }, { sessionId: sessionA.id }),
      /不支持的 action/
    );
  });

  await t.test("read_docs tool list, read, search & path traversal security", async () => {
    const readDocs = getTool("read_docs");
    assert.ok(readDocs);

    // Action list
    const listRes = (await readDocs.execute({ action: "list" }, { sessionId: "s1" })) as {
      files: string[];
    };
    assert.ok(listRes.files.includes("sample_guide.md"));

    // Action read
    const readRes = (await readDocs.execute({ action: "read", filename: "sample_guide.md" }, { sessionId: "s1" })) as {
      content: string;
    };
    assert.ok(readRes.content.includes("光辰智能"));

    // Action read missing filename
    await assert.rejects(
      async () => readDocs.execute({ action: "read", filename: "" }, { sessionId: "s1" }),
      /需要提供 filename/
    );

    // Action read non-existent file
    await assert.rejects(
      async () => readDocs.execute({ action: "read", filename: "non_existent.md" }, { sessionId: "s1" }),
      /文档不存在/
    );

    // Safe path traversal attempt
    await assert.rejects(
      async () => readDocs.execute({ action: "read", filename: "../../package.json" }, { sessionId: "s1" }),
      /非法文件路径/
    );

    // Action search match
    const searchRes = (await readDocs.execute({ action: "search", keyword: "光辰智能" }, { sessionId: "s1" })) as {
      matches: Array<{ filename: string; snippet: string }>;
    };
    assert.ok(searchRes.matches.length > 0);
    assert.equal(searchRes.matches[0].filename, "sample_guide.md");

    // Action search no match
    const noMatchRes = (await readDocs.execute({ action: "search", keyword: "不存在的关键词xyz" }, { sessionId: "s1" })) as {
      matches: Array<unknown>;
    };
    assert.equal(noMatchRes.matches.length, 0);

    // Action search missing keyword
    await assert.rejects(
      async () => readDocs.execute({ action: "search", keyword: "" }, { sessionId: "s1" }),
      /需要提供 keyword/
    );

    // Invalid action
    await assert.rejects(
      async () => readDocs.execute({ action: "unknown" }, { sessionId: "s1" }),
      /不支持的 action/
    );
  });

  await t.test("codeExecutor tool console.log capture, length limit & errors", async () => {
    const codeExec = getTool("code_executor");
    assert.ok(codeExec);

    // Console.log & return
    const logRes = (await codeExec.execute(
      { code: "console.log('hello', 'world'); return 42;" },
      { sessionId: "s1" }
    )) as { logs: string[]; result: number };
    assert.deepEqual(logRes.logs, ["hello world"]);
    assert.equal(logRes.result, 42);

    // Empty code error
    await assert.rejects(
      async () => codeExec.execute({ code: "" }, { sessionId: "s1" }),
      /code 参数不能为空/
    );

    // Code length limit
    const longCode = "a".repeat(2005);
    await assert.rejects(
      async () => codeExec.execute({ code: longCode }, { sessionId: "s1" }),
      /代码长度超过限制/
    );
  });
});
