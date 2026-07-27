/** Local device storage for downloaded movie packages (IndexedDB). */

const DB_NAME = "cinemax_offline_v1";
const STORE = "downloads";
const MOVIES_STORE = "movies";
const DB_VERSION = 3;

export interface LocalDownloadRecord {
  movieId: number;
  title: string;
  mediaType: "movie" | "tv";
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  voteAverage: number;
  releaseDate: string | null;
  posterBlob: Blob | null;
  backdropBlob: Blob | null;
  savedAt: string;
  sizeBytes: number;
  storageType: "device" | "cinemax";
}

export interface CinemaxDownloadRecord {
  movieId: number;
  title: string;
  mediaType: "movie" | "tv";
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  voteAverage: number;
  releaseDate: string | null;
  posterBlob: Blob | null;
  backdropBlob: Blob | null;
  savedAt: string;
  sizeBytes: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "movieId" });
      }
      if (!db.objectStoreNames.contains(MOVIES_STORE)) {
        db.createObjectStore(MOVIES_STORE, { keyPath: "movieId" });
      }
    };
  });
}

export async function saveLocalDownload(record: LocalDownloadRecord): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getLocalDownload(movieId: number): Promise<LocalDownloadRecord | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(movieId);
    req.onsuccess = () => { db.close(); resolve(req.result || null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function getAllLocalDownloads(): Promise<LocalDownloadRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result || []); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function removeLocalDownload(movieId: number): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(movieId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function clearAllLocalDownloads(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// Cinemax Download Functions (now using 'movies' store)
export async function saveCinemaxDownload(record: CinemaxDownloadRecord): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MOVIES_STORE, "readwrite");
    tx.objectStore(MOVIES_STORE).put(record);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getCinemaxDownload(movieId: number): Promise<CinemaxDownloadRecord | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MOVIES_STORE, "readonly");
    const req = tx.objectStore(MOVIES_STORE).get(movieId);
    req.onsuccess = () => { db.close(); resolve(req.result || null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function getAllCinemaxDownloads(): Promise<CinemaxDownloadRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MOVIES_STORE, "readonly");
    const req = tx.objectStore(MOVIES_STORE).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result || []); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function removeCinemaxDownload(movieId: number): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MOVIES_STORE, "readwrite");
    tx.objectStore(MOVIES_STORE).delete(movieId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function clearAllCinemaxDownloads(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MOVIES_STORE, "readwrite");
    tx.objectStore(MOVIES_STORE).clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// Storage Usage Tracking
export async function getStorageUsage(): Promise<{ device: number; cinemax: number; total: number }> {
  try {
    const [deviceDownloads, cinemaxDownloads] = await Promise.all([
      getAllLocalDownloads(),
      getAllCinemaxDownloads()
    ]);
    
    const deviceUsage = deviceDownloads.reduce((sum, record) => sum + (record.sizeBytes || 0), 0);
    const cinemaxUsage = cinemaxDownloads.reduce((sum, record) => sum + (record.sizeBytes || 0), 0);
    
    return {
      device: deviceUsage,
      cinemax: cinemaxUsage,
      total: deviceUsage + cinemaxUsage
    };
  } catch (error) {
    console.error("Error calculating storage usage:", error);
    return { device: 0, cinemax: 0, total: 0 };
  }
}

export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function pickDirectoryForDownloads(): Promise<any | null> {
  if (typeof window === "undefined") return null;
  const win = window as Window & typeof globalThis & { showDirectoryPicker?: (options?: any) => Promise<any> };
  if (typeof win.showDirectoryPicker !== "function") return null;

  try {
    return await win.showDirectoryPicker({ mode: "readwrite" });
  } catch (err: any) {
    if (err?.name !== "AbortError") {
      console.warn("Directory picker is not available; using browser download fallback.", err);
    }
    return null;
  }
}

export async function saveBlobToDevice(blob: Blob, filename: string, targetDirectory?: any): Promise<void> {
  if (typeof window === "undefined") {
    triggerBrowserDownload(blob, filename);
    return;
  }

  const win = window as Window & typeof globalThis & { showSaveFilePicker?: (options?: any) => Promise<any> };
  const safeName = filename || "download.bin";
  const extension = safeName.includes(".") ? safeName.slice(safeName.lastIndexOf(".")) : ".bin";

  try {
    if (targetDirectory?.getFileHandle) {
      const handle = await targetDirectory.getFileHandle(safeName, { create: true });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    }

    if (typeof win.showSaveFilePicker === "function") {
      const handle = await win.showSaveFilePicker({
        suggestedName: safeName,
        types: [{
          description: "Download file",
          accept: {
            [blob.type || "application/octet-stream"]: [extension],
          },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    }
  } catch (err: any) {
    // Force download even if storage is full or picker fails
    console.warn("File picker failed; forcing browser download.", err);
  }

  // Always fallback to browser download to ensure download completes
  triggerBrowserDownload(blob, filename);
}

/**
 * Download a remote file URL robustly and save it with `filename`.
 * Attempts a streamed fetch to provide progress via `onProgress` if present.
 * Throws when the browser cannot fetch the file, so callers do not report a
 * completed video download when only a remote tab opened or failed.
 */
export async function downloadRemoteFile(
  url: string,
  filename: string,
  onProgress?: (loaded: number, total?: number) => void,
  options?: { saveToDevice?: boolean; targetDirectory?: any }
): Promise<Blob> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    const contentLength = res.headers.get("Content-Length");
    const total = contentLength ? Number(contentLength) : undefined;
    if (!res.body) {
      const blob = await res.blob();
      if (options?.saveToDevice) {
        await saveBlobToDevice(blob, filename, options.targetDirectory);
      } else {
        triggerBrowserDownload(blob, filename);
      }
      return blob;
    }

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        if (onProgress) onProgress(received, total);
      }
    }
    const blob = new Blob(chunks, { type: res.headers.get("Content-Type") || "application/octet-stream" });
    if (options?.saveToDevice) {
      await saveBlobToDevice(blob, filename, options.targetDirectory);
    } else {
      triggerBrowserDownload(blob, filename);
    }
    return blob;
  } catch (err: any) {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    throw new Error(err?.message || "The browser could not fetch this video file.");
  }
}

export async function fetchPosterBlob(posterUrl: string): Promise<Blob | null> {
  try {
    const res = await fetch(posterUrl);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

/** Minimum bytes charged per title against quota (metadata + artwork). */
export const DOWNLOAD_MIN_BYTES = 2 * 1024 * 1024;
/** Maximum bytes charged per title against quota. */
export const DOWNLOAD_QUOTA_BYTES = 150 * 1024 * 1024;

export function computeDownloadSize(jsonBytes: number, posterBytes: number, backdropBytes: number): number {
  const total = jsonBytes + posterBytes + backdropBytes;
  return Math.min(DOWNLOAD_QUOTA_BYTES, Math.max(DOWNLOAD_MIN_BYTES, total));
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

