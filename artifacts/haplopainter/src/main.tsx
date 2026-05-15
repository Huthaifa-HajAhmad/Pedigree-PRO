import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { migrateLegacyKeys } from "./lib/safe-local-storage";

migrateLegacyKeys();
createRoot(document.getElementById("root")!).render(<App />);
