// github_reader 工具：通过用户授权的 GitHub Token 开展丰富的只读读取操作
// 支持：用户仓库列表(list_user_repos)、用户信息(user_info)、目录结构(list_dir)、文件读取(read_file)、README(readme)、
// Issues 列表(list_issues)、Issue 详情(read_issue)、PR 列表(list_prs)、提交历史(list_commits) 以及 代码搜索(search_code)。
import { registerTool } from "./registry.js";

const GITHUB_API_BASE = "https://api.github.com";

interface GithubContentItem {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
}

interface GithubRepoItem {
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  private: boolean;
  updated_at: string;
  html_url: string;
}

async function githubRequest(
  endpoint: string,
  token: string
): Promise<unknown> {
  const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "min-agent-runtime",
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("GitHub Token 无效或权限不足，请检查 Token 是否正确/未过期");
  }
  if (response.status === 404) {
    throw new Error("未找到指定的仓库/路径/资源，请检查 repo/path 是否正确");
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`GitHub API 返回错误状态 ${response.status}: ${text.slice(0, 200)}`);
  }

  return response.json();
}

/**
 * 智能解析 owner/repo 路径：
 * 1. 如果用户输入已经是 owner/repo，直接使用；
 * 2. 如果用户只输入了 repo 名称（如 'labex'），自动通过 API 获取当前登录的用户 login 并拼接成 'username/labex'；
 * 3. 如果用户未指定 repo，且未在设置中配置默认 repo，自动列出该 Token 下的仓库列表并匹配同名仓库或回退到默认仓库。
 */
async function resolveRepo(
  rawInput: string | undefined,
  token: string,
  defaultRepo?: string | null
): Promise<{ repo: string; userLogin: string }> {
  const input = rawInput?.trim();
  let userLogin = "";

  try {
    const userProfile = (await githubRequest("/user", token)) as { login?: string };
    if (userProfile.login) userLogin = userProfile.login;
  } catch {
    // 忽略用户接口失败，仅依赖显式参数
  }

  // 情况 1：显式提供了完整 owner/repo
  if (input && /^[\w.-]+\/[\w.-]+$/.test(input)) {
    return { repo: input, userLogin };
  }

  // 情况 2：显式提供了仓库单名（如 "labex"），且自动获取到了 userLogin，拼装成 username/labex
  if (input && !input.includes("/") && userLogin) {
    return { repo: `${userLogin}/${input}`, userLogin };
  }

  // 情况 3：未指定 input 且配置了默认 defaultRepo 时使用 defaultRepo
  if (!input && defaultRepo && defaultRepo.trim() && defaultRepo.trim().includes("/")) {
    return { repo: defaultRepo.trim(), userLogin };
  }

  // 情况 4：如果只提供了单名且未能自动获取 userLogin，说明凭证异常
  if (input) {
    throw new Error(`无法自动识别用户账号名，请填写完整 owner/repo，例如 'yourname/${input}'`);
  }

  throw new Error("未指定目标仓库。请提供 owner/repo 格式名称，或直接询问“我的仓库列表”");
}

