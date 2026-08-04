-- sessions 表：每个独立会话窗口对应一条记录
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '新会话',
  github_enabled INTEGER NOT NULL DEFAULT 0,
  github_repo TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- messages 表：会话内的完整消息历史（user/assistant/tool/system）
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- user | assistant | tool | system
  content TEXT,
  tool_calls_json TEXT, -- assistant 消息中携带的工具调用意图（JSON 数组）
  tool_call_id TEXT,    -- tool 消息对应的调用 id
  tool_name TEXT,       -- tool 消息对应的工具名（便于展示）
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);

-- todos 表：待办事项，按 session 隔离
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_todos_session ON todos(session_id);

-- trace_logs 表：Agent 执行轨迹（每轮 loop / LLM 调用 / 工具调用）
CREATE TABLE IF NOT EXISTS trace_logs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  loop_index INTEGER NOT NULL,
  type TEXT NOT NULL, -- loop_start | llm_request | llm_response | tool_call | tool_result | tool_error | final_answer | max_loop_reached
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trace_session ON trace_logs(session_id, created_at);
