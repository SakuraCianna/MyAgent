# 最小可用 Agent Runtime (光辰智能)

一个从零实现、**不依赖 langgraph/openhands 等现成 Agent 框架**的轻量级 Agent Runtime 项目。支持基础 Loop 循环、OpenAI function calling 格式的工具调用机制、**SSE 真实流式输出（打字机效果）**、Session 管理、上下文自动压缩、多轮对话追问、异常处理、Trace 日志追溯，并配套完整单元测试用例。

---

## 🛠️ 技术选型

- **LLM API**：DeepSeek Chat Completions (OpenAI 兼容协议，使用原生 `fetch` 对接；支持 `stream: true` SSE 真实流式)
- **后端**：Express + TypeScript
- **数据库**：Node 24 原生内置 `node:sqlite` (包含 sessions, messages, todos, trace_logs 4 张持久化数据表)
- **前端**：React + TypeScript + Vite (遵循 CSS Modules 局部组件样式隔离与 Material Design 3 风格)
- **测试框架**：Node 原生 `node:test` + `node:assert`

---

## 🧩 9 大内置工具

工具可通过输入框中的 **`@` 快捷键** 呼出选单（Google MD3 风格卡片）快速指定：

1. **`calculator`**：数学表达式求值计算器（带安全语法树求值，处理除零等异常）。
2. **`search`**：网络搜索（支持 Tavily API，若未配置 `TAVILY_API_KEY` 则自动平滑降级为本地 Mock 兜底）。
3. **`weather`**：Mock 天气查询（根据城市名哈希生成确定性的温度与天气状况，前端渲染高颜值动态天气卡片）。
4. **`todo`**：待办事项增删查改（CRUD），按 `sessionId` 隔离保存于 SQLite。
5. **`read_docs`**：本地示例文档读取与关键字检索工具。
6. **`code_executor`**：多语言代码沙箱执行器：
   - JavaScript 使用 `node:vm` 隔离上下文（禁用 `process`/`fs`/`require` 等危险宿主对象）
   - **HTML/CSS/JS**：支持引用 CDN 三方库（如 `three.js`、`Chart.js`、`D3.js`），生成完整可预览网页（代码体积上限 20000 字符）
   - Python / Java / C / C++ 语法检查与静态分析
7. **`github_reader`**：通过用户提供的 GitHub Personal Access Token 执行 10 种只读操作（列出仓库、查看文件/目录/README/Issues/PR/Commits/搜索代码等），支持单仓库名智能补全用户名前缀。
8. **`web_fetcher`**：抓取任意 HTTP/HTTPS 网页正文，自动清洗 HTML 标签提取干净文本。
9. **`chart_generator`**：生成柱状图、折线图、饼图的交互式 SVG 数据可视化卡片。

> 💡 **ChatGPT 风格 GitHub 图标交互**：GitHub 工具拥有独立且贴近 ChatGPT 的开关控制。Token 仅在内存 Map 中保存（不落库存明文），开启后图标高亮绿点显示。

> 🎨 **`@` 快捷工具选单**：在输入框中输入 `@` 即可呼出 Google Material You 风格的工具卡片选单，支持 ↑↓ 键切换、Enter/Tab/点击确认，自动填入 `@tool_name`。

> 🖼️ **文件 / 图片 OCR 上传**：通过 `+` 菜单上传文本文件或图片，图片自动进行本地 Canvas OCR 识别并将文字填入输入框。

---

## 🏗️ 核心机制设计

### 1. Agent Runtime Loop（含 SSE 流式版本）

```
[接收用户输入]
       │
[存储 User Message & 自动上下文压缩 check]
       │
┌──> [构造 Prompt (含 System Message, 历史上下文, Active Tools Schema)]
│      │
│    [调用 DeepSeek API (stream: true SSE / 非流式两种模式)]
│      │
│      ├──(工具调用轮次)──> 非流式调用，获取 tool_calls 结构
│      │                    推送 SSE: { type: "tool_call", data: { name } }
│      │                    执行工具，推送 { type: "tool_result" }
│      │                    Loop Count + 1 ──────────────────────────────┘
│      │
│    └──(最终回答轮次)──> 流式 SSE 调用，逐 token 推送 { type: "token", data: "..." }
│                          全部推送完毕后推送 { type: "done", data: { loopCount } }
│
前端读取 SSE 流，逐 token 追加到 assistant 消息气泡，实现打字机效果
```

