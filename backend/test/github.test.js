import test from "node:test";
import assert from "node:assert/strict";
import { getActiveTools, registerAllTools, getTool } from "../src/tools/registry.js";
import { createSession, setGithubConnection } from "../src/session/sessionManager.js";
test("GitHub Reader & Registry Integration Unit Test Suite", async (t) => {
    await registerAllTools();
    await t.test("getActiveTools excludes github_reader when github is disabled", () => {
        const active = getActiveTools({ githubEnabled: false });
        assert.equal(active.some((tool) => tool.name === "github_reader"), false);
    });
    await t.test("getActiveTools includes github_reader when github is enabled", () => {
        const active = getActiveTools({ githubEnabled: true });
        assert.equal(active.some((tool) => tool.name === "github_reader"), true);
    });
    await t.test("github_reader handles missing token gracefully", async () => {
        const session = createSession("GitHub 无 Token 测试");
        setGithubConnection(session.id, {
            enabled: true,
            token: "ghp_mock_token",
            repo: "owner/repo",
        });
        const ghTool = getTool("github_reader");
        assert.ok(ghTool);
        await assert.rejects(async () => ghTool.execute({ action: "get_file", path: "README.md" }, { sessionId: session.id, githubToken: undefined, githubRepo: "owner/repo" }), /Token 缺失/);
    });
});
//# sourceMappingURL=github.test.js.map