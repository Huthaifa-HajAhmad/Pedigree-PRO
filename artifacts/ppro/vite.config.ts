import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";
import fs from "fs";

const rawPort = process.env.PORT ?? "4173";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

// Custom middleware to serve sql.js WASM file from node_modules
function sqljsWASMiddleware() {
  return {
    name: "sqljs-wasm",
    configureServer(server: any) {
      server.middlewares.use("/sql-wasm-browser.wasm", (req: any, res: any, next: any) => {
        // Go up two levels to monorepo root node_modules
        const wasmPath = path.join(import.meta.dirname, "..", "..", "node_modules", "sql.js", "dist", "sql-wasm-browser.wasm");
        if (fs.existsSync(wasmPath)) {
          res.setHeader("Content-Type", "application/wasm");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          fs.createReadStream(wasmPath).pipe(res);
        } else {
          res.statusCode = 404;
          res.end("WASM file not found: " + wasmPath);
        }
      });
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    visualizer({
      filename: "dist/stats.html",
      open: false,
      gzipSize: true,
    }),
    sqljsWASMiddleware(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      "@workspace/crypto": path.resolve(import.meta.dirname, "..", "..", "lib", "crypto", "src", "index.ts"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-label",
            "@radix-ui/react-select",
            "@radix-ui/react-separator",
            "@radix-ui/react-slot",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
          ],
          "vendor-ui": [
            "lucide-react",
            "class-variance-authority",
            "clsx",
            "tailwind-merge",
          ],
          "vendor-form": ["react-hook-form", "@hookform/resolvers", "zod"],
          "vendor-api": ["@workspace/api-client-react", "@workspace/crypto"],
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: false,
      allow: [
        path.resolve(import.meta.dirname),
        path.resolve(import.meta.dirname, "..", "..", "node_modules", "sql.js"),
      ],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
