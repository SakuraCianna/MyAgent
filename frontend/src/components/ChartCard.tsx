import React from "react";
import styles from "./ChartCard.module.css";

export interface ChartData {
  title: string;
  chartType: "bar" | "line" | "pie";
  labels: string[];
  values: number[];
  unit?: string;
  description?: string;
}

export function ChartCard({ data }: { data: ChartData }) {
  const { title, chartType, labels, values, unit = "", description } = data;
  const maxValue = Math.max(...values, 1);

  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div className={styles.chartTitle}>{title}</div>
        <div className={styles.chartBadge}>
          {chartType === "bar" ? "柱状图" : chartType === "line" ? "折线图" : "饼图"}
        </div>
      </div>

      {chartType === "bar" && (
        <svg className={styles.chartSvg} viewBox="0 0 400 180">
          {values.map((val, idx) => {
            const barWidth = Math.min(300 / values.length, 45);
            const gap = (360 - barWidth * values.length) / (values.length + 1);
            const x = gap + idx * (barWidth + gap) + 20;
            const barHeight = (val / maxValue) * 120;
            const y = 140 - barHeight;
            const color = colors[idx % colors.length];

            return (
              <g key={idx}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={color}
                  rx="4"
                  className={styles.barRect}
                />
                <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fontSize="11" fill="#374151" fontWeight="600">
                  {val}{unit}
                </text>
                <text x={x + barWidth / 2} y="158" textAnchor="middle" fontSize="11" fill="#6b7280">
                  {labels[idx]}
                </text>
              </g>
            );
          })}
          <line x1="20" y1="140" x2="380" y2="140" stroke="#e5e7eb" strokeWidth="1.5" />
        </svg>
      )}

      {chartType === "line" && (
        <svg className={styles.chartSvg} viewBox="0 0 400 180">
          {(() => {
            const points = values.map((val, idx) => {
              const x = 30 + (idx / Math.max(values.length - 1, 1)) * 340;
              const y = 140 - (val / maxValue) * 110;
              return { x, y, val };
            });
            const pathD = points.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), "");

            return (
              <>
                <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
                {points.map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r="5" fill="#3b82f6" stroke="#ffffff" strokeWidth="2" />
                    <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="11" fill="#1d4ed8" fontWeight="600">
                      {p.val}{unit}
                    </text>
                    <text x={p.x} y="158" textAnchor="middle" fontSize="11" fill="#6b7280">
                      {labels[i]}
                    </text>
                  </g>
                ))}
                <line x1="20" y1="140" x2="380" y2="140" stroke="#e5e7eb" strokeWidth="1.5" />
              </>
            );
          })()}
        </svg>
      )}

      {chartType === "pie" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around" }}>
          <svg width="140" height="140" viewBox="0 0 100 100">
            {(() => {
              const total = values.reduce((a, b) => a + b, 0) || 1;
              let accumulatedAngle = 0;

              return values.map((val, idx) => {
                const sliceAngle = (val / total) * 360;
                const startAngle = accumulatedAngle;
                const endAngle = accumulatedAngle + sliceAngle;
                accumulatedAngle += sliceAngle;

                const x1 = 50 + 40 * Math.cos((Math.PI * (startAngle - 90)) / 180);
                const y1 = 50 + 40 * Math.sin((Math.PI * (startAngle - 90)) / 180);
                const x2 = 50 + 40 * Math.cos((Math.PI * (endAngle - 90)) / 180);
                const y2 = 50 + 40 * Math.sin((Math.PI * (endAngle - 90)) / 180);

                const largeArc = sliceAngle > 180 ? 1 : 0;
                const pathD = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;

                return <path key={idx} d={pathD} fill={colors[idx % colors.length]} stroke="#ffffff" strokeWidth="1.5" />;
              });
            })()}
          </svg>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {labels.map((lbl, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#374151" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: colors[i % colors.length] }} />
                <span>{lbl}: <b>{values[i]}{unit}</b></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {description && <div className={styles.chartDesc}>{description}</div>}
    </div>
  );
}
