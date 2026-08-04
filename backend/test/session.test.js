import test from "node:test";
import assert from "node:assert/strict";
import { createSession, getSession, listSessions, deleteSession, setGithubConnection, getGithubContext, } from "../src/session/sessionManager.js";
test("Session Manager Unit Test Suite", async (t) => {
    await t.test("createSession and getSession", () => {
        const s = createSession("测试会话");
        assert.ok(s.id);
        assert.equal(s.title, "测试会话");
        const fetched = getSession(s.id);
        assert.ok(fetched);
        assert.equal(fetched.id, s.id);
    });
    await t.test("listSessions returns created sessions", () => {
        const s1 = createSession("会话 1");
        const s2 = createSession("会话 2");
        const list = listSessions();
        assert.ok(list.some((item) => item.id === s1.id));
        assert.ok(list.some((item) => item.id === s2.id));
    });
    await t.test("deleteSession removes session", () => {
        const s = createSession("待删除会话");
        deleteSession(s.id);
        const fetched = getSession(s.id);
        assert.equal(fetched, undefined);
    });
    await t.test("setGithubConnection updates session github state and memory token", () => {
        const s = createSession("GitHub 会话");
        const updated = setGithubConnection(s.id, {
            enabled: true,
            token: "ghp_fake_token_12345",
            repo: "octocat/Hello-World",
        });
        assert.equal(updated.githubEnabled, true);
        assert.equal(updated.githubConnected, true);
        assert.equal(updated.githubRepo, "octocat/Hello-World");
        const ctx = getGithubContext(s.id);
        assert.equal(ctx.githubEnabled, true);
        assert.equal(ctx.githubToken, "ghp_fake_token_12345");
        assert.equal(ctx.githubRepo, "octocat/Hello-World");
    });
});
//# sourceMappingURL=session.test.js.map