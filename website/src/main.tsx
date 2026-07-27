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

/**
 * Last-resort fallback for the one class of crash an <ErrorBoundary> can
 * never catch: React itself failing to mount (e.g. the #root element is
 * missing, or `createRoot(...).render(...)` throws synchronously before any
 * component tree — including the ErrorBoundary — exists). Without this,
 * that failure mode is a permanently blank white page with no recovery path.
 * Built with plain DOM APIs (no React) since React may be exactly what's
 * broken.
 */
function showFatalFallback() {
  document.body.innerHTML = `
    <div style="min-height:100vh;width:100%;background:#0a0a0a;color:#e5e5e5;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Inter,sans-serif;">
      <div style="max-width:480px;text-align:center;">
        <div style="width:56px;height:56px;border-radius:16px;background:#39FF14;color:#000;font-weight:900;font-size:24px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">!</div>
        <h1 style="font-size:20px;font-weight:800;margin-bottom:8px;">Something went wrong</h1>
        <p style="font-size:13px;color:#a3a3a3;margin-bottom:20px;line-height:1.5;">We couldn't load the app. Please try refreshing the page.</p>
        <button onclick="window.location.reload()" style="background:#39FF14;color:#000;font-weight:700;font-size:12px;padding:10px 20px;border-radius:12px;border:none;cursor:pointer;">Reload Page</button>
      </div>
    </div>
  `;
}

try {
  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("Root element (#root) was not found in the document.");

  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (err) {
  console.error("[Cinemax] Fatal bootstrap error — React never mounted:", err);
  showFatalFallback();
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch((err) => {
        console.warn("Service worker cleanup failed:", err);
      });
  });
}

if (typeof window !== "undefined" && "caches" in window) {
  caches
    .keys()
    .then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("cinemax-shell-"))
          .map((key) => caches.delete(key))
      )
    )
    .catch((err) => {
      console.warn("Cache cleanup failed:", err);
    });
}
