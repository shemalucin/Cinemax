import React, { useState } from "react";
import { Movie } from "../types";
import { Star, Play, Check, Heart, Share2 } from "lucide-react";
import { getImageUrl, isTvShow } from "../utils/tmdb";
import { useApp } from "../context/AppContext";

interface MovieCardProps {
  movie: Movie;
  rank?: number;
  onClick: () => void;
  isPreparing?: boolean;
}

export const MovieCard = ({ movie, rank, onClick, isPreparing }: MovieCardProps) => {
  const { user, addToWatchlist, removeFromWatchlist, cardSize, likeMovie, unlikeMovie } = useApp();
  const [isHovered, setIsHovered] = useState(false);

  const isTv = isTvShow(movie);
  const titleText = movie.title || movie.name || "Untitled";
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : "0.0";
  const year = (movie.release_date || movie.first_air_date || "").slice(0, 4) || "N/A";
  const duration = movie.runtime ? `${movie.runtime} min` : movie.episode_run_time?.[0] ? `${movie.episode_run_time[0]} min` : null;
  const genres = movie.genres?.slice(0, 2).map(g => g.name).join(", ") || "";
  const overview = movie.overview || "";
  

  const isWatchlisted = user ? (user.myList || user.watchlist || []).includes(movie.id) : false;
  const isFavorited = user && user.favorites ? user.favorites.includes(movie.id) : false;
  
  // Continue watching progress (simulated)
  const watchProgress = (movie as any)._progress || 0;

  // Dynamic card width based on cardSize preference
  const getCardWidth = () => {
    switch (cardSize) {
      case "small":
        return "w-[90px] sm:w-[105px] md:w-[120px]";
      case "large":
        return "w-[130px] sm:w-[150px] md:w-[180px]";
      case "normal":
      default:
        return "w-[110px] sm:w-[130px] md:w-[150px]";
    }
  };

  const handleWatchlistClick = (e: any) => {
    e.stopPropagation();
    if (!user) return;
    if (isWatchlisted) {
      removeFromWatchlist(movie.id);
    } else {
      addToWatchlist(movie.id);
    }
  };

  const handleFavoriteClick = (e: any) => {
    e.stopPropagation();
    if (!user) return;
    if (isFavorited) {
      unlikeMovie(movie.id);
    } else {
      likeMovie(movie.id);
    }
  };

  const handleShareClick = (e: any) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({
        title: titleText,
        text: overview,
        url: window.location.href
      });
    }
  };


  return (
    <div
      id={`movie-card-${movie.id}`}
      onClick={isPreparing ? undefined : onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative flex-none ${getCardWidth()} cursor-pointer rounded-2xl sm:rounded-3xl overflow-hidden transition-all duration-500 select-none ${
        isPreparing ? "opacity-80 pointer-events-none" : "hover:-translate-y-2 hover:shadow-[0_20px_60px_-15px_rgba(57,255,20,0.3)]"
      }`}
      style={{
        background: 'linear-gradient(145deg, rgba(18,18,24,0.95), rgba(10,10,14,0.98))',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
      }}
    >
      {/* Premium ambient glow on hover */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 0%, rgba(57,255,20,0.15), transparent 70%)'
        }}
      />

      {/* Premium badges */}
      <div className="absolute top-2 left-2 z-30 flex flex-col gap-1">
        {rank !== undefined && (
          <div
            id={`rank-overlay-${movie.id}`}
            className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl sm:rounded-2xl font-sans font-black text-[10px] sm:text-sm"
            style={{
              background: 'linear-gradient(135deg, #39FF14, #31dd11)',
              boxShadow: '0 4px 15px rgba(57,255,20,0.4)'
            }}
          >
            {rank}
          </div>
        )}
      </div>

      {/* Dynamic badges from real TMDB data */}
      <div className="absolute top-2 right-2 z-30 flex flex-col gap-1 items-end">
        {/* Language badge from original_language */}
        {movie.original_language && (
          <div className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-300">
            <span className="text-[9px] font-semibold text-neutral-400 uppercase">{movie.original_language}</span>
          </div>
        )}
      </div>

      <div id={`poster-container-${movie.id}`} className="relative aspect-[2/3] w-full overflow-hidden bg-neutral-800">
        <img
          src={getImageUrl(movie.poster_path, "w500")}
          alt={titleText}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          loading="lazy"
          referrerPolicy="no-referrer"
        />

        {/* Continue watching progress bar */}
        {watchProgress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
            <div 
              className="h-full bg-gradient-to-r from-[#39FF14] to-[#31dd11] transition-all duration-300"
              style={{ width: `${watchProgress}%` }}
            />
          </div>
        )}

        {/* Premium loading state */}
        {isPreparing && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/80 backdrop-blur-sm">
            <div className="relative">
              <div className="absolute inset-0 bg-[#39FF14]/20 rounded-full blur-xl" />
              <div className="relative h-6 w-6 sm:h-8 sm:w-8 text-[#39FF14] animate-spin rounded-full border-2 border-[#39FF14] border-t-transparent" />
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#39FF14]">Loading…</span>
          </div>
        )}

        {/* Premium glassmorphism hover overlay */}
        <div
          id={`hover-overlay-${movie.id}`}
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-between p-3 sm:p-4 z-20"
          style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.8) 100%)',
            backdropFilter: 'blur(8px)'
          }}
        >
          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleWatchlistClick}
              className={`p-2 rounded-full border transition-all duration-300 cursor-pointer ${
                isWatchlisted
                  ? "bg-[#39FF14] border-[#39FF14] shadow-[0_0_15px_rgba(57,255,20,0.5)]"
                  : "bg-white/10 border-white/20 text-white hover:bg-white/20"
              }`}
            >
              {isWatchlisted ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[3px] text-black" /> : <span className="text-lg font-bold">+</span>}
            </button>
            <button
              onClick={handleFavoriteClick}
              className={`p-2 rounded-full border transition-all duration-300 cursor-pointer ${
                isFavorited
                  ? "bg-red-500 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                  : "bg-white/10 border-white/20 text-white hover:bg-white/20"
              }`}
            >
              <Heart className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isFavorited ? 'fill-white text-white' : ''}`} />
            </button>
            <button
              onClick={handleShareClick}
              className="p-2 rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-all duration-300 cursor-pointer"
            >
              <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          </div>

          {/* Premium play button with glow */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative">
              <div 
                className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: 'radial-gradient(circle, rgba(57,255,20,0.4), transparent 70%)',
                  filter: 'blur(20px)'
                }}
              />
              <div 
                className="relative rounded-full p-4 sm:p-5 opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-500"
                style={{
                  background: 'linear-gradient(135deg, #39FF14, #31dd11)',
                  boxShadow: '0 8px 32px rgba(57,255,20,0.4)'
                }}
              >
                <Play className="h-5 w-5 sm:h-6 sm:w-6 fill-black ml-0.5" />
              </div>
            </div>
          </div>

          {/* Premium info section */}
          <div className="space-y-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-amber-400">
                <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-amber-400" />
                <span className="text-[11px] sm:text-xs font-bold text-white">{rating}</span>
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold text-neutral-400">•</span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-neutral-300">{year}</span>
              {duration && (
                <>
                  <span className="text-[10px] sm:text-[11px] font-bold text-neutral-400">•</span>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-neutral-300">{duration}</span>
                </>
              )}
            </div>
            

            <h4 className="text-[11px] sm:text-xs font-bold text-white line-clamp-1 drop-shadow-lg">{titleText}</h4>
            {genres && (
              <p className="text-[9px] sm:text-[10px] text-neutral-400 line-clamp-1">{genres}</p>
            )}
            {overview && (
              <p className="text-[9px] sm:text-[10px] text-neutral-500 line-clamp-2 leading-relaxed">{overview}</p>
            )}
          </div>
        </div>
      </div>

      {/* Premium card footer */}
      <div id={`card-footer-${movie.id}`} className="relative p-2.5 sm:p-3 space-y-1.5" style={{
        background: 'linear-gradient(180deg, rgba(18,18,24,0.9), rgba(10,10,14,0.95))',
        borderTop: '1px solid rgba(255,255,255,0.05)'
      }}>
        <h4 className="text-[11px] sm:text-xs font-bold text-neutral-200 truncate group-hover:text-[#39FF14] transition-colors duration-300">
          {titleText}
        </h4>
        <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-neutral-500 font-medium">
          <span className={`px-2 py-0.5 rounded-md ${isTv ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
            {isTv ? "TV Show" : "Movie"}
          </span>
          <div className="flex items-center gap-1">
            <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-amber-500 fill-amber-500" />
            <span className="text-neutral-300 font-semibold">{rating}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
