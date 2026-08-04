// image_generator 工具：生成 AI 绘画/图片，模仿 ChatGPT DALL-E 生图能力
import { registerTool } from "./registry.js";

function translatePromptToEnglish(prompt: string): string {
  let p = prompt;
  const dict: Record<string, string> = {
    水墨: "traditional Chinese ink wash painting, elegant masterpiece, highly detailed",
    国画: "Chinese traditional painting, watercolor art",
    山水: "Chinese mountain landscape painting, mist and clouds",
    赛博朋克: "cyberpunk futuristic neon city, 8k resolution",
    日落: "dramatic sunset golden hour lighting, cinematic",
    星空: "night sky full of stars galaxy, photorealistic",
    动漫: "anime style illustration, vibrant color background",
    写实: "photorealistic 8k detailed photography",
    海报: "artistic poster design, clean layout",
  };

  for (const [key, val] of Object.entries(dict)) {
    if (p.includes(key)) {
      p = p.replace(new RegExp(key, "g"), val);
    }
  }

  if (/[\u4e00-\u9fa5]/.test(p)) {
    return `${p}, beautiful artwork, highly detailed, 8k resolution`;
  }
  return p;
}

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
    const rawPrompt = String(args.prompt ?? "").trim();
    if (!rawPrompt) {
      throw new Error("必须提供生图提示词 prompt");
    }

    const width = Number(args.width) || 800;
    const height = Number(args.height) || 600;

    const translated = translatePromptToEnglish(rawPrompt);
    const encodedPrompt = encodeURIComponent(translated);

    // 使用 Pollinations.ai 免费高速 AI 绘画服务
    const imageUrl = `https://pollinations.ai/p/${encodedPrompt}?width=${width}&height=${height}&seed=${Math.floor(
      Math.random() * 1000000
    )}&nologo=true`;

    return {
      prompt: rawPrompt,
      imageUrl,
      markdownImage: `![${rawPrompt}](${imageUrl})`,
      message: `已成功为你生成 AI 艺术插画。`,
    };
  },
});
