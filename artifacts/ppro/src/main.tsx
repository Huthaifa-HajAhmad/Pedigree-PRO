import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import App from "./App";
import "./index.css";
import { migrateLegacyKeys } from "./lib/safe-local-storage";

import * as api from "@workspace/api-client-react";

migrateLegacyKeys();

if (typeof window !== "undefined") {
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
