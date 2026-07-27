/**
 * Local config shim.
 *
 * Some parts of the frontend import from "../config".
 * During this repo snapshot, the shared package "@cinemax/config"
 * is used elsewhere (e.g. Footer), but a local "src/config.ts" is
 * required for relative imports like "../config".
 */

/**
 * Resolve an optional service base URL.
 *
 * If the provided env value is missing, returns empty string.
 * Otherwise ensures it does not end with a trailing slash.
 */
export function resolveOptionalServiceUrl(envValue: string | undefined): string {
  // Use environment variable if available, otherwise empty (same-origin).
  if (envValue && envValue.trim()) {
    return String(envValue).replace(/\/+$/, "");
  }
  return "";
}

/**
 * Compatibility helper: allow resolving a service url with a fallback.
 */
export function resolveServiceUrl(envValue: string | undefined, fallback: string): string {
  if (!envValue) return fallback;
  return String(envValue).replace(/\/+$/, "") || fallback;
}

