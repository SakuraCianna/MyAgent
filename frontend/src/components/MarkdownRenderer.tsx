import { useState } from "react";
import { WeatherCard, type WeatherData } from "./WeatherCard";
import styles from "./MarkdownRenderer.module.css";

interface MarkdownRendererProps {
  content: string;
}

import { ChartCard, type ChartData } from "./ChartCard";

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) return null;

  const blocks = parseMarkdownBlocks(content);
  const textWeather = extractWeatherFromText(content);

  return (
    <div className={styles.markdownBody}>
      {textWeather && <WeatherCard data={textWeather} />}
      {blocks.map((block, idx) => {
        if (block.type === "code") {
          if (block.language === "weather" || isWeatherJson(block.text)) {
            try {
              const weatherData = JSON.parse(block.text) as WeatherData;
              return <WeatherCard key={idx} data={weatherData} />;
            } catch {
              // Ignore fallback
            }
          }
          if (block.language === "chart" || isChartJson(block.text)) {
            try {
              const chartData = JSON.parse(block.text) as ChartData;
              return <ChartCard key={idx} data={chartData} />;
            } catch {
              // Ignore fallback
            }
          }
          return <CodeBlock key={idx} language={block.language} code={block.text} />;
        }
        if (block.type === "table") {
          return (
            <div key={idx} className={styles.tableContainer}>
              <table className={styles.mdTable}>
                {block.headers && (
                  <thead>
                    <tr>
                      {block.headers.map((h, i) => (
                        <th key={i}>{renderInlineText(h)}</th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {block.rows?.map((row, rIdx) => (
                    <tr key={rIdx}>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx}>{renderInlineText(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.type === "heading") {
          const Tag = `h${block.level}` as keyof JSX.IntrinsicElements;
          return <Tag key={idx}>{renderInlineText(block.text)}</Tag>;
        }
        if (block.type === "blockquote") {
          return <blockquote key={idx}>{renderInlineText(block.text)}</blockquote>;
        }
        if (block.type === "hr") {
          return <hr key={idx} />;
        }
        if (block.type === "ul") {
          return (
            <ul key={idx}>
              {block.items?.map((item, i) => (
                <li key={i}>{renderInlineText(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={idx}>
              {block.items?.map((item, i) => (
                <li key={i}>{renderInlineText(item)}</li>
              ))}
            </ol>
          );
        }
        if (block.type === "paragraph") {
          const text = block.text.trim();

          // 1. 匹配思考过程 [思考] ...
          if (text.startsWith("[思考]")) {
            const thoughtContent = text.replace(/^\[思考\]\s*/, "");
            return (
              <div key={idx} className={styles.thoughtBox}>
                <div className={styles.thoughtTitle}>💭 Agent 思考逻辑</div>
                <div>{renderInlineText(thoughtContent)}</div>
              </div>
            );
          }

          // 2. 匹配新版 [TOOL_CALL:name] 独立占位符
          const explicitToolMatch = text.match(/^\[TOOL_CALL:([\w-]+)\]$/);
          if (explicitToolMatch) {
            const toolName = explicitToolMatch[1];
            return (
              <div key={idx} className={styles.toolStatusBadge}>
                <span>⚙️</span>
                <span>正在调用工具 <code className={styles.toolNameBadge}>{toolName}</code>...</span>
              </div>
            );
          }

          // 3. 匹配兼容旧版 ⚙️ *正在调用工具: xxx...* 格式
          const toolCallMatch = text.match(/(?:⚙️|\*)*\s*正在调用工具[：:]\s*`?([\w-]+)`?\s*\.\.\.\*?/);
          if (toolCallMatch) {
            const toolName = toolCallMatch[1];
            const remainingText = text.replace(/(?:⚙️|\*)*\s*正在调用工具[：:]\s*`?[\w-]+`?\s*\.\.\.\*?/, "").replace(/^⚙️\s*/, "").trim();
            return (
              <div key={idx} style={{ margin: "6px 0" }}>
                <div className={styles.toolStatusBadge}>
                  <span>⚙️</span>
                  <span>正在调用工具 <code className={styles.toolNameBadge}>{toolName}</code>...</span>
                </div>
                {remainingText && <p style={{ marginTop: "6px" }}>{renderInlineText(remainingText)}</p>}
              </div>
            );
          }

          return <p key={idx}>{renderInlineText(block.text)}</p>;
        }
        return <p key={idx}>{renderInlineText(block.text)}</p>;
      })}
    </div>
  );
}

interface Block {
  type: "paragraph" | "heading" | "code" | "ul" | "ol" | "table" | "blockquote" | "hr";
  text: string;
  level?: number;
  language?: string;
  items?: string[];
  headers?: string[];
  rows?: string[][];
}

function parseMarkdownBlocks(content: string): Block[] {
  const lines = content.split("\n");
  const blocks: Block[] = [];
  let inCodeBlock = false;
  let codeLang = "";
  let codeBuffer: string[] = [];
  let listBuffer: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let tableBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length > 0 && listType) {
      blocks.push({ type: listType, text: "", items: listBuffer });
      listBuffer = [];
      listType = null;
    }
  };

  const flushTable = () => {
    if (tableBuffer.length >= 2) {
      const headerLine = tableBuffer[0];
      const headers = headerLine
        .split("|")
        .map((s) => s.trim())
        .filter((_, i, arr) => (i > 0 && i < arr.length - 1) || arr.length === 2);

      const rows: string[][] = [];
      for (let i = 2; i < tableBuffer.length; i++) {
        const line = tableBuffer[i];
        if (!line.includes("|")) continue;
        const cells = line
          .split("|")
          .map((s) => s.trim())
          .filter((_, idx, arr) => (idx > 0 && idx < arr.length - 1) || arr.length === 2);
        rows.push(cells);
      }

      blocks.push({
        type: "table",
        text: "",
        headers,
        rows,
      });
    } else if (tableBuffer.length > 0) {
      tableBuffer.forEach((tblLine) => blocks.push({ type: "paragraph", text: tblLine }));
    }
    tableBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block check
    if (line.trim().startsWith("```")) {
      flushList();
      flushTable();
      if (inCodeBlock) {
        blocks.push({
          type: "code",
          text: codeBuffer.join("\n"),
          language: codeLang || "code",
        });
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // Markdown Table Check
    const isTableLine = line.trim().startsWith("|") || (line.includes("|") && line.trim().endsWith("|"));
    if (isTableLine) {
      flushList();
      tableBuffer.push(line.trim());
      continue;
    } else if (tableBuffer.length > 0) {
      flushTable();
    }

    // List item check
    const ulMatch = line.match(/^[\*\-\+]\s+(.+)/);
    const olMatch = line.match(/^\d+\.\s+(.+)/);

    if (ulMatch || olMatch) {
      const currentListType = ulMatch ? "ul" : "ol";
      const itemText = ulMatch ? ulMatch[1] : olMatch![1];

      if (listType && listType !== currentListType) {
        flushList();
      }

      listType = currentListType;
      listBuffer.push(itemText);
      continue;
    } else {
      flushList();
    }

    // Blockquote
    if (line.trim().startsWith(">")) {
      blocks.push({ type: "blockquote", text: line.trim().slice(1).trim() });
      continue;
    }

    // Horizontal Rule
    if (/^(\-\-\-|\*\*\*|___)$/.test(line.trim())) {
      blocks.push({ type: "hr", text: "" });
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      continue;
    }

    if (line.trim() !== "") {
      blocks.push({ type: "paragraph", text: line });
    }
  }

  if (inCodeBlock && codeBuffer.length > 0) {
    blocks.push({
      type: "code",
      text: codeBuffer.join("\n"),
      language: codeLang || "code",
    });
  }

  flushList();
  flushTable();

  return blocks;
}

function renderInlineText(text: string): React.ReactNode[] {
  // 匹配 Markdown 图片 ![alt](url)、超链接 [label](url)、粗体 **text**、行内代码 `code`
  const tokens = text.split(/(!\[.+?\]\(.+?\)|\[.+?\]\(.+?\)|`[^`]+`|\*\*[^*]+\*\*)/g);

  return tokens.map((token, idx) => {
    if (!token) return null;

    // 1. Markdown 图片: ![alt](url)
    const imgMatch = token.match(/^!\[(.+?)\]\((.+?)\)$/);
    if (imgMatch) {
      const alt = imgMatch[1];
      const url = imgMatch[2];
      return (
        <div key={idx} className={styles.imageCardContainer}>
          <img
            src={url}
            alt={alt}
            className={styles.renderedAiImage}
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).alt = `${alt} (图片生成加载中，请稍等...)`;
            }}
          />
          <div className={styles.imageCardCaption}>🎨 {alt}</div>
        </div>
      );
    }

    // 2. Markdown 超链接: [label](url)
    const linkMatch = token.match(/^\[(.+?)\]\((.+?)\)$/);
    if (linkMatch) {
      const label = linkMatch[1];
      const url = linkMatch[2];
      return (
        <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      );
    }

    if (token.startsWith("**") && token.endsWith("**") && token.length > 4) {
      return <strong key={idx}>{token.slice(2, -2)}</strong>;
    }

    if (token.startsWith("`") && token.endsWith("`") && token.length > 2) {
      return (
        <code key={idx} className={styles.inlineCode}>
          {token.slice(1, -1)}
        </code>
      );
    }

    return token;
  });
}

function CodeBlock({ language, code }: { language?: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(true);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isHtml =
    language?.toLowerCase() === "html" ||
    code.trim().toLowerCase().startsWith("<!doctype html") ||
    code.includes("<html") ||
    code.includes("THREE.") ||
    code.includes("canvas");

  const handlePreviewHtml = () => {
    const win = window.open("", "_blank");
    if (win) {
      win.document.open();
      win.document.write(code);
      win.document.close();
    }
  };

  return (
    <div className={styles.codeBlockShell}>
      <div className={styles.codeBlockHeader}>
        <span>{language || "code"}</span>
        <div>
          {isHtml && (
            <>
              <button
                type="button"
                className={styles.previewBtn}
                onClick={() => setShowLivePreview((v) => !v)}
              >
                {showLivePreview ? "隐藏内嵌 3D 预览 🙈" : "显示内嵌 3D 预览 👁️"}
              </button>
              <button
                type="button"
                className={styles.previewBtn}
                onClick={handlePreviewHtml}
                title="在新浏览器标签页中全屏实时渲染预览 HTML 网页"
              >
                在新窗口全屏预览 ↗
              </button>
            </>
          )}
          <button type="button" className={styles.copyBtn} onClick={handleCopy}>
            {copied ? "已复制 ✓" : "复制"}
          </button>
        </div>
      </div>
      <pre className={styles.codePre}>
        <code>{code}</code>
      </pre>

      {/* 内嵌 3D / HTML 网页全功能实时运行沙箱 */}
      {isHtml && showLivePreview && (
        <div className={styles.liveIframeShell}>
          <div className={styles.liveIframeBar}>
            <span>🌐 网页与 3D 粒子特效实时运行窗口</span>
            <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={handlePreviewHtml}>
              新窗口全屏预览 ↗
            </span>
          </div>
          <iframe
            className={styles.liveIframe}
            srcDoc={code}
            sandbox="allow-scripts allow-same-origin allow-modals"
            title="Interactive Web 3D Preview"
          />
        </div>
      )}
    </div>
  );
}

function isWeatherJson(text: string): boolean {
  try {
    const obj = JSON.parse(text);
    return Boolean(obj && typeof obj === "object" && obj.city && obj.temperatureC !== undefined);
  } catch {
    return false;
  }
}

function isChartJson(text: string): boolean {
  try {
    const obj = JSON.parse(text);
    return Boolean(obj && typeof obj === "object" && obj.chartType && Array.isArray(obj.labels) && Array.isArray(obj.values));
  } catch {
    return false;
  }
}

function extractWeatherFromText(content: string): WeatherData | null {
  if (!content.includes("天气") || (!content.includes("气温") && !content.includes("°C"))) return null;

  const cityMatch = content.match(/([A-Za-z\u4e00-\u9fa5]+)的?天气/);
  const conditionMatch = content.match(/天气[:：]\s*([^\n\r(（]+)/);
  const tempMatch = content.match(/气温[:：]\s*(\d+)°?C/i);
  const humidityMatch = content.match(/湿度[:：]\s*(\d+)%/);
  const feelsLikeMatch = content.match(/体感[约\s]*(\d+)°?C/i);
  const windMatch = content.match(/风[力速][:：]\s*(\d+)/i);

  if (tempMatch && (conditionMatch || cityMatch)) {
    const temp = parseInt(tempMatch[1], 10);
    const humidity = humidityMatch ? parseInt(humidityMatch[1], 10) : 50;
    const feels = feelsLikeMatch ? parseInt(feelsLikeMatch[1], 10) : temp;
    const wind = windMatch ? parseInt(windMatch[1], 10) : 12;
    const rawCity = cityMatch ? cityMatch[1].replace(/今天|当前|实时|查询/, "") : "城市";
    const city = rawCity.length > 0 ? rawCity : "南昌";
    const condition = conditionMatch ? conditionMatch[1].trim() : "晴朗";

    return {
      city,
      condition,
      temperatureC: temp,
      humidityPercent: humidity,
      feelsLikeC: feels,
      windKmph: wind,
      source: "wttr.in 实时气象",
    };
  }

  return null;
}
