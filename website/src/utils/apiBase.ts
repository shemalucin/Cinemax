import { resolveOptionalServiceUrl } from "../config"; // KOSORA HANO: Simbuza @cinemax/config n'inzira y'ukuri ya local file

/**
 * Cinemax API base URL + fetch shim.
 *
 * The backend lives on a separate origin on Render. Any code that calls
 * `fetch("/api/...")` with a relative path is rewritten to hit the backend,
 * and credentials are included so the session cookie flows cross-origin.
 *
 * Import this file ONCE from main.tsx (side-effect import).
 */
export const API_BASE = resolveOptionalServiceUrl((import.meta as any).env?.VITE_API_BASE_URL);

if (typeof window !== "undefined" && API_BASE) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init: RequestInit = {}) => {
    let url: string;
    if (typeof input === "string") url = input;
    else if (input instanceof URL) url = input.toString();
    else url = input.url;

    // Only rewrite relative /api/... URLs — leave absolute URLs alone.
    if (url.startsWith("/api/") || url === "/api") {
      const nextUrl = API_BASE + url;
      const nextInit: RequestInit = { 
        credentials: "include",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
          ...init.headers
        },
        ...init 
      };
      
      console.log(`[API] Rewriting ${url} to ${nextUrl}`);
      
      if (typeof input === "string" || input instanceof URL) {
        return originalFetch(nextUrl, nextInit);
      }
      // Request object — rebuild it against the new URL.
      return originalFetch(new Request(nextUrl, input), nextInit);
    }
    return originalFetch(input as any, init);
  }) as typeof window.fetch;
  
  console.log(`[API] Fetch wrapper initialized with API_BASE: ${API_BASE}`);
  
  // Test backend connectivity on load
  fetch(`${API_BASE}/api/health`)
    .then(res => {
      if (res.ok) {
        console.log(`[API] Backend connectivity check: OK`);
      } else {
        console.warn(`[API] Backend connectivity check: FAILED (status ${res.status})`);
      }
    })
    .catch(err => {
      console.error(`[API] Backend connectivity check: FAILED`, err);
      console.warn(`[API] Make sure the backend is running at: ${API_BASE}`);
    });
}
