import type { SessionDto } from "../api/client";
import styles from "./SessionSidebar.module.css";

interface Props {
  sessions: SessionDto[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

export function SessionSidebar({ sessions, activeId, onSelect, onCreate, onDelete }: Props) {
  return (
    <aside className={styles.sidebar}>
      <button className={styles.sidebarNewBtn} onClick={onCreate}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        新建会话
      </button>
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
                aria-label="GitHub 已连接"
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
        {sessions.length === 0 && <div className={styles.sidebarEmpty}>暂无会话</div>}
      </div>
    </aside>
  );
}
