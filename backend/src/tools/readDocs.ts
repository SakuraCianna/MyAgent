// read_docs 工具：读取/检索 backend/data/docs 目录下的本地文档
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { registerTool } from "./registry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.resolve(__dirname, "../../data/docs");

function ensureDocsDir(): void {
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }
}

function listDocFiles(): string[] {
  ensureDocsDir();
  return fs
    .readdirSync(DOCS_DIR)
    .filter((f) => fs.statSync(path.join(DOCS_DIR, f)).isFile());
}

/** 防止路径穿越：只允许访问 DOCS_DIR 内的文件名（不允许 ../ 等） */
function resolveSafeDocPath(filename: string): string {
  const target = path.resolve(DOCS_DIR, filename);
  if (!target.startsWith(DOCS_DIR + path.sep) && target !== DOCS_DIR) {
    throw new Error("非法文件路径，不允许访问文档目录之外的文件");
  }
  return target;
}

registerTool({
  name: "read_docs",
  description:
    "读取本地文档目录（backend/data/docs）中的文件内容，或按关键词检索文档。action=list 列出所有文档；action=read 读取指定文件全文；action=search 按关键词在所有文档中做简单文本检索，返回命中片段。",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["list", "read", "search"],
        description: "要执行的操作类型",
      },
      filename: {
        type: "string",
        description: "文件名（不含路径），action=read 时必填",
      },
      keyword: {
        type: "string",
        description: "检索关键词，action=search 时必填",
      },
    },
    required: ["action"],
  },
  execute: async (args) => {
    const action = String(args.action ?? "");

    switch (action) {
      case "list": {
        const files = listDocFiles();
        return { action, files };
      }
      case "read": {
        const filename = String(args.filename ?? "").trim();
        if (!filename) throw new Error("read 操作需要提供 filename 参数");
        const target = resolveSafeDocPath(filename);
        if (!fs.existsSync(target)) {
          throw new Error(`文档不存在: ${filename}`);
        }
        const content = fs.readFileSync(target, "utf-8");
        return { action, filename, content: content.slice(0, 5000) };
      }
      case "search": {
        const keyword = String(args.keyword ?? "").trim();
        if (!keyword) throw new Error("search 操作需要提供 keyword 参数");
        ensureDocsDir();
        const files = listDocFiles();
        const matches: Array<{ filename: string; snippet: string }> = [];
        for (const filename of files) {
          const content = fs.readFileSync(path.join(DOCS_DIR, filename), "utf-8");
          const idx = content.indexOf(keyword);
          if (idx !== -1) {
            const start = Math.max(0, idx - 50);
            const end = Math.min(content.length, idx + keyword.length + 50);
            matches.push({ filename, snippet: content.slice(start, end) });
          }
        }
        return { action, keyword, matches };
      }
      default:
        throw new Error(`不支持的 action: ${action}，仅支持 list/read/search`);
    }
  },
});
