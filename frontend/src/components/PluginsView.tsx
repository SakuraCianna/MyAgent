import { useState } from "react";
import type { SessionDto } from "../api/client";
import styles from "./PluginsView.module.css";

interface Props {
  activeSession: SessionDto | null;
  onGithubChange: (opts: { enabled: boolean; token?: string; repo?: string }) => Promise<void>;
  onBackToChat: () => void;
}

export function PluginsView({ activeSession, onGithubChange, onBackToChat }: Props) {
  const [activeTab, setActiveTab] = useState<"plugins" | "skills">("plugins");
  const [searchQuery, setSearchQuery] = useState("");
  const [showGhModal, setShowGhModal] = useState(false);
  const [token, setToken] = useState("");
  const [repo, setRepo] = useState(activeSession?.githubRepo ?? "");
  const [saving, setSaving] = useState(false);
  const [ghError, setGhError] = useState<string | null>(null);

  const githubConnected = Boolean(activeSession?.githubConnected);

  async function handleSaveGithub() {
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

  const PLUGINS = [
    {
      id: "github",
      name: "GitHub",
      desc: "Triage PRs, issues, CI, and publish flows for your GitHub repositories.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.5 0 12.3c0 5.43 3.44 10.03 8.2 11.66.6.11.82-.27.82-.6 0-.29-.01-1.06-.02-2.08-3.34.75-4.04-1.65-4.04-1.65-.55-1.43-1.34-1.82-1.34-1.82-1.09-.77.08-.75.08-.75 1.2.09 1.84 1.27 1.84 1.27 1.07 1.86 2.81 1.32 3.5 1.01.11-.79.42-1.32.76-1.63-2.67-.31-5.47-1.36-5.47-6.03 0-1.33.46-2.42 1.22-3.28-.12-.31-.53-1.55.12-3.23 0 0 1-.33 3.3 1.25a11.2 11.2 0 0 1 6 0c2.28-1.58 3.29-1.25 3.29-1.25.65 1.68.24 2.92.12 3.23.76.86 1.22 1.95 1.22 3.28 0 4.68-2.8 5.72-5.48 6.02.43.38.81 1.13.81 2.28 0 1.65-.02 2.98-.02 3.38 0 .33.22.72.83.6A12.32 12.32 0 0 0 24 12.3C24 5.5 18.63 0 12 0z" />
        </svg>
      ),
      category: "Featured",
      isConfigurable: true,
      isConnected: githubConnected,
    },
    {
      id: "search",
      name: "Tavily Web Search",
      desc: "Real-time web search, technical documentation retrieval and page summary.",
      icon: "🌐",
      category: "Featured",
      isConfigurable: false,
      isConnected: true,
    },
    {
      id: "ocr",
      name: "Tesseract OCR",
      desc: "Deep neural network model for extracting Chinese & English text from images.",
      icon: "🖼️",
      category: "Featured",
      isConfigurable: false,
      isConnected: true,
    },
    {
      id: "interpreter",
      name: "Code Interpreter",
      desc: "Execute Javascript/Node.js in isolated sandbox and generate data charts.",
      icon: "📊",
      category: "Featured",
      isConfigurable: false,
      isConnected: true,
    },
    {
      id: "gmail",
      name: "Gmail",
      desc: "Read and manage Gmail messages and compose draft replies.",
      icon: "📧",
      category: "Productivity",
      isConfigurable: false,
      isConnected: false,
      comingSoon: true,
    },
    {
      id: "gdrive",
      name: "Google Drive",
      desc: "Work across Drive, Docs, Sheets, and Slides in MyAgent.",
      icon: "📁",
      category: "Productivity",
      isConfigurable: false,
      isConnected: false,
      comingSoon: true,
    },
    {
      id: "notion",
      name: "Notion",
      desc: "Notion workflows for specs, research, docs, and team wikis.",
      icon: "📝",
      category: "Productivity",
      isConfigurable: false,
      isConnected: false,
      comingSoon: true,
    },
    {
      id: "slack",
      name: "Slack",
      desc: "Summarize channel threads and send workspace notifications.",
      icon: "💬",
      category: "Productivity",
      isConfigurable: false,
      isConnected: false,
      comingSoon: true,
    },
  ];

  const filteredPlugins = PLUGINS.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={styles.container}>
      {/* 顶部 Segmented Control (插件 | 技能) */}
      <div className={styles.topControlRow}>
        <div className={styles.segmentedControl}>
          <button
            className={`${styles.segmentBtn} ${activeTab === "plugins" ? styles.segmentActive : ""}`}
            onClick={() => setActiveTab("plugins")}
          >
            插件
          </button>
          <button
            className={`${styles.segmentBtn} ${activeTab === "skills" ? styles.segmentActive : ""}`}
            onClick={() => setActiveTab("skills")}
          >
            技能
          </button>
        </div>
      </div>

      <div className={styles.scrollArea}>
        <div className={styles.contentWrap}>
          {/* Header 标题与搜索框 */}
          <div className={styles.headerRow}>
            <div>
              <h1 className={styles.title}>插件</h1>
              <p className={styles.subtitle}>在你常用的工具中与 MyAgent 协作。</p>
            </div>
            <div className={styles.searchBox}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="搜索插件"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* 已安装插件图标横排 */}
          <div className={styles.sectionHeader}>
            <span>已安装 &gt;</span>
          </div>
          <div className={styles.installedRow}>
            <div className={`${styles.installedIcon} ${githubConnected ? styles.installedActive : ""}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.5 0 12.3c0 5.43 3.44 10.03 8.2 11.66.6.11.82-.27.82-.6 0-.29-.01-1.06-.02-2.08-3.34.75-4.04-1.65-4.04-1.65-.55-1.43-1.34-1.82-1.34-1.82-1.09-.77.08-.75.08-.75 1.2.09 1.84 1.27 1.84 1.27 1.07 1.86 2.81 1.32 3.5 1.01.11-.79.42-1.32.76-1.63-2.67-.31-5.47-1.36-5.47-6.03 0-1.33.46-2.42 1.22-3.28-.12-.31-.53-1.55.12-3.23 0 0 1-.33 3.3 1.25a11.2 11.2 0 0 1 6 0c2.28-1.58 3.29-1.25 3.29-1.25.65 1.68.24 2.92.12 3.23.76.86 1.22 1.95 1.22 3.28 0 4.68-2.8 5.72-5.48 6.02.43.38.81 1.13.81 2.28 0 1.65-.02 2.98-.02 3.38 0 .33.22.72.83.6A12.32 12.32 0 0 0 24 12.3C24 5.5 18.63 0 12 0z" />
              </svg>
            </div>
            <div className={styles.installedIcon}>🌐</div>
            <div className={styles.installedIcon}>🖼️</div>
            <div className={styles.installedIcon}>📊</div>
          </div>

          {/* Featured 插件卡片网格 */}
          <div className={styles.sectionHeader}>
            <span>Featured &gt;</span>
          </div>
          <div className={styles.pluginGrid}>
            {filteredPlugins.map((plugin) => (
              <div key={plugin.id} className={styles.pluginCard}>
                <div className={styles.cardIconWrap}>
                  {typeof plugin.icon === "string" ? (
                    <span className={styles.emojiIcon}>{plugin.icon}</span>
                  ) : (
                    plugin.icon
                  )}
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.cardTitleRow}>
                    <h3>{plugin.name}</h3>
                  </div>
                  <p>{plugin.desc}</p>
                </div>
                <div className={styles.cardAction}>
                  {plugin.isConfigurable ? (
                    <button
                      className={`${styles.actionBtn} ${plugin.isConnected ? styles.actionConnected : ""}`}
                      onClick={() => {
                        setRepo(activeSession?.githubRepo ?? "");
                        setGhError(null);
                        setShowGhModal(true);
                      }}
                      title="配置 GitHub Token 及 Repo"
                    >
                      {plugin.isConnected ? "..." : "+"}
                    </button>
                  ) : plugin.comingSoon ? (
                    <span className={styles.comingSoonTag}>即将推出</span>
                  ) : (
                    <span className={styles.builtInTag}>已内置</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* GitHub 外部 API Token & Repo 关联 Modal */}
      {showGhModal && (
        <div className={styles.modalOverlay} onClick={() => setShowGhModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleWrap}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.5 0 12.3c0 5.43 3.44 10.03 8.2 11.66.6.11.82-.27.82-.6 0-.29-.01-1.06-.02-2.08-3.34.75-4.04-1.65-4.04-1.65-.55-1.43-1.34-1.82-1.34-1.82-1.09-.77.08-.75.08-.75 1.2.09 1.84 1.27 1.84 1.27 1.07 1.86 2.81 1.32 3.5 1.01.11-.79.42-1.32.76-1.63-2.67-.31-5.47-1.36-5.47-6.03 0-1.33.46-2.42 1.22-3.28-.12-.31-.53-1.55.12-3.23 0 0 1-.33 3.3 1.25a11.2 11.2 0 0 1 6 0c2.28-1.58 3.29-1.25 3.29-1.25.65 1.68.24 2.92.12 3.23.76.86 1.22 1.95 1.22 3.28 0 4.68-2.8 5.72-5.48 6.02.43.38.81 1.13.81 2.28 0 1.65-.02 2.98-.02 3.38 0 .33.22.72.83.6A12.32 12.32 0 0 0 24 12.3C24 5.5 18.63 0 12 0z" />
                </svg>
                <h3>GitHub 插件配置</h3>
              </div>
              <button className={styles.closeBtn} onClick={() => setShowGhModal(false)}>✕</button>
            </div>

            <div className={styles.modalBody}>
              <p className={styles.pluginIntro}>
                连接您的 GitHub 账号 Token 后，MyAgent 可以检索分析您的远程仓库代码、Issue 及 PR。 Token 仅保存在内存中，安全隔离。
              </p>

              {ghError && <div className={styles.pluginError}>{ghError}</div>}

              <div className={styles.formGroup}>
                <label>Personal Access Token {githubConnected && <span className={styles.subText}>(不修改可留空)</span>}</label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={githubConnected ? "已连接（保留原有 Token）" : "ghp_xxxxxxxxxxxxxxxxxxxx"}
                />
              </div>

              <div className={styles.formGroup}>
                <label>默认分析仓库 (可选)</label>
                <input
                  type="text"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="如: owner/repo"
                />
              </div>

              <div className={styles.modalActions}>
                {githubConnected && (
                  <button
                    type="button"
                    className={styles.disconnectBtn}
                    onClick={handleDisconnectGithub}
                    disabled={saving}
                  >
                    断开插件
                  </button>
                )}
                <button
                  type="button"
                  className={styles.saveBtn}
                  onClick={handleSaveGithub}
                  disabled={saving}
                >
                  {saving ? "保存中..." : githubConnected ? "更新配置" : "完成配置并连接"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
