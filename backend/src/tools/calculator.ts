// calculator 工具：安全计算数学表达式（不使用 eval，避免代码注入）
import { registerTool } from "./registry.js";

/**
 * 极简安全表达式求值器：只支持数字、+ - * / % ( ) . 和空格。
 * 用递归下降解析，避免 eval/Function 带来的任意代码执行风险。
 */
function evaluateExpression(expr: string): number {
  const sanitized = expr.replace(/\s+/g, "");
  if (!/^[0-9+\-*/%().]+$/.test(sanitized)) {
    throw new Error("表达式包含不支持的字符，仅支持数字和 + - * / % ( )");
  }

  let pos = 0;

  function peek(): string {
    return sanitized[pos];
  }

  function consume(): string {
    return sanitized[pos++];
  }

  function parseNumber(): number {
    const start = pos;
    if (peek() === "-") consume();
    while (pos < sanitized.length && /[0-9.]/.test(peek())) consume();
    const numStr = sanitized.slice(start, pos);
    if (!numStr || numStr === "-") throw new Error("表达式格式错误：缺少数字");
    const num = Number(numStr);
    if (Number.isNaN(num)) throw new Error(`无法解析数字: ${numStr}`);
    return num;
  }

  function parseFactor(): number {
    if (peek() === "(") {
      consume();
      const value = parseExpr();
      if (peek() !== ")") throw new Error("表达式括号不匹配");
      consume();
      return value;
    }
    if (peek() === "-") {
      consume();
      return -parseFactor();
    }
    return parseNumber();
  }

  function parseTerm(): number {
    let value = parseFactor();
    while (pos < sanitized.length && (peek() === "*" || peek() === "/" || peek() === "%")) {
      const op = consume();
      const rhs = parseFactor();
      if (op === "*") value *= rhs;
      else if (op === "/") {
        if (rhs === 0) throw new Error("除数不能为 0");
        value /= rhs;
      } else {
        if (rhs === 0) throw new Error("取模除数不能为 0");
        value %= rhs;
      }
    }
    return value;
  }

  function parseExpr(): number {
    let value = parseTerm();
    while (pos < sanitized.length && (peek() === "+" || peek() === "-")) {
      const op = consume();
      const rhs = parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  const result = parseExpr();
  if (pos !== sanitized.length) {
    throw new Error(`表达式在位置 ${pos} 处存在多余字符`);
  }
  if (!Number.isFinite(result)) {
    throw new Error("计算结果不是有限数值");
  }
  return result;
}

registerTool({
  name: "calculator",
  description:
    "计算数学表达式的结果，支持加减乘除、取模、括号和负数，例如 (12 + 3) * 4 - 5 / 2。不支持函数（如 sin/sqrt）。",
  parameters: {
    type: "object",
    properties: {
      expression: {
        type: "string",
        description: "要计算的数学表达式，例如 '1 + 2 * 3'",
      },
    },
    required: ["expression"],
  },
  execute: async (args) => {
    const expression = String(args.expression ?? "");
    if (!expression.trim()) {
      throw new Error("expression 参数不能为空");
    }
    const result = evaluateExpression(expression);
    return { expression, result };
  },
});
