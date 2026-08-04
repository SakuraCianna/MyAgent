import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Vite 配置：开发时把 /api 请求代理到后端 Express 服务，避免前端手写跨域处理
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            "/api": {
                target: "http://localhost:3001",
                changeOrigin: true,
            },
        },
    },
});
