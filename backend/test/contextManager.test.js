import test from "node:test";
import assert from "node:assert/strict";
import { compressIfNeeded, truncateToolResult, MAX_LOOP_COUNT } from "../src/agent/contextManager.js";
test("Context Manager Unit Test Suite", async (t) => {
    await t.test("MAX_LOOP_COUNT is defined as 6", () => {
        assert.equal(MAX_LOOP_COUNT, 6);
    });
    await t.test("truncateToolResult truncates large payloads", () => {
        const hugeObject = { data: "x".repeat(5000) };
        const truncated = truncateToolResult(hugeObject);
        assert.ok(truncated.length < 5000);
        assert.ok(truncated.includes("[已截断，原始长度"));
    });
    await t.test("compressIfNeeded preserves system prompt and short messages", () => {
        const messages = [
            { role: "system", content: "You are a helpful assistant" },
            { role: "user", content: "Hello" },
            { role: "assistant", content: "Hi" },
        ];
        const compressed = compressIfNeeded(messages);
        assert.deepEqual(compressed, messages);
    });
    await t.test("compressIfNeeded compresses long conversation histories", () => {
        const longContent = "中文上下文测试内容 ".repeat(500); // approx 4500 chars per message
        const messages = [
            { role: "system", content: "System prompt" },
            { role: "user", content: "Old question 1 " + longContent },
            { role: "assistant", content: "Old answer 1 " + longContent },
            { role: "user", content: "Old question 2 " + longContent },
            { role: "assistant", content: "Old answer 2 " + longContent },
            { role: "user", content: "Old question 3 " + longContent },
            { role: "assistant", content: "Old answer 3 " + longContent },
            { role: "user", content: "Recent question" },
            { role: "assistant", content: "Recent answer" },
        ];
        const compressed = compressIfNeeded(messages);
        assert.ok(compressed.length < messages.length);
        assert.equal(compressed[0].role, "system");
        assert.ok(compressed[1].content?.includes("历史对话摘要"));
    });
});
//# sourceMappingURL=contextManager.test.js.map