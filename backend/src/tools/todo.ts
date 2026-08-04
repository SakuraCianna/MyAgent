// todo 工具：待办事项增删查改，按 session 隔离落库
import { randomUUID } from "node:crypto";
import { getDb } from "../db/client.js";
import { registerTool } from "./registry.js";

interface TodoRow {
  id: string;
  session_id: string;
  content: string;
  done: number;
  created_at: string;
  updated_at: string;
}

function listTodos(sessionId: string): TodoRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, session_id, content, done, created_at, updated_at FROM todos WHERE session_id = ? ORDER BY created_at ASC`
    )
    .all(sessionId) as unknown as TodoRow[];
}

function toDto(row: TodoRow) {
  return {
    id: row.id,
    content: row.content,
    done: row.done === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

registerTool({
  name: "todo",
  description:
    "管理待办事项列表：支持 add(新增)、list(查看全部)、complete(标记完成)、delete(删除) 四种操作，均按当前会话隔离，不会影响其他会话的待办。",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["add", "list", "complete", "delete"],
        description: "要执行的操作类型",
      },
      content: {
        type: "string",
        description: "待办内容，仅 action=add 时需要",
      },
      id: {
        type: "string",
        description: "待办事项 id，action=complete 或 delete 时需要",
      },
    },
    required: ["action"],
  },
  execute: async (args, ctx) => {
    const action = String(args.action ?? "");
    const db = getDb();

    switch (action) {
      case "add": {
        const content = String(args.content ?? "").trim();
        if (!content) throw new Error("新增待办需要提供 content 参数");
        const id = randomUUID();
        db.prepare(
          `INSERT INTO todos (id, session_id, content) VALUES (?, ?, ?)`
        ).run(id, ctx.sessionId, content);
        return { action, added: { id, content, done: false } };
      }
      case "list": {
        const rows = listTodos(ctx.sessionId);
        return { action, todos: rows.map(toDto) };
      }
      case "complete": {
        const id = String(args.id ?? "");
        if (!id) throw new Error("标记完成需要提供 id 参数");
        const info = db
          .prepare(
            `UPDATE todos SET done = 1, updated_at = datetime('now') WHERE id = ? AND session_id = ?`
          )
          .run(id, ctx.sessionId);
        if (info.changes === 0) throw new Error(`未找到待办事项 id=${id}`);
        return { action, completedId: id };
      }
      case "delete": {
        const id = String(args.id ?? "");
        if (!id) throw new Error("删除待办需要提供 id 参数");
        const info = db
          .prepare(`DELETE FROM todos WHERE id = ? AND session_id = ?`)
          .run(id, ctx.sessionId);
        if (info.changes === 0) throw new Error(`未找到待办事项 id=${id}`);
        return { action, deletedId: id };
      }
      default:
        throw new Error(`不支持的 action: ${action}，仅支持 add/list/complete/delete`);
    }
  },
});
