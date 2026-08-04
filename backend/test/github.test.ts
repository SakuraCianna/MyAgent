process.env.DB_PATH = ":memory:";
import test from "node:test";
import assert from "node:assert/strict";
import { getActiveTools, registerAllTools, getTool } from "../src/tools/registry.js";
import { createSession, setGithubConnection } from "../src/session/sessionManager.js";

test("GitHub Reader & Registry Full Coverage Test Suite", async (t) => {
  await registerAllTools();
  const originalFetch = globalThis.fetch;

  t.afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  await t.test("getActiveTools excludes/includes github_reader based on toggle", () => {
    assert.equal(getActiveTools({ githubEnabled: false }).some((tool) => tool.name === "github_reader"), false);
    assert.equal(getActiveTools({ githubEnabled: true }).some((tool) => tool.name === "github_reader"), true);
  });

  await t.test("github_reader validates token & repo presence", async () => {
    const session = createSession("GitHub Validate Test");
    const ghTool = getTool("github_reader");
    assert.ok(ghTool);

    // Missing token
    await assert.rejects(
      async () => ghTool.execute({ action: "readme" }, { sessionId: session.id }),
      /GitHub 未连接或 Token 缺失/
    );

    // Missing repo when fetch /user fails
    globalThis.fetch = (async () => new Response("Unauthorized", { status: 401 })) as typeof fetch;
    await assert.rejects(
      async () => ghTool.execute({ action: "readme" }, { sessionId: session.id, githubToken: "token" }),
      /未指定目标仓库/
    );
  });

  await t.test("github_reader actions: list_user_repos, user_info, list_dir, read_file, readme, list_issues, list_prs, list_commits, search_code", async () => {
    const session = createSession("GitHub Actions Test");
    setGithubConnection(session.id, { enabled: true, token: "ghp_valid", repo: "facebook/react" });
    const ghTool = getTool("github_reader");
    assert.ok(ghTool);

    // Mock fetch for all endpoints
    globalThis.fetch = (async (url: string) => {
      if (url.endsWith("/user")) {
        return new Response(
          JSON.stringify({ login: "sakura", name: "Sakura", public_repos: 5, html_url: "https://github.com/sakura" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/user/repos")) {
        return new Response(
          JSON.stringify([
            { name: "labex", full_name: "sakura/labex", description: "LabEx project", language: "TypeScript", stargazers_count: 10, forks_count: 2, private: false, updated_at: "2026-08-04", html_url: "https://github.com/sakura/labex" },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/contents/src")) {
        return new Response(
          JSON.stringify([
            { name: "index.ts", path: "src/index.ts", type: "file", size: 100 },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/contents/README.md")) {
        return new Response(
          JSON.stringify({
            name: "README.md",
            type: "file",
            content: Buffer.from("# React Docs").toString("base64"),
            encoding: "base64",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/readme")) {
        return new Response(
          JSON.stringify({
            name: "README.md",
            content: Buffer.from("# React Repository").toString("base64"),
            encoding: "base64",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/issues")) {
        return new Response(
          JSON.stringify([{ number: 1, title: "Bug in component", state: "open", user: { login: "user1" }, comments: 2, created_at: "2026-08-01" }]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/pulls")) {
        return new Response(
          JSON.stringify([{ number: 2, title: "Fix memory leak", state: "open", user: { login: "user2" }, created_at: "2026-08-02" }]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/commits")) {
        return new Response(
          JSON.stringify([{ sha: "abcdef123456", commit: { author: { name: "Dev", date: "2026-08-03" }, message: "init" } }]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/search/code")) {
        return new Response(
          JSON.stringify({ total_count: 1, items: [{ name: "App.tsx", path: "src/App.tsx", html_url: "http://..." }] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
    }) as typeof fetch;

    // list_user_repos
    const reposRes = (await ghTool.execute(
      { action: "list_user_repos" },
      { sessionId: session.id, githubToken: "ghp_valid" }
    )) as { repos: Array<{ name: string }> };
    assert.equal(reposRes.repos[0].name, "labex");

    // user_info
    const userRes = (await ghTool.execute(
      { action: "user_info" },
      { sessionId: session.id, githubToken: "ghp_valid" }
    )) as { user: { login: string } };
    assert.equal(userRes.user.login, "sakura");

    // list_dir
    const listRes = (await ghTool.execute(
      { action: "list_dir", path: "src" },
      { sessionId: session.id, githubToken: "ghp_valid", githubRepo: "facebook/react" }
    )) as { items: Array<{ name: string }> };
    assert.equal(listRes.items[0].name, "index.ts");

    // 单仓库名智能自动拼接 username: repo="labex" => "sakura/labex"
    const singleRepoRes = (await ghTool.execute(
      { action: "readme", repo: "labex" },
      { sessionId: session.id, githubToken: "ghp_valid" }
    )) as { repo: string; content: string };
    assert.equal(singleRepoRes.repo, "sakura/labex");

    // read_file
    const fileRes = (await ghTool.execute(
      { action: "read_file", path: "README.md" },
      { sessionId: session.id, githubToken: "ghp_valid", githubRepo: "facebook/react" }
    )) as { content: string };
    assert.equal(fileRes.content, "# React Docs");

    // list_issues
    const issuesRes = (await ghTool.execute(
      { action: "list_issues" },
      { sessionId: session.id, githubToken: "ghp_valid", githubRepo: "facebook/react" }
    )) as { issues: Array<{ title: string }> };
    assert.equal(issuesRes.issues[0].title, "Bug in component");

    // list_prs
    const prsRes = (await ghTool.execute(
      { action: "list_prs" },
      { sessionId: session.id, githubToken: "ghp_valid", githubRepo: "facebook/react" }
    )) as { pullRequests: Array<{ title: string }> };
    assert.equal(prsRes.pullRequests[0].title, "Fix memory leak");

    // list_commits
    const commitsRes = (await ghTool.execute(
      { action: "list_commits" },
      { sessionId: session.id, githubToken: "ghp_valid", githubRepo: "facebook/react" }
    )) as { commits: Array<{ sha: string }> };
    assert.equal(commitsRes.commits[0].sha, "abcdef1");

    // search_code
    const searchRes = (await ghTool.execute(
      { action: "search_code", query: "App" },
      { sessionId: session.id, githubToken: "ghp_valid", githubRepo: "facebook/react" }
    )) as { totalCount: number };
    assert.equal(searchRes.totalCount, 1);
  });

  await t.test("github_reader API HTTP error statuses: 401, 404, 500", async () => {
    const session = createSession("GitHub Error Status Test");
    const ghTool = getTool("github_reader");
    assert.ok(ghTool);

    // 401 Token invalid
    globalThis.fetch = (async () => new Response("Unauthorized", { status: 401 })) as typeof fetch;
    await assert.rejects(
      async () =>
        ghTool.execute(
          { action: "readme" },
          { sessionId: session.id, githubToken: "invalid_token", githubRepo: "owner/repo" }
        ),
      /Token 无效或权限不足/
    );

    // 404 Not Found
    globalThis.fetch = (async () => new Response("Not Found", { status: 404 })) as typeof fetch;
    await assert.rejects(
      async () =>
        ghTool.execute(
          { action: "readme" },
          { sessionId: session.id, githubToken: "token", githubRepo: "owner/nonexistent" }
        ),
      /未找到指定的仓库\/路径\/资源/
    );

    // 500 Server Error
    globalThis.fetch = (async () => new Response("Internal Error", { status: 500 })) as typeof fetch;
    await assert.rejects(
      async () =>
        ghTool.execute(
          { action: "readme" },
          { sessionId: session.id, githubToken: "token", githubRepo: "owner/repo" }
        ),
      /GitHub API 返回错误状态 500/
    );
  });
});
