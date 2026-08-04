import type { TraceEntry } from "../api/client";
import styles from "./ToolTraceView.module.css";

interface ToolTraceViewProps {
  trace: TraceEntry[];
}

export function ToolTraceView({ trace }: ToolTraceViewProps) {
  return (
    <aside className={styles.traceContainer} aria-label="执行轨迹">
      <div className={styles.traceHeader}>
        <span className={styles.traceTitle}>Agent 执行轨迹</span>
        <span className={styles.traceCount}>{trace.length} 条</span>
      </div>

      <div className={styles.traceList}>
        {trace.length === 0 ? (
          <div className={styles.traceEmpty}>暂无 Trace 记录</div>
        ) : (
          trace.map((item) => {
            const badgeClass =
              styles[`badge_${item.type}` as keyof typeof styles] ?? styles.badge_default;
            return (
              <div key={item.id} className={styles.traceCard}>
                <div className={styles.traceCardHeader}>
                  <span className={`${styles.typeBadge} ${badgeClass}`}>{item.type}</span>
                  <span className={styles.loopTag}>Loop #{item.loopIndex}</span>
                </div>
                <pre className={styles.payloadPre}>
                  {typeof item.payload === "string"
                    ? item.payload
                    : JSON.stringify(item.payload, null, 2)}
                </pre>
                <div className={styles.traceTime}>
                  {new Date(item.createdAt).toLocaleTimeString()}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
