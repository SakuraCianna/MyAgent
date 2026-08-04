process.env.DB_PATH = ":memory:";
import test from "node:test";
import assert from "node:assert/strict";
import { logTrace, getTraceForSession } from "../src/agent/trace.js";
import { createSession } from "../src/session/sessionManager.js";

test("Trace Logging Unit Test Suite", async (t) => {
  await t.test("logTrace writes trace logs and getTraceForSession retrieves them", () => {
    const session = createSession("Trace Test Session");
    logTrace(session.id, 0, "loop_start", { loopCount: 0 });
    logTrace(session.id, 0, "llm_request", { prompt: "hello" });
    logTrace(session.id, 0, "final_answer", { finalAnswer: "world" });

    const trace = getTraceForSession(session.id);
    assert.equal(trace.length, 3);
    assert.equal(trace[0].type, "loop_start");
    assert.equal(trace[1].type, "llm_request");
    assert.equal(trace[2].type, "final_answer");
  });

  await t.test("logTrace handles non-serializable circular objects without crashing", () => {
    const session = createSession("Trace Circular Object Test");
    const circularObj: Record<string, unknown> = {};
    circularObj.self = circularObj;

    logTrace(session.id, 0, "error", circularObj);
    const trace = getTraceForSession(session.id);
    assert.ok(trace.length > 0);
  });
});
