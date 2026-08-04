// chart_generator 工具：生成数据可视化图表（柱状图、折线图、饼图与流程图），模仿 ChatGPT 数据分析画图能力
import { registerTool } from "./registry.js";

export interface ChartData {
  title: string;
  chartType: "bar" | "line" | "pie";
  labels: string[];
  values: number[];
  unit?: string;
  description?: string;
}

registerTool({
  name: "chart_generator",
  description:
    "生成数据可视化图表（柱状图、折线图、饼图）。当用户需要对比数据、查看趋势或分析百分比时使用。返回包含 labels 和 values 的图表 JSON，以便前端直接渲染图表卡片。",
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "图表标题，例如 '2026年第二季度营收对比'",
      },
      chartType: {
        type: "string",
        enum: ["bar", "line", "pie"],
        description: "图表类型：bar (柱状图), line (折线图), pie (饼图)",
      },
      labels: {
        type: "array",
        items: { type: "string" },
        description: "数据标签列表，例如 ['一月', '二月', '三月']",
      },
      values: {
        type: "array",
        items: { type: "number" },
        description: "数据数值列表，例如 [120, 200, 150]",
      },
      unit: {
        type: "string",
        description: "数据单位（可选），例如 '万元'、'%'、'次'",
      },
      description: {
        type: "string",
        description: "图表分析说明或简要结论",
      },
    },
    required: ["title", "chartType", "labels", "values"],
  },
  execute: async (args) => {
    const title = String(args.title ?? "数据图表").trim();
    const chartType = (String(args.chartType ?? "bar").toLowerCase() as "bar" | "line" | "pie");
    const labels = Array.isArray(args.labels) ? args.labels.map((l) => String(l)) : [];
    const values = Array.isArray(args.values) ? args.values.map((v) => Number(v) || 0) : [];
    const unit = args.unit ? String(args.unit) : "";
    const description = args.description ? String(args.description) : "";

    if (labels.length === 0 || values.length === 0) {
      throw new Error("labels 与 values 不能为空");
    }
    if (labels.length !== values.length) {
      throw new Error("labels 与 values 的数组长度必须一致");
    }

    return {
      title,
      chartType,
      labels,
      values,
      unit,
      description,
      formattedCode: `\`\`\`chart\n${JSON.stringify({ title, chartType, labels, values, unit, description }, null, 2)}\n\`\`\``,
    };
  },
});
