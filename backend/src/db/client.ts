import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../../data");

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = process.env.DB_PATH || path.join(dataDir, "agent.db");
    dbInstance = new DatabaseSync(dbPath);

    // 启动时执行 schema.sql 完成建表（幂等，CREATE TABLE IF NOT EXISTS）
    const schemaPath = path.resolve(__dirname, "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");
    dbInstance.exec(schemaSql);

    // 增加表列自动迁移升级检测（对旧库补充 reasoning_content 列）
    try {
      dbInstance.exec("ALTER TABLE messages ADD COLUMN reasoning_content TEXT;");
    } catch {
      // 列如果已存在则忽略
    }

    // 开启外键约束与 WAL 模式（内存数据库不开启 WAL）
    dbInstance.exec("PRAGMA foreign_keys = ON;");
    if (dbPath !== ":memory:") {
      dbInstance.exec("PRAGMA journal_mode = WAL;");
    }
    dbInstance.exec("PRAGMA busy_timeout = 5000;");

    console.log(`[db] SQLite 已初始化: ${dbPath}`);
  }
  return dbInstance;
}