- **两条路由**：`POST /api/chat`（非流式，向后兼容）与 `POST /api/chat/stream`（SSE 流式，前端默认使用）。
- **防止死循环**：最大工具轮次硬约束 `MAX_LOOP_COUNT = 6`，超出后输出友好提示并终止。

### 2. Context 管理与压缩

- **追问与多轮**：每次交互将 Session 下历史消息整体存入 SQLite，支持带工具结果的多轮追问。
- **基础压缩策略**：当上下文超过 8000 字符时，自动保留 System Prompt 与最近 6 条消息，将更早的消息折叠为一条历史摘要，避免撑爆 LLM 上下文窗口（可节省 70%+ Token）。
- **工具结果截断**：对工具返回的大段文本/JSON 在喂回 context 前做 3000 字符截断保护。
- **手动压缩**：前端 `+` 菜单支持一键触发上下文压缩。

### 3. Trace 运行轨迹

每次 Loop 启动、LLM 请求/响应、工具调用与结果均产生结构化日志，同步落入 SQLite `trace_logs` 表与控制台（`[trace]` 前缀）。前端集成可折叠的 `ToolTraceView` 组件，可实时展开查看 Agent 的思考与工具调用轨迹。

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
将运行基于 `node:test` 的 **38 个**自动化测试用例，覆盖：
- Loop 决策（直接回复 vs 工具调用 vs 轮次上限）
- 9 个工具的功能单测与边界处理
- Context 压缩与截断
- 多 Session 独立隔离
- GitHub 工具动态带入/移除 Schema 与内存 Token 管理
- Trace 日志写入与反序列化

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
│   │   ├── index.ts                # Express 启动入口（注册所有路由）
│   │   ├── db/
│   │   │   ├── client.ts           # node:sqlite 惰性单例封装（支持 :memory: 测试隔离）
│   │   │   └── schema.sql          # 数据库 schema 表结构
│   │   ├── llm/
│   │   │   ├── deepseekClient.ts   # DeepSeek HTTP 客户端（非流式 + SSE 流式）
│   │   │   └── types.ts            # LLM 消息/工具 Schema 类型
│   │   ├── agent/
│   │   │   ├── runtime.ts          # Agent Runtime Loop 主循环（含 SSE 流式版本）
│   │   │   ├── contextManager.ts   # 上下文压缩与截断策略
│   │   │   ├── outputParser.ts     # 模型输出解析
│   │   │   └── trace.ts            # Trace 日志记录
│   │   ├── tools/                  # 9 个工具定义与注册表（含 @ 快捷选单支持）
│   │   ├── session/                # Session 隔离与 GitHub Token 内存库
│   │   └── routes/
│   │       ├── chat.ts             # POST /api/chat 非流式路由
│   │       ├── chatStream.ts       # POST /api/chat/stream SSE 流式路由
│   │       ├── sessions.ts         # Session CRUD 路由
│   │       └── tools.ts            # 工具列表路由
│   └── test/                       # node:test 单元测试用例（38 个）
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx                 # 主界面入口（SSE 流式接收与打字机渲染）
        ├── api/client.ts           # 后端 REST API 封装（含 sendMessageStream）
        ├── components/
        │   ├── ChatWindow.tsx      # ChatGPT 风格聊天窗口（@ 快捷选单、文件 OCR 上传）
        │   ├── SessionSidebar.tsx  # 多会话侧边栏
        │   ├── MarkdownRenderer.tsx # 富文本渲染（含 weather/chart 卡片拦截）
        │   ├── WeatherCard.tsx     # 动态天气卡片（60fps 热浪波纹动画）
        │   ├── ChartCard.tsx       # 交互式 SVG 数据图表卡片
        │   └── ToolTraceView.tsx   # Agent 思考与 Trace 轨迹展示组件
        └── styles/                 # Material Design 3 全局变量与组件 CSS Modules
```
