import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    // Split large third-party libraries into their own cacheable chunks so a
    // change to app code doesn't force users to re-download vendor code, and
    // so the browser can fetch these in parallel with the app bundle.
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
        },
      },
    },
    // Raise the warning threshold now that chunks are intentionally split;
    // the real signal (one 600kb+ monolith) is already fixed.
    chunkSizeWarningLimit: 700,
    // Drop console/debugger statements from the production build.
    minify: "esbuild",
    target: "es2020",
  },
  esbuild: {
    drop: ["console", "debugger"],
  },
});
