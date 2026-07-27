import React from "react";
import { Movie } from "../types";
import { Download, X, Check, Loader2, Trash2 } from "lucide-react";
import { getImageUrl } from "../utils/tmdb";

interface FullMovieDownloadModalProps {
  movie: Movie | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: () => Promise<{ ok: boolean; error?: string }>;
  isDownloading: boolean;
  downloadResult: { ok: boolean; error?: string } | null;
  storageType?: "device" | "cinemax";
  onDelete?: () => void;
  clickPosition?: { x: number; y: number } | null;
}

export const FullMovieDownloadModal: React.FC<FullMovieDownloadModalProps> = ({
  movie,
  isOpen,
  onClose,
  onDownload,
  isDownloading,
  downloadResult,
  storageType = "device",
  onDelete,
  clickPosition,
}) => {
  if (!isOpen || !movie) return null;

  const handleDownload = async () => {
    await onDownload();
  };

  const handleDelete = async () => {
    if (onDelete) {
      await onDelete();
    }
  };

  const title = movie.title || movie.name || "Untitled";
  const posterUrl = getImageUrl(movie.poster_path, "w500");

  // Calculate position - if clickPosition is provided, use it, otherwise center
  const positionStyle = clickPosition
    ? {
        position: 'fixed' as const,
        left: `${clickPosition.x}px`,
        top: `${clickPosition.y}px`,
        transform: 'translateX(-50%)',
      }
    : {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="relative w-full max-w-sm mx-4 pointer-events-auto" style={positionStyle}>
        {/* Clean popup card - no backdrop darkening */}
        <div className="relative bg-[#0c0c0c] border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-lg bg-neutral-900/80 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Content */}
          <div className="p-5">
            {/* Movie info */}
            <div className="flex gap-4 mb-5">
              <div className="flex-shrink-0 w-20 h-28 rounded-lg overflow-hidden bg-neutral-900">
                <img
                  src={posterUrl}
                  alt={title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-sans font-bold text-base text-white truncate mb-1">
                  {title}
                </h3>
                <p className="text-xs text-neutral-500 line-clamp-2">
                  {movie.overview || "No description available."}
                </p>
                <span className="inline-block mt-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
                  {storageType === "device" ? "Device Storage" : "Cinemax Storage"}
                </span>
              </div>
            </div>

            {/* Download button or status */}
            {!downloadResult && !isDownloading && (
              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 bg-[#39FF14] hover:bg-[#31dd11] text-black font-bold py-3 rounded-xl transition-colors cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>Download Full Movie</span>
              </button>
            )}

            {isDownloading && (
              <div className="w-full flex items-center justify-center gap-2 bg-neutral-800 text-neutral-300 font-bold py-3 rounded-xl">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Downloading...</span>
              </div>
            )}

            {downloadResult && (
              <div className={`w-full flex items-center justify-center gap-2 font-bold py-3 rounded-xl ${
                downloadResult.ok 
                  ? "bg-green-500/20 text-green-400 border border-green-500/30" 
                  : "bg-red-500/20 text-red-400 border border-red-500/30"
              }`}>
                {downloadResult.ok ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Download Complete</span>
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4" />
                    <span className="text-xs">{downloadResult.error || "Download failed"}</span>
                  </>
                )}
              </div>
            )}

            {/* Delete button for already downloaded items */}
            {downloadResult?.ok && onDelete && (
              <button
                onClick={handleDelete}
                className="w-full mt-3 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete from {storageType === "device" ? "Device" : "Cinemax"}</span>
              </button>
            )}

            {/* Info text */}
            <p className="text-[10px] text-neutral-600 text-center mt-4">
              Direct video download • {storageType === "device" ? "Local storage" : "App library"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
