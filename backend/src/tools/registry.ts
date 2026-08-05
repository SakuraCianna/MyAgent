// 工具注册机制：每个工具包含 名称/描述/参数Schema/执行函数
import type { ToolSchema } from "../llm/types.js";

export interface ToolExecuteContext {
  sessionId: string;
  // GitHub 工具专用：仅当该 session 启用了 github 开关且提供了 token 时才有值
  githubToken?: string;
  githubRepo?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolSchema["function"]["parameters"];
  execute: (args: Record<string, unknown>, ctx: ToolExecuteContext) => Promise<unknown>;
  // 为空表示始终可用；非空表示只有 session 对应开关打开时才会出现在 LLM 可见工具列表里
  requiresToggle?: "github";
}

const registry = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition): void {
  if (registry.has(tool.name)) {
    throw new Error(`工具重复注册: ${tool.name}`);
  }
  registry.set(tool.name, tool);
}

export function getTool(name: string): ToolDefinition | undefined {
  return registry.get(name);
}

/**
 * 根据 session 状态过滤出当前可用的工具（决定喂给 LLM 的 tools schema）。
 * githubEnabled=false 时，github_reader 完全不会出现在 schema 里，
 * 模型无从得知该工具存在，符合"不用时 Agent 完全不带这个工具"的要求。
 */
export function getActiveTools(opts: { githubEnabled: boolean }): ToolDefinition[] {
  return Array.from(registry.values()).filter((tool) => {
    if (tool.requiresToggle === "github") {
      return opts.githubEnabled;
    }
    return true;
  });
}

export function toOpenAISchema(tools: ToolDefinition[]): ToolSchema[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export function listAllTools(): ToolDefinition[] {
  return Array.from(registry.values());
}

/**
 * 集中注册所有工具。在 index.ts 启动时调用一次。
 * 使用动态 import 避免循环依赖问题（各工具文件 import registerTool）。
 */
export async function registerAllTools(): Promise<void> {
  await import("./calculator.js");
  await import("./search.js");
  await import("./weather.js");
  await import("./todo.js");
  await import("./readDocs.js");
  await import("./codeExecutor.js");
  await import("./githubReader.js");
  await import("./chart_generator.js");
  await import("./web_fetcher.js");
  await import("./image_generator.js");
  await import("./ocr_reader.js");
}
