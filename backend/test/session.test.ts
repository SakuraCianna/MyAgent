process.env.DB_PATH = ":memory:";
import test from "node:test";
import assert from "node:assert/strict";
import {
  createSession,
  getSession,
  getSessionOrThrow,
  listSessions,
  renameSession,
  deleteSession,
  setGithubConnection,
  getGithubContext,
} from "../src/session/sessionManager.js";

test("Session Manager Full Coverage Unit Test Suite", async (t) => {
  await t.test("createSession and getSession", () => {
    const s = createSession("测试会话");
    assert.ok(s.id);
    assert.equal(s.title, "测试会话");

    const fetched = getSession(s.id);
    assert.ok(fetched);
    assert.equal(fetched.id, s.id);
  });

  await t.test("getSessionOrThrow throws error for non-existent id", () => {
    assert.throws(() => getSessionOrThrow("non-existent-id"), /会话不存在/);
  });

  await t.test("listSessions returns created sessions", () => {
    const s1 = createSession("会话 1");
    const s2 = createSession("会话 2");
    const list = listSessions();

    assert.ok(list.some((item) => item.id === s1.id));
    assert.ok(list.some((item) => item.id === s2.id));
  });

  await t.test("renameSession updates session title", () => {
    const s = createSession("旧名称");
    const updated = renameSession(s.id, "新名称");
    assert.equal(updated.title, "新名称");

    // Empty title defaults to 新会话
    const updated2 = renameSession(s.id, "   ");
    assert.equal(updated2.title, "新会话");

    // Non-existent id throws
    assert.throws(() => renameSession("non-existent-id", "test"), /会话不存在/);
  });

  await t.test("deleteSession removes session and token, throws on non-existent id", () => {
    const s = createSession("待删除会话");
    deleteSession(s.id);
    assert.equal(getSession(s.id), undefined);

    assert.throws(() => deleteSession(s.id), /会话不存在/);
  });

  await t.test("setGithubConnection validations & toggle off", () => {
    const s = createSession("GitHub Validation Session");

    // Enabled missing token
    assert.throws(
      () => setGithubConnection(s.id, { enabled: true, repo: "owner/repo" }),
      /需要提供 Token/
    );

    // Enabled optional repo (token provided, repo omitted -> repo is null)
    const sessionNoRepo = setGithubConnection(s.id, { enabled: true, token: "token" });
    assert.strictEqual(sessionNoRepo.githubEnabled, true);
    assert.strictEqual(sessionNoRepo.githubRepo, null);

    // Enabled invalid repo format
    assert.throws(
      () => setGithubConnection(s.id, { enabled: true, token: "token", repo: "invalid" }),
      /仓库格式不正确/
    );

    // Valid enable
    const enabledSession = setGithubConnection(s.id, {
      enabled: true,
      token: "ghp_valid_token",
      repo: "owner/repo",
    });
    assert.equal(enabledSession.githubConnected, true);

    // Disable connection
    const disabledSession = setGithubConnection(s.id, { enabled: false });
    assert.equal(disabledSession.githubEnabled, false);
    assert.equal(disabledSession.githubConnected, false);
    assert.equal(getGithubContext(s.id).githubEnabled, false);
  });

  await t.test("getGithubContext returns disabled when session non-existent", () => {
    const ctx = getGithubContext("non-existent-id");
    assert.equal(ctx.githubEnabled, false);
  });
});
