// weather 工具：纯真实 API (wttr.in) 查询，无任何 Mock 数据
import { registerTool } from "./registry.js";

registerTool({
  name: "weather",
  description:
    "查询指定城市的实时天气状况（通过真实 wttr.in 气象 API 接口获取数据）。",
  parameters: {
    type: "object",
    properties: {
      city: {
        type: "string",
        description: "城市名称，例如 '北京'、'上海'、'Hangzhou'、'Tokyo'",
      },
    },
    required: ["city"],
  },
  execute: async (args) => {
    const city = String(args.city ?? "").trim();
    if (!city) {
      throw new Error("city 参数不能为空");
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as {
          current_condition?: Array<{
            temp_C?: string;
            humidity?: string;
            FeelsLikeC?: string;
            windspeedKmph?: string;
            weatherDesc?: Array<{ value?: string }>;
          }>;
        };

        const current = data.current_condition?.[0];
        if (current) {
          const conditionDesc = current.weatherDesc?.[0]?.value ?? "Sunny";
          const tempC = Number(current.temp_C ?? 0);
          const humidity = Number(current.humidity ?? 0);
          const feelsLike = Number(current.FeelsLikeC ?? tempC);
          const windKmph = Number(current.windspeedKmph ?? 0);

          return {
            city,
            condition: conditionDesc,
            temperatureC: tempC,
            humidityPercent: humidity,
            feelsLikeC: feelsLike,
            windKmph,
            source: "wttr.in 真实气象数据",
          };
        }
      }
    } catch (err) {
      throw new Error(`天气 API 查询失败: ${(err as Error).message}`);
    }

    throw new Error(`未找到城市 '${city}' 的实时气象数据，请检查城市拼写或名称`);
  },
});
