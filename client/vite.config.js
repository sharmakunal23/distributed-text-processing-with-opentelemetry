import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/otlp": {
        target: "http://localhost:4318",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/otlp/, ""),
      },
    },
  },
});
