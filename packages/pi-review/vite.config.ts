import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(import.meta.dirname, "app"),
  build: {
    outDir: resolve(import.meta.dirname, "app-dist"),
    emptyOutDir: true,
  },
  plugins: [react(), tailwindcss()],
});
