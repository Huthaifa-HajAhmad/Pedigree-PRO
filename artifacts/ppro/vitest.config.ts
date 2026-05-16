import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@workspace/crypto": path.resolve(__dirname, "..", "..", "lib", "crypto", "src", "index.ts"),
      "@workspace/browser-backend": path.resolve(__dirname, "..", "..", "lib", "browser-backend", "src", "index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    exclude: ["test/e2e/**", "node_modules/**", "dist/**"],
  },
});
