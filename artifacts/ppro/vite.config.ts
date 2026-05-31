import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";
import fs from "fs";
import pkg from "./package.json";

const rawPort = process.env.PORT ?? "4173";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

function sqljsWasmPlugin() {
  const wasmRel = path.join("..", "..", "node_modules", "sql.js", "dist", "sql-wasm-browser.wasm");

  return {
    name: "sqljs-wasm",
    configureServer(server: any) {
      server.middlewares.use("/sql-wasm-browser.wasm", (req: any, res: any, _next: any) => {
        const wasmPath = path.join(import.meta.dirname, wasmRel);
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
    writeBundle() {
      const wasmPath = path.join(import.meta.dirname, wasmRel);
      if (!fs.existsSync(wasmPath)) {
        throw new Error("sql.js WASM not found: " + wasmPath);
      }
      const outDir = path.join(import.meta.dirname, "dist", "public");
      fs.mkdirSync(outDir, { recursive: true });
      fs.copyFileSync(wasmPath, path.join(outDir, "sql-wasm-browser.wasm"));
    },
  };
}

const STATIC_EXT_RE = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|wasm|map|html|json|txt)$/i;

function spaFallbackPlugin() {
  const rewrite = (req: any, res: any, next: any) => {
    if (req.method === "GET" && req.url && !STATIC_EXT_RE.test(req.url) && !req.url.startsWith("/@")) {
      req.url = "/index.html";
    }
    next();
  };
  return {
    name: "spa-fallback",
    // NOTE: configureServer intentionally omitted. Vite's dev server already
    // handles SPA fallback natively for unmatched routes. Adding our own
    // rewrite causes vite:import-analysis to try parsing index.html as JS.
    configurePreviewServer(server: any) {
      server.middlewares.use(rewrite);
    },
  };
}

export default defineConfig({
  base: basePath,
  define: {
    __APP_VERSION__: JSON.stringify(`v${pkg.version}`),
  },
  plugins: [
    react(),
    tailwindcss(),
    visualizer({
      filename: "dist/stats.html",
      open: false,
      gzipSize: true,
    }),
    sqljsWasmPlugin(),
    spaFallbackPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      "@workspace/crypto": path.resolve(import.meta.dirname, "..", "..", "lib", "crypto", "src", "index.ts"),
      "@workspace/browser-backend": path.resolve(import.meta.dirname, "..", "..", "lib", "browser-backend", "src", "index.ts"),
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