registerTool({
  name: "github_reader",
  description:
    "通过授权的 GitHub Token 读取仓库信息与代码内容。支持操作：list_user_repos(查看账号下的仓库列表)、user_info(查看用户账号信息)、list_dir(列出目录)、read_file(读取文件)、readme(读取 README)、list_issues(查看 Issues)、read_issue(查看 Issue 评论)、list_prs(查看 Pull Requests)、list_commits(查看提交历史)、search_code(在仓库中搜索代码)。",
  requiresToggle: "github",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: [
          "list_user_repos",
          "user_info",
          "list_dir",
          "read_file",
          "readme",
          "list_issues",
          "read_issue",
          "list_prs",
          "list_commits",
          "search_code",
        ],
        description: "要执行的操作类型",
      },
      repo: {
        type: "string",
        description:
          "目标仓库名称 (支持完整 owner/repo 格式或单仓库名如 'labex'，单仓库名会自动绑定当前用户)",
      },
      path: {
        type: "string",
        description: "仓库内的文件或目录路径，例如 'src/index.ts'；action=list_dir 时可省略表示根目录",
      },
      issue_number: {
        type: "number",
        description: "action=read_issue 时指定的 Issue 编号",
      },
      query: {
        type: "string",
        description: "action=search_code 时的搜索关键字",
      },
    },
    required: ["action"],
  },
  execute: async (args, ctx) => {
    if (!ctx.githubToken) {
      throw new Error("GitHub 未连接或 Token 缺失，请先在前端点击 GitHub 图标完成授权配置");
    }

    const action = String(args.action ?? "");
    const token = ctx.githubToken;

    // 1. 列出当前 Token 用户下的所有 GitHub 仓库列表
    if (action === "list_user_repos") {
      const data = (await githubRequest(
        "/user/repos?sort=updated&per_page=30&affiliation=owner,collaborator,organization_member",
        token
      )) as GithubRepoItem[];

      return {
        action,
        count: data.length,
        repos: data.map((r) => ({
          name: r.name,
          full_name: r.full_name,
          description: r.description,
          language: r.language,
          stars: r.stargazers_count,
          forks: r.forks_count,
          private: r.private,
          updated_at: r.updated_at,
          url: r.html_url,
        })),
      };
    }

    // 2. 查看当前登录的 GitHub 用户个人资料
    if (action === "user_info") {
      const user = (await githubRequest("/user", token)) as {
        login: string;
        name: string | null;
        bio: string | null;
        public_repos: number;
        html_url: string;
      };
      return { action, user };
    }

    // 对于需指定仓库的操作，自动进行智能补全与映射
    const { repo, userLogin } = await resolveRepo(
      args.repo ? String(args.repo) : undefined,
      token,
      ctx.githubRepo
    );

    const path = args.path ? String(args.path).replace(/^\/+/, "") : "";

    switch (action) {
      case "list_dir": {
        const endpoint = `/repos/${repo}/contents/${path}`;
        const data = await githubRequest(endpoint, token);
        const items = Array.isArray(data) ? (data as GithubContentItem[]) : [data as GithubContentItem];
        return {
          action,
          repo,
          userLogin,
          path: path || "/",
          items: items.map((i) => ({ name: i.name, path: i.path, type: i.type, size: i.size })),
        };
      }
      case "read_file": {
        if (!path) throw new Error("read_file 操作需要提供 path 参数");
        const endpoint = `/repos/${repo}/contents/${path}`;
        const data = (await githubRequest(endpoint, token)) as {
          type: string;
          content?: string;
          encoding?: string;
          name: string;
        };
        if (data.type !== "file" || !data.content) {
          throw new Error(`路径 ${path} 不是文件或无法读取内容`);
        }
        const decoded = Buffer.from(data.content, (data.encoding as BufferEncoding) ?? "base64").toString("utf-8");
        return {
          action,
          repo,
          path,
          content: decoded.slice(0, 6000),
          truncated: decoded.length > 6000,
        };
      }
      case "readme": {
        const endpoint = `/repos/${repo}/readme`;
        const data = (await githubRequest(endpoint, token)) as {
          content?: string;
          encoding?: string;
          name: string;
        };
        if (!data.content) {
          throw new Error(`仓库 ${repo} 没有 README 文件`);
        }
        const decoded = Buffer.from(data.content, (data.encoding as BufferEncoding) ?? "base64").toString("utf-8");
        return {
          action,
          repo,
          filename: data.name,
          content: decoded.slice(0, 6000),
          truncated: decoded.length > 6000,
        };
      }
      case "list_issues": {
        const endpoint = `/repos/${repo}/issues?state=all&per_page=20`;
        const data = (await githubRequest(endpoint, token)) as Array<{
          number: number;
          title: string;
          state: string;
          user: { login: string };
          comments: number;
          created_at: string;
        }>;
        return {
          action,
          repo,
          issues: data.map((i) => ({
            number: i.number,
            title: i.title,
            state: i.state,
            author: i.user?.login,
            commentsCount: i.comments,
            created_at: i.created_at,
          })),
        };
      }
      case "read_issue": {
        const issueNum = Number(args.issue_number);
        if (!issueNum) throw new Error("read_issue 操作需要提供 issue_number 参数");
        const issueEndpoint = `/repos/${repo}/issues/${issueNum}`;
        const issueData = (await githubRequest(issueEndpoint, token)) as {
          number: number;
          title: string;
          body: string | null;
          state: string;
          user: { login: string };
          created_at: string;
        };
        const commentsEndpoint = `/repos/${repo}/issues/${issueNum}/comments`;
        const commentsData = (await githubRequest(commentsEndpoint, token)) as Array<{
          user: { login: string };
          body: string;
          created_at: string;
        }>;
        return {
          action,
          repo,
          issue: {
            number: issueData.number,
            title: issueData.title,
            author: issueData.user?.login,
            state: issueData.state,
            body: issueData.body,
            created_at: issueData.created_at,
          },
          comments: commentsData.map((c) => ({
            author: c.user?.login,
            body: c.body,
            created_at: c.created_at,
          })),
        };
      }
      case "list_prs": {
        const endpoint = `/repos/${repo}/pulls?state=all&per_page=20`;
        const data = (await githubRequest(endpoint, token)) as Array<{
          number: number;
          title: string;
          state: string;
          user: { login: string };
          created_at: string;
        }>;
        return {
          action,
          repo,
          pullRequests: data.map((pr) => ({
            number: pr.number,
            title: pr.title,
            state: pr.state,
            author: pr.user?.login,
            created_at: pr.created_at,
          })),
        };
      }
      case "list_commits": {
        const endpoint = `/repos/${repo}/commits?per_page=15`;
        const data = (await githubRequest(endpoint, token)) as Array<{
          sha: string;
          commit: {
            author: { name: string; date: string };
            message: string;
          };
        }>;
        return {
          action,
          repo,
          commits: data.map((c) => ({
            sha: c.sha.slice(0, 7),
            message: c.commit.message,
            author: c.commit.author?.name,
            date: c.commit.author?.date,
          })),
        };
      }
      case "search_code": {
        const query = String(args.query ?? "").trim();
        if (!query) throw new Error("search_code 操作需要提供 query 参数");
        const endpoint = `/search/code?q=${encodeURIComponent(query)}+repo:${repo}`;
        const data = (await githubRequest(endpoint, token)) as {
          total_count: number;
          items: Array<{ name: string; path: string; html_url: string }>;
        };
        return {
          action,
          repo,
          query,
          totalCount: data.total_count,
          items: (data.items ?? []).slice(0, 15).map((i) => ({ name: i.name, path: i.path, url: i.html_url })),
        };
      }
      default:
        throw new Error(`不支持的 action: ${action}`);
    }
  },
});
