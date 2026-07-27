import React, { useState, useEffect } from "react";
import { Movie } from "../types";
import { useApp } from "../context/AppContext";
import { Play, Film, X, CheckSquare, Square, Clock, Star } from "lucide-react";
import { getImageUrl, tmdb, isTvShow } from "../utils/tmdb";

interface WatchChoiceModalProps {
  movie: Movie | null;
  isOpen: boolean;
  onClose: () => void;
  onChoose: (choice: "full" | "trailer") => void;
}

/**
 * Prompt shown after clicking any movie card: pick "Watch Full Movie"
 * (embedded provider stream, keyed by TMDB id) or "Watch Trailer" (official
 * YouTube trailer, plays beautifully in fullscreen).
 *
 * Full movies are always available for any TMDB title through the embed
 * providers, so neither button is disabled — the choice is purely UX.
 */
export const WatchChoiceModal: React.FC<WatchChoiceModalProps> = ({
  movie,
  isOpen,
  onClose,
  onChoose,
}) => {
  const { rememberChoice, setRememberChoice, setDefaultWatchChoice } = useApp();
  const [localRemember, setLocalRemember] = useState(rememberChoice);
  const [movieDetails, setMovieDetails] = useState<Movie | null>(null);

  useEffect(() => {
    if (!movie) return;
    setLocalRemember(rememberChoice);
    setMovieDetails(movie);
    if (!movie.runtime && movie.id && !movie.isCustom) {
      const fetchDetails = async () => {
        try {
          const data = isTvShow(movie)
            ? await tmdb.getTVDetails(movie.id)
            : await tmdb.getMovieDetails(movie.id);
          setMovieDetails(data);
        } catch {
          /* keep basic info */
        }
      };
      fetchDetails();
    }
  }, [movie, rememberChoice]);

  if (!isOpen || !movie) return null;

  const handleSelectChoice = (choice: "full" | "trailer") => {
    if (localRemember) {
      setRememberChoice(true);
      setDefaultWatchChoice(choice);
      localStorage.setItem("cinemax_remember_choice", "true");
      localStorage.setItem("cinemax_default_choice", choice);
    } else {
      setRememberChoice(false);
      setDefaultWatchChoice(null);
      localStorage.setItem("cinemax_remember_choice", "false");
      localStorage.removeItem("cinemax_default_choice");
    }
    onChoose(choice);
  };

  const isTv = isTvShow(movie);
  const runtimeText = movieDetails?.runtime
    ? `${Math.floor(movieDetails.runtime / 60)}h ${movieDetails.runtime % 60}m`
    : movieDetails?.episode_run_time?.length
    ? `${movieDetails.episode_run_time[0]}m per ep`
    : "—";
  const yearText =
    (movieDetails?.release_date || movieDetails?.first_air_date || "").slice(0, 4) || "—";

  return (
    <div
      id="watch-choice-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 animate-fade-in"
    >
      <div
        id="watch-choice-modal"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm sm:max-w-xl md:max-w-2xl overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-gradient-to-br from-[#0f0f10] via-[#111114] to-[#0a0a0a] shadow-[0_20px_80px_rgba(0,0,0,0.7)] md:flex animate-fade-in"
      >
        <button
          id="close-choice-modal-btn"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 sm:right-4 sm:top-4 z-20 rounded-full bg-black/60 border border-white/10 p-1.5 sm:p-2 text-neutral-400 hover:text-white hover:border-white/20 transition-colors cursor-pointer"
        >
          <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </button>

        <div id="choice-modal-poster-panel" className="hidden md:block w-2/5 relative">
          <img
            src={getImageUrl(movie.poster_path)}
            alt={movie.title || movie.name}
            className="absolute inset-0 h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0a0a0a]/60" />
        </div>

        <div id="choice-modal-content-panel" className="flex flex-1 flex-col justify-between p-4 sm:p-6 md:p-8">
          <div>
            <span className="inline-block rounded-md bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14] px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mb-2 sm:mb-3">
              {isTv ? "TV Show" : "Movie"}
            </span>
            <h2 className="font-sans text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-white mb-1.5 sm:mb-2 pr-8">
              {movie.title || movie.name}
            </h2>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[11px] sm:text-xs text-neutral-400 mb-3 sm:mb-5">
              {movie.vote_average != null && (
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-400 fill-amber-400" />
                  <span className="font-semibold text-white">{movie.vote_average.toFixed(1)}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span>{runtimeText}</span>
              </div>
              <div>{yearText}</div>
            </div>

            {movie.overview && (
              <p className="hidden sm:block text-sm text-neutral-400 line-clamp-3 leading-relaxed mb-6">
                {movie.overview}
              </p>
            )}

            <h3 className="text-center text-xs sm:text-sm font-semibold text-neutral-300 mb-2 sm:mb-3">
              How would you like to watch?
            </h3>

            <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-5">
              <button
                id="modal-choose-full-btn"
                onClick={() => handleSelectChoice("full")}
                className="group flex flex-col items-center justify-center rounded-xl sm:rounded-2xl border border-[#39FF14]/40 bg-gradient-to-br from-[#39FF14]/15 to-[#39FF14]/5 p-2.5 sm:p-4 text-center hover:from-[#39FF14]/25 hover:border-[#39FF14] transition-all cursor-pointer"
              >
                <div className="mb-1.5 sm:mb-2 rounded-full bg-[#39FF14] p-2 sm:p-2.5 group-hover:scale-110 transition-transform">
                  <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-black text-black ml-0.5" />
                </div>
                <span className="text-xs sm:text-sm font-bold text-white">Watch Full Movie</span>
                <span className="mt-0.5 sm:mt-1 text-[9px] sm:text-[10px] text-neutral-400">
                  {isTv ? "Stream episodes in HD" : "Stream in HD"}
                </span>
              </button>

              <button
                id="modal-choose-trailer-btn"
                onClick={() => handleSelectChoice("trailer")}
                className="group flex flex-col items-center justify-center rounded-xl sm:rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 sm:p-4 text-center hover:border-white/25 hover:bg-white/[0.06] transition-all cursor-pointer"
              >
                <div className="mb-1.5 sm:mb-2 rounded-full bg-white/10 p-2 sm:p-2.5 text-neutral-200 group-hover:scale-110 transition-transform">
                  <Film className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
                <span className="text-xs sm:text-sm font-bold text-white">Watch Trailer</span>
                <span className="mt-0.5 sm:mt-1 text-[9px] sm:text-[10px] text-neutral-400">Official preview</span>
              </button>
            </div>
          </div>

          <button
            id="remember-choice-checkbox"
            onClick={() => setLocalRemember(!localRemember)}
            className="flex items-center gap-2 self-center py-1.5 sm:py-2 px-3 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
          >
            {localRemember ? (
              <CheckSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#39FF14]" />
            ) : (
              <Square className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-neutral-600" />
            )}
            <span className="text-[11px] sm:text-xs text-neutral-400 select-none">
              Remember my choice for future titles
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
