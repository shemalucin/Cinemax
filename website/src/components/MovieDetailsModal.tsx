import React, { useEffect, useState } from "react";
import { Movie, CastMember } from "../types";
import { getImageUrl, tmdb, isTvShow } from "../utils/tmdb";
import { useApp } from "../context/AppContext";
import { X, Play, Star, Clock, Info, Check, Film, Heart, Share2, TrendingUp, Users, Facebook, MessageCircle, Copy, Bookmark } from "lucide-react";
import { MovieCard } from "./MovieCard";

interface MovieDetailsModalProps {
  movie: Movie | null;
  isOpen: boolean;
  onClose: () => void;
  onPlay: (movie: Movie) => void;
  onWatchTrailer?: (movie: Movie) => void;
  onAddToWatchlist?: (movie: Movie) => void;
}

/**
 * A beautifully redesigned full-detail view of a single title with modern UI
 * featuring enhanced visual hierarchy, better information architecture, and
 * stunning design elements for an exceptional user experience.
 */
export const MovieDetailsModal = ({ movie, isOpen, onClose, onPlay, onWatchTrailer, onAddToWatchlist }: MovieDetailsModalProps) => {
  const { user, likeMovie, unlikeMovie, removeFromWatchlist } = useApp();
  const [details, setDetails] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [socialMediaLinks, setSocialMediaLinks] = useState<Array<{ id: string; platform: string; name: string; url: string; icon: string; enabled: boolean }>>([]);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [related, setRelated] = useState<Movie[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "cast" | "similar">("overview");

  useEffect(() => {
    // Fetch social media links from backend
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.settings?.socialMediaLinks) {
          setSocialMediaLinks(data.settings.socialMediaLinks.filter((link: any) => link.enabled));
        }
      })
      .catch(err => console.error('Failed to fetch social media links:', err));
  }, []);

  const handleShare = (platform: string, url: string) => {
    const currentUrl = window.location.href;
    const title = movie?.title || movie?.name || '';
    let shareUrl = '';

    switch (platform) {
      case 'instagram':
        // Instagram doesn't support direct URL sharing, open the app
        window.open('instagram://', '_blank');
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`;
        window.open(shareUrl, '_blank', 'width=600,height=400');
        break;
      case 'whatsapp':
        shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${title} - ${currentUrl}`)}`;
        window.open(shareUrl, '_blank');
        break;
      default:
        // For custom platforms, use the provided URL if available
        if (url) {
          shareUrl = url.replace('{url}', encodeURIComponent(currentUrl)).replace('{title}', encodeURIComponent(title));
          window.open(shareUrl, '_blank');
        }
        break;
    }
    setShowShareDropdown(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  useEffect(() => {
    if (!movie) return;
    setDetails(movie);
    setImageLoaded(false);
    setCast([]);
    setRelated([]);
    setActiveTab("overview");
    if (movie.isCustom) return; // Admin-authored content has no TMDB id to deepen

    const isTvTitle = isTvShow(movie);

    const needsMore = !movie.genres || !movie.runtime;
    if (needsMore) {
      setLoading(true);
      const fetchPromise = isTvTitle ? tmdb.getTVDetails(movie.id) : tmdb.getMovieDetails(movie.id);
      fetchPromise
        .then((data) => setDetails(data))
        .catch((err) => console.error("Failed to load full movie details", err))
        .finally(() => setLoading(false));
    }

    (isTvTitle ? tmdb.getTVCredits(movie.id) : tmdb.getMovieCredits(movie.id))
      .then((c: CastMember[]) => setCast(c.slice(0, 10)))
      .catch(() => setCast([]));

    (isTvTitle ? tmdb.getTVRecommendations(movie.id) : tmdb.getMovieRecommendations(movie.id))
      .then((r: Movie[]) => setRelated(r.filter((m) => m.poster_path).slice(0, 8)))
      .catch(() => setRelated([]));
  }, [movie]);

  if (!isOpen || !movie) return null;

  const d = details || movie;
  const isTv = !d.title;
  const runtimeText = d.runtime
    ? `${Math.floor(d.runtime / 60)}h ${d.runtime % 60}m`
    : d.episode_run_time && d.episode_run_time.length > 0
    ? `${d.episode_run_time[0]}m per episode`
    : null;
  const yearText = (d.release_date || d.first_air_date || "").slice(0, 4);
  const ageRating = d.adult ? "R" : d.vote_average >= 8 ? "PG-13" : "PG";
  const ratingPercent = d.vote_average ? Math.round(d.vote_average * 10) : 0;
  const isFavorited = user ? user.favorites.includes(d.id) : false;
  const isWatchlisted = user ? (user.myList || user.watchlist || []).includes(d.id) : false;

  const handleToggleFavorite = () => {
    if (!user) return;
    if (isFavorited) unlikeMovie(d.id);
    else likeMovie(d.id);
  };

  const handleToggleWatchlist = () => {
    if (!user) return;
    if (isWatchlisted) removeFromWatchlist(d.id);
    else onAddToWatchlist?.(d);
  };

  return (
    <div
      id="movie-details-backdrop"
      className="fixed inset-0 z-55 flex items-center justify-center bg-black/95 backdrop-blur-2xl p-3 sm:p-4 md:p-6 animate-premium-fade-in"
      onClick={onClose}
    >
      {/* Premium ambient glow effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#39FF14]/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-500/3 rounded-full blur-[120px]" />
      </div>
      
      <div
        id="movie-details-modal"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto no-scrollbar rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#0d0e12] via-[#121418] to-[#1a1a2e] text-white shadow-[0_0_60px_rgba(0,0,0,0.8)] border border-white/10 animate-premium-slide-up"
      >
        {/* Premium Cinematic Backdrop with Gradient Overlay */}
        <div className="relative w-full aspect-[16/10] sm:aspect-[21/9] overflow-hidden rounded-t-2xl sm:rounded-t-3xl">
          {!imageLoaded && (
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] animate-pulse" />
          )}
          <img
            src={getImageUrl(d.backdrop_path || d.poster_path, "original")}
            alt={d.title || d.name}
            className={`w-full h-full object-cover transition-opacity duration-1000 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            referrerPolicy="no-referrer"
            onLoad={() => setImageLoaded(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0e12] via-[#0d0e12]/80 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0d0e12]/95 via-[#0d0e12]/50 to-transparent" />
          
          {/* Premium Close Button */}
          <button
            id="close-details-modal-btn"
            onClick={onClose}
            className="absolute right-4 top-4 z-30 rounded-full bg-black/50 backdrop-blur-xl p-3 text-white/80 hover:bg-black/70 hover:text-white transition-all duration-300 cursor-pointer border border-white/10 hover:border-white/20 group shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
          >
            <X className="h-5 w-5 group-hover:rotate-90 group-hover:scale-110 transition-transform duration-300" />
          </button>

          {/* Premium Title Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 lg:p-8">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <span className="rounded-lg bg-white/10 backdrop-blur-xl border border-white/15 px-3 py-1 text-[10px] sm:text-xs font-black text-white tracking-wider shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
                    HD
                  </span>
                  <span className="rounded-lg bg-gradient-to-r from-[#39FF14]/20 to-[#39FF14]/10 border border-[#39FF14]/40 px-3 py-1 text-[10px] sm:text-xs font-black text-[#39FF14] uppercase tracking-wider shadow-[0_2px_10px_rgba(57,255,20,0.3)]">
                    {isTv ? "TV Series" : "Movie"}
                  </span>
                </div>
                <h2 className="font-sans text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-white mb-2 sm:mb-3 drop-shadow-2xl">
                  {d.title || d.name}
                </h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-white/80 font-semibold">
                  {d.vote_average != null && (
                    <span className="inline-flex items-center gap-1 text-[#39FF14]">
                      <Star className="h-3.5 w-3.5 fill-[#39FF14]" />
                      {d.vote_average.toFixed(1)}
                    </span>
                  )}
                  {yearText && <span>{yearText}</span>}
                  {runtimeText && (
                    <span className="inline-flex items-center gap-1 text-white/70">
                      <Clock className="h-3.5 w-3.5" />
                      {runtimeText}
                    </span>
                  )}
                  {d.genres && d.genres.length > 0 && (
                    <span className="hidden sm:inline text-white/60 truncate">
                      {d.genres.slice(0, 3).map((g) => g.name).join(", ")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Body Content */}
        <div className="p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6">
          {/* Age rating + genre pills, single accent tone */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="px-2.5 sm:px-3 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] sm:text-xs font-bold text-neutral-300">
              {ageRating}
            </span>
            {d.genres && d.genres.length > 0 && d.genres.slice(0, 5).map((g) => (
              <span
                key={g.id}
                className="px-2.5 sm:px-3 py-1 rounded-md bg-[#39FF14]/10 border border-[#39FF14]/25 text-[10px] sm:text-xs font-semibold text-[#39FF14]"
              >
                {g.name}
              </span>
            ))}
          </div>

          {/* Premium Action Bar — primary Play, plus trailer/list/favorite/share */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-4 sm:pt-5">
            <button
              id="details-modal-play-btn"
              onClick={() => onPlay(d)}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-2 sm:gap-3 bg-gradient-to-r from-[#39FF14] to-[#31dd11] hover:from-[#31dd11] hover:to-[#2bc20f] text-black font-extrabold px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl shadow-[0_4px_30px_rgba(57,255,20,0.4)] hover:shadow-[0_6px_40px_rgba(57,255,20,0.5)] transition-all duration-300 cursor-pointer text-xs sm:text-sm md:text-base transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Play className="h-4 w-4 sm:h-5 sm:w-5 fill-black" />
              <span>Play Now</span>
            </button>

            {onWatchTrailer && (
              <button
                onClick={() => onWatchTrailer(d)}
                className="flex items-center justify-center gap-2 px-4 sm:px-5 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-bold text-xs sm:text-sm transition-all duration-300 cursor-pointer hover:scale-105"
              >
                <Film className="h-4 w-4" />
                <span className="hidden sm:inline">Trailer</span>
              </button>
            )}

            <button
              onClick={handleToggleWatchlist}
              disabled={!user}
              title={isWatchlisted ? "Remove from My List" : "Add to My List"}
              className="flex items-center justify-center h-11 w-11 sm:h-[52px] sm:w-[52px] rounded-xl sm:rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white transition-all duration-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105"
            >
              {isWatchlisted ? <Check className="h-4 w-4 sm:h-5 sm:w-5 text-[#39FF14]" /> : <Bookmark className="h-4 w-4 sm:h-5 sm:w-5" />}
            </button>

            <button
              onClick={handleToggleFavorite}
              disabled={!user}
              title={isFavorited ? "Remove from Favorites" : "Add to Favorites"}
              className={`flex items-center justify-center h-11 w-11 sm:h-[52px] sm:w-[52px] rounded-xl sm:rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white transition-all duration-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 ${
                isFavorited ? 'border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20' : ''
              }`}
            >
              <Heart className={`h-4 w-4 sm:h-5 sm:w-5 ${isFavorited ? "fill-rose-500 text-rose-500" : ""}`} />
            </button>

            <div className="relative">
              <button
                onClick={() => setShowShareDropdown((v) => !v)}
                title="Share"
                className="flex items-center justify-center h-11 w-11 sm:h-[52px] sm:w-[52px] rounded-xl sm:rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white transition-all cursor-pointer"
              >
                <Share2 className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              {showShareDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowShareDropdown(false)} />
                  <div className="absolute right-0 bottom-full mb-2 z-50 w-56 rounded-2xl border border-white/10 bg-black/80 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] p-2 space-y-1 animate-premium-fade-in">
                    <button onClick={() => handleShare("facebook", "")} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-neutral-200 hover:bg-white/5 transition-colors cursor-pointer">
                      <Facebook className="h-4 w-4 text-blue-400" /> Facebook
                    </button>
                    <button onClick={() => handleShare("whatsapp", "")} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-neutral-200 hover:bg-white/5 transition-colors cursor-pointer">
                      <MessageCircle className="h-4 w-4 text-green-400" /> WhatsApp
                    </button>
                    {socialMediaLinks.map((link) => (
                      <button key={link.id} onClick={() => handleShare(link.platform, link.url)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-neutral-200 hover:bg-white/5 transition-colors cursor-pointer">
                        <Share2 className="h-4 w-4 text-[#39FF14]" /> {link.name}
                      </button>
                    ))}
                    <button onClick={handleCopyLink} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-neutral-200 hover:bg-white/5 transition-colors cursor-pointer border-t border-white/5 mt-1 pt-2.5">
                      <Copy className="h-4 w-4" /> {copySuccess ? "Link copied!" : "Copy link"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {loading && (
            <div className="flex items-center gap-2 py-1">
              <div className="h-2 w-2 bg-[#39FF14] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="h-2 w-2 bg-[#39FF14] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="h-2 w-2 bg-[#39FF14] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="text-xs text-[#39FF14] font-medium ml-2">Loading additional details…</span>
            </div>
          )}

          {/* Premium Tab bar — Overview / Cast / More Like This */}
          <div className="flex items-center gap-5 sm:gap-6 border-b border-white/10">
            {([
              { id: "overview" as const, label: "Overview" },
              { id: "cast" as const, label: "Cast", count: cast.length },
              { id: "similar" as const, label: "More Like This", count: related.length },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative pb-3 text-xs sm:text-sm font-bold transition-all duration-300 cursor-pointer ${
                  activeTab === tab.id ? "text-white" : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {tab.label}
                {typeof tab.count === "number" && tab.count > 0 && (
                  <span className="ml-1.5 text-neutral-600">({tab.count})</span>
                )}
                {activeTab === tab.id && (
                  <span className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-gradient-to-r from-[#39FF14] to-[#31dd11] shadow-[0_0_12px_rgba(57,255,20,0.6)]" />
                )}
              </button>
            ))}
          </div>

          {/* Premium Tab panel: Overview */}
          {activeTab === "overview" && (
            <div className="animate-premium-fade-in space-y-2 sm:space-y-3">
              <div className="relative bg-white/[0.03] rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-white/10 hover:border-white/15 transition-all duration-300">
                <p className="text-xs sm:text-sm md:text-base text-neutral-300 leading-relaxed">
                  {d.overview || "No synopsis available for this title yet."}
                </p>
                <div className="absolute top-3 right-3 opacity-20">
                  <Info className="h-5 w-5 sm:h-6 sm:w-6 text-[#39FF14]" />
                </div>
              </div>
            </div>
          )}

          {/* Premium Tab panel: Cast */}
          {activeTab === "cast" && (
            <div className="animate-premium-fade-in">
              {cast.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 sm:gap-4">
                  {cast.map((member, idx) => (
                    <div key={`${member.id || member.name}-${idx}`} className="min-w-0 text-center">
                      <img
                        src={member.profile_path ? getImageUrl(member.profile_path, "w500") : "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop"}
                        alt={member.name}
                        className="mx-auto h-16 w-16 sm:h-20 sm:w-20 rounded-full object-cover border border-white/10"
                        referrerPolicy="no-referrer"
                      />
                      <p className="mt-1.5 sm:mt-2 truncate text-[10px] sm:text-[11px] font-bold text-white">{member.name}</p>
                      <p className="truncate text-[9px] sm:text-[10px] text-neutral-500">{member.character}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-neutral-500 flex items-center gap-2 py-2">
                  <Users className="h-4 w-4" /> No cast information available yet.
                </p>
              )}
            </div>
          )}

          {/* Premium Tab panel: More Like This */}
          {activeTab === "similar" && (
            <div className="animate-premium-fade-in">
              {related.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                  {related.map((rec) => (
                    <MovieCard key={rec.id} movie={rec} onClick={() => onPlay(rec)} />
                  ))}
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-neutral-500 flex items-center gap-2 py-2">
                  <TrendingUp className="h-4 w-4" /> No recommendations available yet.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MovieDetailsModal;
