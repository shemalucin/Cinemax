import React, { useState, useEffect } from "react";
import { Movie } from "../types";
import { Download, Smartphone, HardDrive, X, Trash2 } from "lucide-react";
import { getImageUrl } from "../utils/tmdb";
import { getStorageUsage, formatBytes } from "../utils/localDownloads";

interface DownloadChoiceModalProps {
  movie: Movie | null;
  isOpen: boolean;
  onClose: () => void;
  onChoose: (choice: "device" | "cinemax") => void;
}

export const DownloadChoiceModal: React.FC<DownloadChoiceModalProps> = ({
  movie,
  isOpen,
  onClose,
  onChoose,
}) => {
  const [storageUsage, setStorageUsage] = useState({ device: 0, cinemax: 0, total: 0 });

  useEffect(() => {
    if (isOpen) {
      getStorageUsage().then(setStorageUsage);
    }
  }, [isOpen]);

  if (!isOpen || !movie) return null;

  const handleSelectChoice = (choice: "device" | "cinemax") => {
    onChoose(choice);
  };

  return (
    <div id="download-choice-backdrop" className="fixed inset-0 z-55 flex items-center justify-center modal-backdrop p-4 animate-fade-in">
      <div id="download-choice-modal" className="relative w-full max-w-2xl overflow-hidden rounded-2xl border surface-panel md:flex animate-fade-in">
        <button
          id="close-download-choice-modal-btn"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 rounded-lg surface-elevated p-2 text-neutral-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div id="download-choice-poster-panel" className="hidden w-2/5 md:block bg-neutral-900">
          <img
            src={getImageUrl(movie.poster_path)}
            alt={movie.title || movie.name}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>

        <div id="download-choice-content-panel" className="flex flex-1 flex-col justify-between p-6 md:p-8">
          <div>
            <span className="inline-block rounded-md accent-chip px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest mb-3">
              Download Options
            </span>
            <h2 className="font-sans text-2xl font-bold tracking-tight mb-2">
              {movie.title || movie.name}
            </h2>

            <p className="text-sm text-neutral-400 line-clamp-3 leading-relaxed mb-6">
              Choose where you want to save this movie for offline viewing.
            </p>

            {/* Storage Usage Display */}
            <div className="bg-[#0a0a0a]/40 rounded-xl p-4 mb-6 border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-neutral-400">Storage Usage</span>
                <span className="text-xs font-bold text-[#39FF14]">{formatBytes(storageUsage.total)} used</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-neutral-500">Device Storage</span>
                  <span className="text-neutral-300">{formatBytes(storageUsage.device)}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-neutral-500">Cinemax Storage</span>
                  <span className="text-neutral-300">{formatBytes(storageUsage.cinemax)}</span>
                </div>
              </div>
            </div>

            <h3 className="text-center font-sans text-base font-semibold mb-4">Where would you like to save?</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
              <button
                id="modal-choose-device-btn"
                onClick={() => handleSelectChoice("device")}
                className="group flex flex-col items-center justify-center rounded-2xl border accent-chip p-5 text-center hover:border-[#39FF14] transition-colors cursor-pointer"
              >
                <div className="mb-3 rounded-full logo-mark p-3 group-hover:scale-105 transition-transform">
                  <Smartphone className="h-5 w-5 fill-black text-black" />
                </div>
                <span className="font-semibold">Save to Device</span>
                <span className="mt-1 text-[10px] text-neutral-400">Download to local storage</span>
              </button>

              <button
                id="modal-choose-cinemax-btn"
                onClick={() => handleSelectChoice("cinemax")}
                className="group flex flex-col items-center justify-center rounded-2xl border surface-elevated p-5 text-center hover:border-[#39FF14] transition-colors cursor-pointer"
              >
                <div className="mb-3 rounded-full surface-elevated p-3 text-neutral-300 group-hover:scale-105 group-hover:bg-[#39FF14]/10 transition-transform">
                  <HardDrive className="h-5 w-5" />
                </div>
                <span className="font-semibold">Save to Cinemax</span>
                <span className="mt-1 text-[10px] text-neutral-400">Add to app library</span>
              </button>
            </div>
          </div>

          <div className="text-center">
            <p className="text-[10px] text-neutral-500">
              "Save to Device" downloads the file to your device storage.<br />
              "Save to Cinemax" adds it to your in-app Downloads section.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
