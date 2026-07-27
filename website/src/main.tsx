import "./utils/apiBase";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Safety net for errors thrown outside React's render cycle (event handlers,
// async callbacks, timers, etc.) — these are NOT caught by an ErrorBoundary,
// so without this they'd be silently swallowed and hard to track down.
window.addEventListener("error", (event) => {
  console.error("[Cinemax] Uncaught error:", event.error || event.message);
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("[Cinemax] Unhandled promise rejection:", event.reason);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });
}
