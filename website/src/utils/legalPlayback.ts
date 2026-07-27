/**
 * Legal playback helpers.
 *
 * Cinemax plays two kinds of video, both legitimate:
 *  1. Official trailers, embedded straight from YouTube using the key TMDB
 *     (or an admin's own content entry) provides.
 *  2. Titles the site owner has uploaded themselves and owns the rights to,
 *     served as a plain file from our own backend.
 *
 * There is no third-party embed aggregation, no scraping, and no proxying
 * of someone else's stream here.
 */

export const TRAILER_IFRAME_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";

export function buildTrailerEmbedUrl(youtubeKey: string): string {
  return `https://www.youtube.com/embed/${youtubeKey}?autoplay=1&rel=0`;
}

const API_BASE =
  typeof import.meta === "object" && (import.meta as any).env?.VITE_API_BASE_URL
    ? String((import.meta as any).env.VITE_API_BASE_URL).replace(/\/+$/, "")
    : "";

/**
 * Resolves the URL for a self-hosted video file, given the relative path
 * (e.g. "/uploads/videos/xyz.mp4") the backend stored it at.
 */
export function buildOwnedVideoUrl(videoPath: string): string {
  if (/^https?:\/\//i.test(videoPath)) return videoPath;
  return `${API_BASE}${videoPath.startsWith("/") ? "" : "/"}${videoPath}`;
}
