import test from "node:test";
import assert from "node:assert/strict";
import { getTool, registerAllTools } from "../src/tools/registry.js";
import { createSession } from "../src/session/sessionManager.js";
test("Tools Unit Test Suite", async (t) => {
    await registerAllTools();
    await t.test("calculator tool executes math expressions", async () => {
        const calc = getTool("calculator");
        assert.ok(calc);
        const res = await calc.execute({ expression: "(10 + 20) * 2" }, { sessionId: "test-session" });
        assert.deepEqual(res, { expression: "(10 + 20) * 2", result: 60 });
    });
    await t.test("calculator tool catches divide by zero", async () => {
        const calc = getTool("calculator");
        assert.ok(calc);
        await assert.rejects(async () => calc.execute({ expression: "1 / 0" }, { sessionId: "test-session" }), /除数不能为 0/);
    });
    await t.test("weather tool returns mock weather data", async () => {
        const weather = getTool("weather");
        assert.ok(weather);
        const res = (await weather.execute({ city: "北京" }, { sessionId: "test-session" }));
        assert.equal(res.city, "北京");
        assert.ok(res.condition);
        assert.equal(typeof res.temperatureC, "number");
    });
    await t.test("search tool falls back to mock results without API key", async () => {
        const search = getTool("search");
        assert.ok(search);
        const res = (await search.execute({ query: "Node.js 24" }, { sessionId: "test-session" }));
        assert.ok(Array.isArray(res.results));
        assert.ok(res.results.length > 0);
    });
    await t.test("todo tool performs CRUD with session isolation", async () => {
        const todo = getTool("todo");
        assert.ok(todo);
        const sessionA = createSession("Session A");
        const sessionB = createSession("Session B");
        // Add todo to Session A
        const addRes = (await todo.execute({ action: "add", content: "买牛奶" }, { sessionId: sessionA.id }));
        assert.equal(addRes.added.content, "买牛奶");
        // List todo for Session A
        const listA = (await todo.execute({ action: "list" }, { sessionId: sessionA.id }));
        assert.equal(listA.todos.length, 1);
        assert.equal(listA.todos[0].content, "买牛奶");
        // List todo for Session B (should be isolated/empty)
        const listB = (await todo.execute({ action: "list" }, { sessionId: sessionB.id }));
        assert.equal(listB.todos.length, 0);
    });
    await t.test("codeExecutor evaluates safe code and blocks forbidden constructs", async () => {
        const codeExec = getTool("code_executor");
        assert.ok(codeExec);
        const safeRes = (await codeExec.execute({ code: "const a = 5; const b = 10; return a + b;" }, { sessionId: "test-session" }));
        assert.equal(safeRes.result, 15);
        await assert.rejects(async () => codeExec.execute({ code: "process.exit(1)" }, { sessionId: "test-session" }), /process is not defined/);
    });
});
//# sourceMappingURL=tools.test.js.map