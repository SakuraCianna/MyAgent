import test from "node:test";
import assert from "node:assert/strict";
import { runAgentLoop } from "../src/agent/runtime.js";
import { createSession } from "../src/session/sessionManager.js";
import { registerAllTools } from "../src/tools/registry.js";
test("Agent Runtime Loop Decision Unit Test Suite", async (t) => {
    await registerAllTools();
    process.env.DEEPSEEK_API_KEY = "test-mock-key";
    const originalFetch = globalThis.fetch;
    t.afterEach(() => {
        globalThis.fetch = originalFetch;
    });
    await t.test("Direct reply without tool calls", async () => {
        const session = createSession("Direct Reply Test");
        // Mock DeepSeek returning a direct answer
        globalThis.fetch = (async () => {
            return new Response(JSON.stringify({
                choices: [
                    {
                        message: {
                            role: "assistant",
                            content: "你好！有什么我可以帮你的？",
                        },
                    },
                ],
            }), { status: 200, headers: { "Content-Type": "application/json" } });
        });
        const result = await runAgentLoop(session.id, "你好");
        assert.equal(result.finalAnswer, "你好！有什么我可以帮你的？");
        assert.equal(result.loopCount, 0);
    });
    await t.test("Single tool call flow: LLM requests tool -> runtime executes tool -> LLM gives final answer", async () => {
        const session = createSession("Tool Call Test");
        let callStep = 0;
        globalThis.fetch = (async () => {
            callStep++;
            if (callStep === 1) {
                // Step 1: LLM calls calculator
                return new Response(JSON.stringify({
                    choices: [
                        {
                            message: {
                                role: "assistant",
                                content: "[思考] 我需要使用计算器工具计算 12 + 34。",
                                tool_calls: [
                                    {
                                        id: "call_calc_1",
                                        type: "function",
                                        function: {
                                            name: "calculator",
                                            arguments: JSON.stringify({ expression: "12 + 34" }),
                                        },
                                    },
                                ],
                            },
                        },
                    ],
                }), { status: 200, headers: { "Content-Type": "application/json" } });
            }
            else {
                // Step 2: LLM receives tool result and returns final answer
                return new Response(JSON.stringify({
                    choices: [
                        {
                            message: {
                                role: "assistant",
                                content: "12 加 34 的计算结果是 46。",
                            },
                        },
                    ],
                }), { status: 200, headers: { "Content-Type": "application/json" } });
            }
        });
        const result = await runAgentLoop(session.id, "算一下 12 + 34");
        assert.equal(result.finalAnswer, "12 加 34 的计算结果是 46。");
        assert.equal(result.loopCount, 1);
    });
    await t.test("Max loop count termination when LLM gets stuck in tool calls", async () => {
        const session = createSession("Max Loop Test");
        // Mock LLM always returning tool calls without giving final answer
        globalThis.fetch = (async () => {
            return new Response(JSON.stringify({
                choices: [
                    {
                        message: {
                            role: "assistant",
                            content: "继续计算...",
                            tool_calls: [
                                {
                                    id: "call_calc_infinite",
                                    type: "function",
                                    function: {
                                        name: "calculator",
                                        arguments: JSON.stringify({ expression: "1 + 1" }),
                                    },
                                },
                            ],
                        },
                    },
                ],
            }), { status: 200, headers: { "Content-Type": "application/json" } });
        });
        const result = await runAgentLoop(session.id, "算无限循环");
        assert.equal(result.loopCount, 6);
        assert.ok(result.finalAnswer.includes("已达最大循环次数"));
    });
});
//# sourceMappingURL=agent.runtime.test.js.map