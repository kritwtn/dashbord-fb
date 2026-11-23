import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import path from "node:path";
import { defineConfig } from "vite";

const git = (cmd: string) => {
  try { return execSync(`git ${cmd}`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return ""; }
};

export default defineConfig({
  // stamped at build time, which is right before every deploy (needs full git history, see fetch-depth in the workflows)
  define: {
    __BUILD__: JSON.stringify({ count: git("rev-list --count HEAD"), commit: git("rev-parse --short=7 HEAD"), at: Date.now() }),
  },
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname) } },
  server: { port: 3000 },
  build: {
    rollupOptions: {
      output: { manualChunks: { firebase: ["firebase/app", "firebase/auth", "firebase/database"], charts: ["recharts"] } },
    },
  },
});
