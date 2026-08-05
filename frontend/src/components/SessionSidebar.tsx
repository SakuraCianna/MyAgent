import { useState } from "react";
import type { SessionDto } from "../api/client";
import styles from "./SessionSidebar.module.css";

interface Props {
  sessions: SessionDto[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  activeSession: SessionDto | null;
  onGithubChange: (opts: { enabled: boolean; token?: string; repo?: string }) => Promise<void>;
}

export function SessionSidebar({
  sessions,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  activeSession,
  onGithubChange,
}: Props) {
  const [showPluginsModal, setShowPluginsModal] = useState(false);
  const [token, setToken] = useState("");
  const [repo, setRepo] = useState(activeSession?.githubRepo ?? "");
  const [saving, setSaving] = useState(false);
  const [ghError, setGhError] = useState<string | null>(null);

  const githubConnected = Boolean(activeSession?.githubConnected);

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
      setShowPluginsModal(false);
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
      setShowPluginsModal(false);
    } catch (err) {
      setGhError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className={styles.sidebar}>
      {/* 顶部 Header: 应用名 MyAgent */}
      <div className={styles.sidebarHeader}>
        <div className={styles.brandTitle}>
          <span className={styles.brandName}>MyAgent</span>
        </div>
        <div className={styles.headerIcons}>
          <button className={styles.iconBtn} title="新建聊天" onClick={onCreate}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* 侧边栏功能导航 (新聊天 / 插件) */}
      <div className={styles.navSection}>
        <button className={styles.navItem} onClick={onCreate}>
          <svg className={styles.navIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          <span>新聊天</span>
        </button>

        <button
          className={styles.navItem}
          onClick={() => {
            setRepo(activeSession?.githubRepo ?? "");
            setGhError(null);
            setShowPluginsModal(true);
          }}
        >
          <svg className={styles.navIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <span>插件</span>
          {githubConnected && <span className={styles.connectedDot} title="外部 API 插件已连接">●</span>}
        </button>
      </div>

      <div className={styles.divider} />

      {/* 历史对话列表 */}
      <div className={styles.sessionSectionTitle}>最近对话</div>
      <div className={styles.sidebarList}>
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`${styles.sidebarItem} ${
              s.id === activeId ? styles.sidebarItemActive : ""
            }`}
            onClick={() => onSelect(s.id)}
          >
            <span className={styles.sidebarItemTitle}>{s.title}</span>
            {s.githubConnected && (
              <svg
                className={styles.sidebarItemGithub}
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-label="GitHub API 插件已配置"
              >
                <path d="M12 0C5.37 0 0 5.5 0 12.3c0 5.43 3.44 10.03 8.2 11.66.6.11.82-.27.82-.6 0-.29-.01-1.06-.02-2.08-3.34.75-4.04-1.65-4.04-1.65-.55-1.43-1.34-1.82-1.34-1.82-1.09-.77.08-.75.08-.75 1.2.09 1.84 1.27 1.84 1.27 1.07 1.86 2.81 1.32 3.5 1.01.11-.79.42-1.32.76-1.63-2.67-.31-5.47-1.36-5.47-6.03 0-1.33.46-2.42 1.22-3.28-.12-.31-.53-1.55.12-3.23 0 0 1-.33 3.3 1.25a11.2 11.2 0 0 1 6 0c2.28-1.58 3.29-1.25 3.29-1.25.65 1.68.24 2.92.12 3.23.76.86 1.22 1.95 1.22 3.28 0 4.68-2.8 5.72-5.48 6.02.43.38.81 1.13.81 2.28 0 1.65-.02 2.98-.02 3.38 0 .33.22.72.83.6A12.32 12.32 0 0 0 24 12.3C24 5.5 18.63 0 12 0z" />
              </svg>
            )}
            <button
              className={styles.sidebarItemDelete}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(s.id);
              }}
              title="删除会话"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
        {sessions.length === 0 && <div className={styles.sidebarEmpty}>暂无历史对话</div>}
      </div>

      {/* 外部 API 插件配置 Modal 弹窗 */}
      {showPluginsModal && (
        <div className={styles.modalOverlay} onClick={() => setShowPluginsModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleWrap}>
                <span className={styles.modalBadge}>外部 API 插件</span>
                <h3>GitHub 扩展服务配置</h3>
              </div>
              <button className={styles.closeBtn} onClick={() => setShowPluginsModal(false)}>✕</button>
            </div>

            <div className={styles.modalBody}>
              <p className={styles.pluginIntro}>
                配置外部 GitHub API Token 后，MyAgent 可以为您自动识别、读取和分析您的远程仓库代码、Issues 及 Pull Requests。
              </p>

              {ghError && <div className={styles.pluginError}>{ghError}</div>}

              <div className={styles.formGroup}>
                <label>GitHub Personal Access Token {githubConnected && <span className={styles.subText}>(不修改可留空)</span>}</label>
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
                    断开插件连接
                  </button>
                )}
                <button
                  type="button"
                  className={styles.saveBtn}
                  onClick={handleSaveGithubConfig}
                  disabled={saving}
                >
                  {saving ? "保存中..." : githubConnected ? "更新配置" : "保存并连接插件"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
