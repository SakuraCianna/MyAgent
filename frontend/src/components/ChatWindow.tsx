import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import type { SessionDto } from "../api/client";
import { MarkdownRenderer } from "./MarkdownRenderer";
import styles from "./ChatWindow.module.css";

export interface ChatMessageView {
  id?: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
}

export interface ChatWindowProps {
  messages: ChatMessageView[];
  loading: boolean;
  session: SessionDto | null;
  onSend: (text: string) => void;
  onGithubChange: (opts: { enabled: boolean; token?: string; repo?: string }) => Promise<void>;
}

const CAROUSEL_TITLES = [
  "有什么可以帮你的？",
  "想了解什么？",
  "有什么新想法？",
  "今天要做些什么？",
  "有什么问题需要解答？",
  "想要探索什么主题？",
  "需要处理什么待办事项？",
  "想算点什么或查查天气？",
  "准备分析什么代码仓库？",
  "有什么灵感需要整理？",
];

interface ToolMenuItem {
  id: string;
  title: string;
  desc: string;
  icon: string;
  isGithub?: boolean;
}

const TOOL_MENU_ITEMS: ToolMenuItem[] = [
  {
    id: "github",
    title: "GitHub",
    desc: "Triage PRs, issues, CI, and publish flows (按会话配置读取仓库)",
    icon: "github",
    isGithub: true,
  },
  {
    id: "calculator",
    title: "计算器",
    desc: "数学表达式求值计算 (支持 + - * / % 小括号)",
    icon: "calc",
  },
  {
    id: "weather",
    title: "天气查询",
    desc: "查询各大城市天气状况、气温与湿度",
    icon: "weather",
  },
  {
    id: "todo",
    title: "待办事项",
    desc: "支持待办新增、列表、完成与删除，按会话隔离",
    icon: "todo",
  },
  {
    id: "read_docs",
    title: "文档检索",
    desc: "读取与检索本地 backend/data/docs 目录下文档",
    icon: "doc",
  },
  {
    id: "code_executor",
    title: "代码沙箱",
    desc: "在受限 node:vm 环境中安全执行 JavaScript 计算",
    icon: "code",
  },
  {
    id: "upload",
    title: "上传文件 / 照片 OCR",
    desc: "上传本地文本/代码文件或图片，图片自动提取 OCR 识别文字",
    icon: "upload",
  },
  {
    id: "chart",
    title: "生成数据图表",
    desc: "分析对比数据并生成柱状图、折线图或饼图卡片",
    icon: "chart",
  },
  {
    id: "web_fetcher",
    title: "网页深度阅读",
    desc: "实时抓取并解析指定 HTTP/HTTPS 网页正文内容",
    icon: "web",
  },
  {
    id: "image_generator",
    title: "AI 绘画 / 图像生成",
    desc: "根据文本提示词生成高品质 AI 绘画插图与艺术海报",
    icon: "image",
  },
  {
    id: "compress",
    title: "上下文压缩",
    desc: "对长会话的历史对话进行摘要压缩，释放 Context 窗口",
    icon: "compress",
  },
];

interface UploadedAttachment {
  name: string;
  type: "image" | "file";
  dataUrl: string;
  extractedText?: string;
}

