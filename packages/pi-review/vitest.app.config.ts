import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./app/src/setup.ts"],
    include: ["app/src/**/*.test.{ts,tsx}"],
  },
});
