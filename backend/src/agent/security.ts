/**
 * Agent Runtime 安全防御机制：防提示词注入 (Prompt Injection Defense)
 * 包括直接提示词注入防御、间接提示词注入过滤与标签隔离。
 */

// 常见的提示词注入攻击向量正则过滤
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above)\s+(instructions|directions|rules)/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /\[system\s+instruction\]/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /new\s+system\s+prompt:/i,
  /override\s+(all\s+)?system\s+rules/i,
];

export interface SecuritySanitizeResult {
  sanitized: string;
  isThreatDetected: boolean;
  threatDetails?: string;
}

/**
 * 清理与检测用户输入中的提示词注入威胁
 */
export function sanitizeUserInput(input: string): SecuritySanitizeResult {
  if (!input) return { sanitized: "", isThreatDetected: false };

  let sanitized = input;
  let isThreatDetected = false;
  let threatDetails: string | undefined;

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      isThreatDetected = true;
      threatDetails = `检测到可能的提示词越权攻击模式: ${pattern.source}`;
      // 中和潜在危险指令标签
      sanitized = sanitized.replace(pattern, "[已安全中和的非法指令段]");
    }
  }

  return { sanitized, isThreatDetected, threatDetails };
}

/**
 * 将用户提问包裹在明确的 XML 隔离标签中
 */
export function wrapUserQuery(input: string): string {
  const { sanitized } = sanitizeUserInput(input);
  return `<user_query>\n${sanitized}\n</user_query>`;
}

/**
 * 对工具返回的文本（来自外部网页/文档/GitHub）做间接提示词注入中和
 */
export function sanitizeToolOutput(text: string): string {
  if (!text) return "";
  let clean = text;
  for (const pattern of INJECTION_PATTERNS) {
    clean = clean.replace(pattern, "[已被过滤的疑似恶意外部指令]");
  }
  return clean;
}
