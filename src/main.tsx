import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { appStore, startHashSync } from "./state/index.ts";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

startHashSync(appStore);

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
