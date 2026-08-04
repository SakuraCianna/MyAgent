// image_generator 工具：生成 AI 绘画/图片，模仿 ChatGPT DALL-E 生图能力
import { registerTool } from "./registry.js";

registerTool({
  name: "image_generator",
  description:
    "根据文本提示词生成高品质 AI 绘画图片或艺术设计图（类似于 DALL-E / Midjourney）。当用户要求“画一张...”、“生成图片”、“设计一张海报”时使用。",
  parameters: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "详细英文/中文图像描述提示词，例如 'A futuristic cyberpunk city at sunset, highly detailed'",
      },
      width: {
        type: "number",
        description: "图片宽度，默认 800",
      },
      height: {
        type: "number",
        description: "图片高度，默认 600",
      },
    },
    required: ["prompt"],
  },
  execute: async (args) => {
    const prompt = String(args.prompt ?? "").trim();
    if (!prompt) {
      throw new Error("必须提供生图提示词 prompt");
    }

    const width = Number(args.width) || 800;
    const height = Number(args.height) || 600;

    const encodedPrompt = encodeURIComponent(prompt);
    // 使用 Pollinations.ai 免费高速无鉴权高清 AI 图像生成接口
    const imageUrl = `https://pollinations.ai/p/${encodedPrompt}?width=${width}&height=${height}&seed=${Math.floor(
      Math.random() * 1000000
    )}&nologo=true`;

    return {
      prompt,
      imageUrl,
      markdownImage: `![${prompt}](${imageUrl})`,
      message: `已成功为你生成 AI 艺术插画。`,
    };
  },
});
