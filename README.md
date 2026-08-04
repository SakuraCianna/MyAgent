# 最小可用 Agent Runtime (光辰智能)

一个从零实现、**不依赖 langgraph/openhands 等现成 Agent 框架**的轻量级 Agent Runtime 项目。支持基础 Loop 循环、OpenAI function calling 格式的工具调用机制、Session 管理、上下文自动压缩、多轮对话追问、异常处理、Trace 日志追溯，并配套完整单元测试用例。

---

## 🛠️ 技术选型

- **LLM API**：DeepSeek Chat Completions (OpenAI 兼容协议，使用原生 `fetch` 对接)
- **后端**：Express + TypeScript
- **数据库**：Node 24 原生内置 `node:sqlite` (包含 sessions, messages, todos, trace_logs 4 张持久化数据表)
- **前端**：React + TypeScript + Vite (遵循 CSS Modules 局部组件样式隔离与 Material Design 3 风格)
- **测试框架**：Node 原生 `node:test` + `node:assert`

---

## 🧩 6 大内置工具

1. **`calculator`**：数学表达式求值计算器（带安全语法树求值，处理除零等异常）。
2. **`search`**：网络搜索（支持 Tavily API，若未配置 `TAVILY_API_KEY` 则自动平滑降级为本地 Mock 兜底）。
3. **`weather`**：Mock 天气查询（根据城市名哈希生成确定性的温度与天气状况）。
4. **`todo`**：待办事项增删查改（CRUD），按 `sessionId` 隔离保存于 SQLite。
5. **`read_docs`**：本地示例文档读取与关键字检索工具。
6. **扩展类工具组**：
   - **`code_executor`**：受限的简单 JavaScript 沙箱执行器（使用 `node:vm` 隔离上下文，禁用 `process` / `fs` / `require` 等危险宿主对象）。
   - **`github_reader`**：通过用户提供的 GitHub Personal Access Token 读取远程仓库文件、目录及 README。
   
   > 💡 **ChatGPT 风格 GitHub 图标交互**：GitHub 工具拥有独立且贴近 ChatGPT 的开关控制。用户点击输入框旁的 GitHub 图标，可弹出面板配置 Token 与 仓库 (owner/repo)。未开启或未提供 Token 时，Agent 完全不带 `github_reader` 的 Schema 结构；Token 仅在内存状态 Map 中保存（不落库存明文），开启后图标高亮显示绿点状态指示。

---

## 🏗️ 核心机制设计

### 1. Agent Runtime Loop
```
[接收用户输入]
       │
[存储 User Message & 自动上下文压缩 check]
       │
┌──> [构造 Prompt (含 System Message, 历史上下文, Active Tools Schema)]
│      │
│    [调用 DeepSeek API (OpenAI Function Calling)]
│      │
│    [解析 Message 输出: 思考过程 / 工具调用 / 最终答案]
│      │
│    ├──(无 tool_calls)──> [存 Assistant 消息 & 返回最终答案] (结束)
│      │
│    └──(有 tool_calls)──> [存 Assistant 调用意图 -> 顺序执行工具 -> 存 Tool 结果]
│                              │
│                              └───(Loop Count + 1 < MAX_LOOP) ───┘
```
- **决策机制**：完全依靠 DeepSeek function calling 协议标准判别直接回复与工具调用。
- **防止死循环**：单次用户提问内部最大工具轮次硬约束为 `MAX_LOOP_COUNT = 6`。超出后输出友好提示并终止循环。

### 2. Context 管理与压缩
- **追问与多轮**：每次交互将 Session 下历史消息整体存入 SQLite。
- **基础压缩策略**：按字符数估算上下文体积，当超过 8000 字符时，自动保留最前面的 System Prompt 以及最近 6 条消息原文，将中间更早的消息折叠压缩为一条历史摘要 System Message，避免撑爆 LLM 上下文窗口。
- **工具结果截断**：对于工具返回的大段文本/JSON（如读取大文件），在喂回 context 前做 3000 字符的截断保护。

### 3. Trace 运行轨迹
- 每次 Loop 启动、LLM 请求/响应、工具调用与结果均产生结构化日志，同步落入 SQLite `trace_logs` 表与控制台。
- 前端集成可折叠的 `ToolTraceView` 组件，可以实时展开查看 Agent 的思考与工具调用轨迹。

---

## 🚀 快速启动

### 1. 环境准备与配置

复制并填写环境变量配置文件：
```bash
cp backend/.env.example backend/.env
```
在 `backend/.env` 中配置你的 `DEEPSEEK_API_KEY`：
```env
# DeepSeek API 密钥，用于 Agent 核心 LLM 调用
DEEPSEEK_API_KEY=your_deepseek_api_key_here
# DeepSeek API 基础地址
DEEPSEEK_BASE_URL=https://api.deepseek.com
# Tavily 搜索 API 密钥（可选，留空自动降级为 Mock 数据）
TAVILY_API_KEY=
# 后端服务监听端口
PORT=3001
```

### 2. 启动后端

```bash
cd backend
npm install
npm run dev
```
后端服务将运行在 `http://localhost:3001`。

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```
在浏览器中打开 Vite 提示的本地地址（如 `http://localhost:5173`）即可体验。

### 4. 运行后端单元测试

```bash
cd backend
npm test
```
将运行基于 `node:test` 的 25 个自动化测试用例，覆盖：
- Loop 决策（直接回复 vs 工具调用 vs 轮次上限）
- 6 个工具的功能单测与边界处理
- Context 压缩与截断
- 多 Session 独立隔离
- GitHub 工具动态带入/移除 Schema 与内存 Token 管理

---

## 📁 目录结构

```
光辰智能/
├── 题目要求.md
├── README.md                      # 项目说明与架构指南
├── .gitignore
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                # Express 启动入口
│   │   ├── db/
│   │   │   ├── client.ts           # node:sqlite 封装与 PRAGMA WAL 模式设置
│   │   │   └── schema.sql          # 数据库 schema 表结构
│   │   ├── llm/
│   │   │   ├── deepseekClient.ts   # DeepSeek HTTP 客户端
│   │   │   └── types.ts            # LLM 消息/工具 Schema 类型
│   │   ├── agent/
│   │   │   ├── runtime.ts          # Agent Runtime Loop 主循环
│   │   │   ├── contextManager.ts   # 上下文压缩与截断策略
│   │   │   ├── outputParser.ts     # 模型输出解析
│   │   │   └── trace.ts            # Trace 日志记录
│   │   ├── tools/                  # 6 个工具定义与注册表
│   │   ├── session/                # Session 隔离与 GitHub Token 内存库
│   │   └── routes/                 # RESTful API 路由
│   └── test/                       # node:test 单元测试用例
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx                 # 主界面入口
        ├── api/client.ts           # 后端 REST API 封装
        ├── components/
        │   ├── ChatWindow.tsx      # ChatGPT 风格聊天窗口（含 GitHub 按钮与 Popover）
        │   ├── SessionSidebar.tsx  # 多会话侧边栏
        │   └── ToolTraceView.tsx   # Agent 思考与 Trace 轨迹展示组件
        └── styles/                 # Material Design 3 全局变量与组件 CSS Modules
```
