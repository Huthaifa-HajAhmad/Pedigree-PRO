import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import App from "./App";
import "./index.css";
import { migrateLegacyKeys } from "./lib/safe-local-storage";

import * as api from "@workspace/api-client-react";

migrateLegacyKeys();

if (
  typeof window !== "undefined" &&
  (import.meta.env.DEV ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1")
) {
  (window as any).apiClient = api;
}

if (typeof window !== "undefined" && "__TAURI__" in window) {
  import("@tauri-apps/api/core").then(({ invoke }) => {
    invoke("disable_zoom").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
