// Session 管理：创建/查询/隔离，并支持全局与会话级 GitHub Token 管理
import { randomUUID } from "node:crypto";
import { getDb } from "../db/client.js";

export interface SessionRow {
  id: string;
  title: string;
  github_enabled: number;
  github_repo: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionDto {
  id: string;
  title: string;
  githubEnabled: boolean;
  githubRepo: string | null;
  githubConnected: boolean; // 是否在内存中持有有效 token
  createdAt: string;
  updatedAt: string;
}

// 内存态：会话特定 token 与 全局 Token 共享（填一次全局所有会话均共享）
const githubTokenStore = new Map<string, string>();
let globalGithubToken: string | null = null;
let globalGithubRepo: string | null = null;

export function createSession(title?: string): SessionDto {
  const db = getDb();
  const id = randomUUID();
  const finalTitle = title?.trim() || "新会话";
  const hasGlobalToken = Boolean(globalGithubToken);

  db.prepare(
    `INSERT INTO sessions (id, title, github_enabled, github_repo) VALUES (?, ?, ?, ?)`
  ).run(id, finalTitle, hasGlobalToken ? 1 : 0, globalGithubRepo);

  return getSessionOrThrow(id);
}

export function listSessions(): SessionDto[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT * FROM sessions ORDER BY updated_at DESC`)
    .all() as unknown as SessionRow[];
  return rows.map(toDto);
}

export function getSession(id: string): SessionDto | undefined {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as unknown as
    | SessionRow
    | undefined;
  return row ? toDto(row) : undefined;
}

export function getSessionOrThrow(id: string): SessionDto {
  const session = getSession(id);
  if (!session) throw new Error(`会话不存在: ${id}`);
  return session;
}

export function touchSession(id: string): void {
  const db = getDb();
  db.prepare(`UPDATE sessions SET updated_at = datetime('now') WHERE id = ?`).run(id);
}

export function renameSession(id: string, title: string): SessionDto {
  const db = getDb();
  const info = db
    .prepare(`UPDATE sessions SET title = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(title.trim() || "新会话", id);
  if (info.changes === 0) throw new Error(`会话不存在: ${id}`);
  return getSessionOrThrow(id);
}

export function deleteSession(id: string): void {
  const db = getDb();
  const info = db.prepare(`DELETE FROM sessions WHERE id = ?`).run(id);
  if (info.changes === 0) throw new Error(`会话不存在: ${id}`);
  githubTokenStore.delete(id);
}

/**
 * 设置该 session 的 GitHub 连接状态。
 * Token 只需首次填写一次，后续修改配置可留空自动保持已保存的 Token！
 */
export function setGithubConnection(
  id: string,
  opts: { enabled: boolean; token?: string; repo?: string }
): SessionDto {
  const db = getDb();
  const session = getSessionOrThrow(id);

  if (opts.enabled) {
    const tokenVal = opts.token?.trim();
    if (tokenVal) {
      globalGithubToken = tokenVal;
      githubTokenStore.set(id, tokenVal);
    } else {
      const existingToken = githubTokenStore.get(id) || globalGithubToken;
      if (!existingToken) {
        throw new Error("启用 GitHub 连接需要提供 Token");
      }
    }

    const repo = opts.repo !== undefined ? (opts.repo.trim() || null) : (session.githubRepo || globalGithubRepo);
    if (repo && !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
      throw new Error("仓库格式不正确，应为 owner/repo 形式");
    }

    if (opts.repo?.trim()) {
      globalGithubRepo = opts.repo.trim();
    }

    db.prepare(
      `UPDATE sessions SET github_enabled = 1, github_repo = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(repo, id);
  } else {
    globalGithubToken = null;
    globalGithubRepo = null;
    githubTokenStore.delete(id);
    db.prepare(
      `UPDATE sessions SET github_enabled = 0, github_repo = NULL, updated_at = datetime('now') WHERE id = ?`
    ).run(id);
  }

  return getSessionOrThrow(id);
}

export function getGithubContext(id: string): {
  githubEnabled: boolean;
  githubToken?: string;
  githubRepo?: string;
} {
  const session = getSession(id);
  if (!session) return { githubEnabled: false };

  const token = githubTokenStore.get(id) || globalGithubToken;
  if (!token) {
    return { githubEnabled: false };
  }

  const repo = session.githubRepo ?? globalGithubRepo ?? undefined;
  return { githubEnabled: true, githubToken: token, githubRepo: repo };
}

function toDto(row: SessionRow): SessionDto {
  const hasToken = githubTokenStore.has(row.id) || Boolean(globalGithubToken);
  const repo = row.github_repo ?? globalGithubRepo;
  return {
    id: row.id,
    title: row.title,
    githubEnabled: row.github_enabled === 1 || Boolean(globalGithubToken),
    githubRepo: repo,
    githubConnected: hasToken,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