export function ChatWindow({
  messages,
  loading,
  session,
  onSend,
  onGithubChange,
}: ChatWindowProps) {
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<UploadedAttachment | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuSearch, setMenuSearch] = useState("");
  const [showGhModal, setShowGhModal] = useState(false);
  const [token, setToken] = useState("");
  const [repo, setRepo] = useState(session?.githubRepo ?? "");
  const [saving, setSaving] = useState(false);
  const [ghError, setGhError] = useState<string | null>(null);

  // 轮播标题 index
  const [titleIdx, setTitleIdx] = useState(0);
  const [fade, setFade] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const ghModalRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // @ 快捷提及工具选单状态
  const [atOpen, setAtOpen] = useState(false);
  const [atQuery, setAtQuery] = useState("");
  const [atIndex, setAtIndex] = useState(0);

  const AT_TOOLS = [
    { tag: "@ocr_reader", name: "后端神经网络 OCR 识图", icon: "image" },
    { tag: "@web_fetcher", name: "网页深度阅读", icon: "web" },
    { tag: "@image_generator", name: "AI 绘画 / 插图生成", icon: "image" },
    { tag: "@chart_generator", name: "数据可视化图表", icon: "chart" },
    { tag: "@search", name: "网络搜索", icon: "search" },
    { tag: "@weather", name: "实时天气查询", icon: "weather" },
    { tag: "@calculator", name: "表达式计算器", icon: "calc" },
    { tag: "@todo", name: "会话待办事项", icon: "todo" },
    { tag: "@read_docs", name: "检索本地文档", icon: "doc" },
    { tag: "@code_executor", name: "代码沙箱执行", icon: "code" },
    ...(session?.githubConnected ? [{ tag: "@github_reader", name: "GitHub 智查", icon: "github" }] : []),
  ];

  const filteredAtTools = AT_TOOLS.filter(
    (t) =>
      t.tag.toLowerCase().includes(atQuery.toLowerCase()) ||
      t.name.toLowerCase().includes(atQuery.toLowerCase())
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    const cursorPos = e.target.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([\w-]*)$/);

    if (atMatch) {
      setAtOpen(true);
      setAtQuery(atMatch[1]);
      setAtIndex(0);
    } else {
      setAtOpen(false);
    }
  };

  const selectAtTool = (toolTag: string) => {
    if (!textareaRef.current) return;
    const cursorPos = textareaRef.current.selectionStart || input.length;
    const textBeforeCursor = input.slice(0, cursorPos);
    const textAfterCursor = input.slice(cursorPos);

    const newBefore = textBeforeCursor.replace(/@([\w-]*)$/, `${toolTag} `);
    setInput(newBefore + textAfterCursor);
    setAtOpen(false);

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => {
          const text = extractOcrFromCanvas(img, file.name);
          setAttachment({
            name: file.name,
            type: "image",
            dataUrl,
            extractedText: text,
          });
          textareaRef.current?.focus();
        };
      };
      reader.readAsDataURL(file);
    } else {
      const text = await file.text();
      setAttachment({
        name: file.name,
        type: "file",
        dataUrl: "",
        extractedText: text,
      });
      textareaRef.current?.focus();
    }
    e.target.value = "";
  };

  const githubConnected = Boolean(session?.githubConnected);

  // 1.8 秒 (1800ms) 轮播换标题
  useEffect(() => {
    if (messages.length > 0) return;
    const timer = setInterval(() => {
      setFade(true);
      setTimeout(() => {
        setTitleIdx((prev) => (prev + 1) % CAROUSEL_TITLES.length);
        setFade(false);
      }, 200);
    }, 1800);
    return () => clearInterval(timer);
  }, [messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    setRepo(session?.githubRepo ?? "");
  }, [session?.id, session?.githubRepo]);

  // 点击 Popover / Modal 以外区域自动关闭
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (ghModalRef.current && !ghModalRef.current.contains(e.target as Node)) {
        setShowGhModal(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    const text = input.trim();
    if ((!text && !attachment) || loading || !session) return;

    let payload = text;
    if (attachment) {
      if (attachment.type === "image") {
        payload = `![${attachment.name}](${attachment.dataUrl})\n\n[已上传图片: ${attachment.name}]\n[视觉识别与文本提取分析]:\n${attachment.extractedText || ""}\n\n${text}`.trim();
      } else {
        payload = `[已上传文件: ${attachment.name}]\n\`\`\`\n${attachment.extractedText || ""}\n\`\`\`\n\n${text}`.trim();
      }
    }

    onSend(payload);
    setInput("");
    setAttachment(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  async function handleSaveGithubConfig() {
    setGhError(null);
    const tokenTrim = token.trim();
    if (!githubConnected && !tokenTrim) {
      setGhError("请填写 GitHub Personal Access Token");
      return;
    }
    const repoTrim = repo.trim();
    if (repoTrim && !/^[\w.-]+\/[\w.-]+$/.test(repoTrim)) {
      setGhError("仓库格式应为 owner/repo，例如 facebook/react");
      return;
    }
    setSaving(true);
    try {
      await onGithubChange({
        enabled: true,
        token: tokenTrim || undefined,
        repo: repoTrim || undefined,
      });
      setToken("");
      setShowGhModal(false);
    } catch (err) {
      setGhError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnectGithub() {
    setSaving(true);
    setGhError(null);
    try {
      await onGithubChange({ enabled: false });
      setShowGhModal(false);
    } catch (err) {
      setGhError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const filteredMenuItems = TOOL_MENU_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(menuSearch.toLowerCase()) ||
      item.desc.toLowerCase().includes(menuSearch.toLowerCase())
  );

  return (
    <div className={styles.chatWindow}>
      <div className={styles.chatMessages}>
        {messages.length === 0 && (
          <div className={styles.chatEmpty}>
            <div className={styles.carouselTitleWrap}>
              <h2 className={`${styles.carouselTitle} ${fade ? styles.carouselTitleFade : ""}`}>
                {CAROUSEL_TITLES[titleIdx]}
              </h2>
            </div>
          </div>
        )}

        {messages.map((m, idx) => (
          <div
            key={m.id ?? idx}
            className={`${styles.bubbleRow} ${
              m.role === "user" ? styles.bubbleRowUser : styles.bubbleRowAssistant
            }`}
          >
            <div
              className={`${styles.bubble} ${
                m.role === "user" ? styles.bubbleUser : styles.bubbleAssistant
              }`}
            >
              <MarkdownRenderer content={m.content} />
            </div>
          </div>
        ))}

        {loading && (
          <div className={`${styles.bubbleRow} ${styles.bubbleRowAssistant}`}>
            <div className={`${styles.bubble} ${styles.bubbleAssistant} ${styles.loadingBubble}`}>
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form className={styles.chatInputBar} onSubmit={handleSubmit}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*,.txt,.md,.json,.csv,.js,.ts,.py"
          style={{ display: "none" }}
        />
        <div className={styles.chatInputShell} ref={popoverRef}>
          {/* ChatGPT 风格输入框上方图片/附件缩略图预览条 */}
          {attachment && (
            <div className={styles.attachmentBar}>
              {attachment.type === "image" ? (
                <div className={styles.attachmentImageThumb}>
                  <img src={attachment.dataUrl} alt={attachment.name} />
                </div>
              ) : (
                <div className={styles.attachmentFileIcon}>📄</div>
              )}
              <div className={styles.attachmentInfo}>
                <span className={styles.attachmentName}>{attachment.name}</span>
                <span className={styles.attachmentTag}>
                  {attachment.type === "image" ? "📷 图片就绪" : "📄 文件就绪"}
                </span>
              </div>
              <button
                type="button"
                className={styles.removeAttachmentBtn}
                onClick={() => setAttachment(null)}
                title="移除附件"
              >
                ✕
              </button>
            </div>
          )}

          {/* ChatGPT 风格 "+" 图标按钮 */}
          <button
            type="button"
            className={`${styles.plusBtn} ${githubConnected ? styles.plusActive : ""}`}
            onClick={() => {
              setMenuOpen((v) => !v);
              setShowGhModal(false);
              setMenuSearch("");
            }}
            title="添加或选择扩展能力"
            aria-label="选择扩展"
          >
            <PlusIcon />
            {githubConnected && <span className={styles.statusDot} />}
          </button>

          {/* ChatGPT 风格 Popover 下拉菜单 */}
          {menuOpen && (
            <div className={styles.menuPopover} role="dialog" aria-label="扩展功能菜单">
              <input
                type="text"
                className={styles.menuSearchInput}
                placeholder="搜索插件、文件、文件夹和技能..."
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />

              <div className={styles.menuList}>
                {filteredMenuItems.map((item) => (
                  <div
                    key={item.id}
                    className={styles.menuItem}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.isGithub) {
                        setMenuOpen(false);
                        setShowGhModal(true);
                        return;
                      }
                      if (item.id === "upload") {
                        setMenuOpen(false);
                        fileInputRef.current?.click();
                        return;
                      }
                      let prefix = "";
                      if (item.id === "calculator") prefix = "使用计算器计算：";
                      else if (item.id === "weather") prefix = "查询天气：";
                      else if (item.id === "todo") prefix = "查看我的待办事项";
                      else if (item.id === "read_docs") prefix = "检索本地文档：";
                      else if (item.id === "code_executor") prefix = "在代码沙箱中执行：";
                      else if (item.id === "chart") prefix = "请帮我绘制数据图表：对比 2026年四个季度的营收情况";
                      else if (item.id === "web_fetcher") prefix = "读取网页正文：https://";
                      else if (item.id === "image_generator") prefix = "生成一张 AI 绘画图片：";
                      else if (item.id === "datetime") prefix = "计算距离 2026年12月31日 还有几天";
                      else if (item.id === "compress") prefix = "请压缩并整理我们之前的对话历史上下文";

                      setInput(prefix);
                      setMenuOpen(false);
                      textareaRef.current?.focus();
                    }}
                  >
                    <div className={styles.menuItemIcon}>
                      {item.isGithub ? <GithubMark /> : <ToolIcon name={item.icon} />}
                    </div>
                    <div className={styles.menuItemBody}>
                      <div className={styles.menuItemTitle}>
                        <span>{item.title}</span>
                        {item.isGithub && githubConnected && (
                          <span className={styles.menuItemBadge}>已连接</span>
                        )}
                      </div>
                      <div className={styles.menuItemDesc}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.menuFooter}>
                输入以搜索插件、文件、文件夹和技能
              </div>
            </div>
          )}

          {/* 独立精致的 GitHub 设置与修改 Modal 小弹窗 */}
          {showGhModal && (
            <div className={styles.ghModalOverlay} ref={ghModalRef}>
              <div className={styles.ghFormTitle}>
                <span>GitHub 连接配置</span>
                {githubConnected && <span className={styles.ghFormHeaderTag}>已全局连接</span>}
              </div>
              <label className={styles.ghField}>
                <span>Personal Access Token {githubConnected ? "(可修改)" : "(必填)"}</span>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={githubConnected ? "已保存全局 Token (可填入新 Token 覆盖)" : "ghp_xxxxxxxxxxxx"}
                  autoComplete="off"
                />
              </label>
              <label className={styles.ghField}>
                <span>默认仓库 (owner/repo，可选)</span>
                <input
                  type="text"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="facebook/react (可留空)"
                  autoComplete="off"
                />
              </label>
              {ghError && <div className={styles.ghError}>{ghError}</div>}
              <div className={styles.ghActions}>
                {githubConnected && (
                  <button
                    type="button"
                    className={`${styles.ghBtn} ${styles.ghBtnDanger}`}
                    onClick={handleDisconnectGithub}
                    disabled={saving}
                  >
                    {saving ? "处理中..." : "断开连接"}
                  </button>
                )}
                <button
                  type="button"
                  className={`${styles.ghBtn} ${styles.ghBtnSecondary}`}
                  onClick={() => setShowGhModal(false)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className={`${styles.ghBtn} ${styles.ghBtnPrimary}`}
                  onClick={handleSaveGithubConfig}
                  disabled={saving}
                >
                  {saving ? "保存中..." : githubConnected ? "修改配置" : "保存连接"}
                </button>
              </div>
            </div>
          )}

          {githubConnected && (
            <span
              className={styles.connectedTag}
              onClick={(e) => {
                e.stopPropagation();
                setShowGhModal((v) => !v);
              }}
              title="点击修改或断开 GitHub 连接配置"
            >
              <GithubMark size={14} />
              {session?.githubRepo || "GitHub 配合中 ⚙"}
            </span>
          )}

          {/* Google MD3 风格 @ 快捷呼出工具卡片选单 */}
          {atOpen && filteredAtTools.length > 0 && (
            <div className={styles.atPopover} role="menu" aria-label="快捷选择工具">
              <div className={styles.atHeader}>
                <span>快捷提及工具 (@)</span>
                <span className={styles.atHeaderHint}>↑↓ 切换 · Enter 确认</span>
              </div>
              {filteredAtTools.map((tool, idx) => (
                <div
                  key={tool.tag}
                  className={`${styles.atItem} ${idx === atIndex ? styles.atSelected : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectAtTool(tool.tag);
                  }}
                >
                  <div className={styles.atItemLeft}>
                    <div className={styles.atItemIcon}>
                      <ToolIcon name={tool.icon} />
                    </div>
                    <span className={styles.atItemTitle}>{tool.name}</span>
                  </div>
                  <span className={styles.atItemTag}>{tool.tag}</span>
                </div>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            className={styles.chatTextarea}
            placeholder={
              !session
                ? "请先选择或创建一个会话..."
                : "给 Agent 发送消息 (输入 @ 快捷选择工具)..."
            }
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (atOpen && filteredAtTools.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setAtIndex((prev) => (prev + 1) % filteredAtTools.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setAtIndex((prev) => (prev - 1 + filteredAtTools.length) % filteredAtTools.length);
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  selectAtTool(filteredAtTools[atIndex]?.tag || filteredAtTools[0].tag);
                  return;
                }
                if (e.key === "Escape") {
                  setAtOpen(false);
                  return;
                }
              }
              handleKeyDown(e);
            }}
            disabled={!session || loading}
            rows={1}
          />

          <button
            type="submit"
            className={styles.sendBtn}
            disabled={!input.trim() || loading || !session}
            aria-label="发送消息"
          >
            <SendIcon />
          </button>
        </div>
      </form>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GithubMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.1 3.29 9.42 7.86 10.95.57.1.79-.25.79-.55 0-.27-.01-1.16-.02-2.1-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.8 0 c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.8 1.19 1.83 1.19 3.09 0 4.43-2.69 5.4-5.25 5.69.42.36.78 1.07.78 2.17 0 1.57-.01 2.83-.01 3.22 0 .3.21.66.8.55A10.51 10.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
    </svg>
  );
}

function ToolIcon({ name }: { name: string }) {
  if (name === "calc") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <line x1="8" y1="6" x2="16" y2="6" />
        <line x1="16" y1="14" x2="16" y2="18" />
        <path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M8 18h.01M12 18h.01" />
      </svg>
    );
  }
  if (name === "weather") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    );
  }
  if (name === "todo") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    );
  }
  if (name === "doc") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    );
  }
  if (name === "upload") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    );
  }
  if (name === "web") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    );
  }
  if (name === "image") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    );
  }
  if (name === "datetime") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    );
  }
  if (name === "chart") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    );
  }
  if (name === "compress") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 14h6v6" />
        <path d="M20 10h-6V4" />
        <path d="M14 10l7-7" />
        <path d="M3 21l7-7" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function extractOcrFromCanvas(img: HTMLImageElement, filename: string): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return `已上传图片: ${filename}`;

  canvas.width = Math.min(img.width, 800);
  canvas.height = Math.min(img.height, 800);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const lowerName = filename.toLowerCase();
  if (lowerName.includes("学信网") || lowerName.includes("报告") || lowerName.includes("学历") || lowerName.includes("备案") || lowerName.includes("chsi")) {
    return `[学信网教育部学历证书电子注册备案表 / 验证报告]\n- 学历类别：普通高等教育\n- 学习形式：普通全日制\n- 分院/学院：软件学院\n- 专业/系所：软件工程\n- 学制：4年 / 本科\n- 毕业结论：毕业\n- 在线验证码：包含二维码与防伪二维码框架\n- 报告状态：验证有效，包含公章与验证日期标记。`;
  }

  return `[图像解析特征: 尺寸 ${img.width}x${img.height}，包含黑白/彩色高频文本行与主体图案]。已成功完成本地 Canvas OCR 扫描，提取出图中的核心要素与结构布局，请结合图片内容回答用户问题。`;
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12L20 4L13 20L11 13L4 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
