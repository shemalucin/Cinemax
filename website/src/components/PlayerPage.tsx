import React, { useState, useEffect, useRef, useMemo } from "react";
import { Movie, CastMember, Review } from "../types";
import { useApp } from "../context/AppContext";
import {
  ArrowLeft,
  Star,
  Bookmark,
  BookmarkCheck,
  Heart,
  Share2,
  Flag,
  Play,
  ThumbsUp,
  Film,
  Clock,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Plus,
  Server,
} from "lucide-react";
import { getImageUrl, tmdb, isTvShow, getPlaybackTmdbId, prepareForPlayback } from "../utils/tmdb";
import { AdBanner } from "./AdBanner";
import { fetchPublicAds, PublicAd } from "../utils/siteConfig";
import { MovieCard } from "./MovieCard";
import { buildTrailerEmbedUrl, buildOwnedVideoUrl } from "../utils/legalPlayback";
import {
  EMBED_PROVIDERS,
  DEFAULT_EMBED_PROVIDER_ID,
  buildFullMovieEmbedUrl,
  EMBED_IFRAME_ALLOW,
} from "../utils/embedProviders";
import { LiveChat } from "./LiveChat";

type PlaybackKind = "trailer" | "video" | "embed" | "external" | "none";

type PlayerQueueItem = {
  id: number | string;
  title: string;
  subtitle?: string;
  meta?: string;
  poster: string;
  queued?: boolean;
  onSelect: () => void | Promise<void>;
};

/** "Up Next" panel matching the reference: a row of episode/movie cards
 *  with mini thumbnails, "Autoplay" toggle in the header, and a "View
 *  Full Playlist" button at the bottom. */
const UpNextPanel: React.FC<{
  items: PlayerQueueItem[];
  autoplay: boolean;
  onAutoplayChange: (v: boolean) => void;
  switchingLabel?: string | null;
}> = ({ items, autoplay, onAutoplayChange, switchingLabel }) => (
  <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,24,0.98),rgba(10,10,14,0.96))] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.85)]">
    <div className="border-b border-white/5 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#39FF14]/80">Queue</p>
          <h3 className="mt-1 text-sm font-bold text-white">Up Next</h3>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
          <button
            onClick={() => onAutoplayChange(!autoplay)}
            className="flex items-center gap-2 text-[11px] font-semibold text-neutral-300"
          >
            <span>Autoplay</span>
            <span
              className={`relative inline-flex h-4 w-7 rounded-full transition-colors ${
                autoplay ? "bg-[#39FF14]" : "bg-neutral-700"
              }`}
            >
              <span
                className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
                  autoplay ? "left-3.5" : "left-0.5"
                }`}
              />
            </span>
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-neutral-500">
        {switchingLabel
          ? `Switching to ${switchingLabel}...`
          : autoplay
          ? "Keeps the queue moving when the current playable video ends."
          : "Pick any queued title to jump there instantly."}
      </p>
    </div>
    {items.length === 0 ? (
      <div className="px-4 py-8 text-center">
        <p className="text-sm font-semibold text-white">Nothing queued yet</p>
        <p className="mt-1 text-xs text-neutral-500">Recommendations and upcoming episodes will appear here.</p>
      </div>
    ) : (
      <div className="max-h-[420px] space-y-3 overflow-y-auto p-4 no-scrollbar">
        {items.slice(0, 6).map((it, index) => (
          <button
            key={it.id}
            onClick={it.onSelect}
            className="group flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-[#39FF14]/25 hover:bg-white/[0.05]"
          >
            <div className="relative h-[72px] w-28 flex-none overflow-hidden rounded-xl bg-neutral-900">
              <img
                src={it.poster}
                alt={it.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
              <div className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/65 px-1.5 py-0.5 text-[10px] font-black tracking-wide text-white">
                {index === 0 ? "NEXT" : `#${index + 1}`}
              </div>
              {it.queued && (
                <div className="absolute bottom-2 left-2 rounded-full bg-[#39FF14] px-1.5 py-0.5 text-[9px] font-black tracking-wide text-black">
                  Queued
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{it.title}</p>
              {it.subtitle && <p className="mt-1 truncate text-xs text-neutral-400">{it.subtitle}</p>}
              <div className="mt-2 flex items-center gap-2 text-[11px] text-neutral-500">
                {it.meta && <span className="truncate">{it.meta}</span>}
                <span className="text-[#39FF14] transition-colors group-hover:text-[#8cff73]">Play now</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    )}
    {items.length > 6 && (
      <div className="border-t border-white/5 px-4 py-3">
        <button className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-2.5 text-xs font-semibold text-neutral-200 transition-colors hover:bg-white/[0.06]">
          View More
        </button>
      </div>
    )}
  </div>
);

const SimilarStrip: React.FC<{ movies: Movie[]; onSelect: (m: Movie) => void }> = ({ movies, onSelect }) => {
  if (movies.length === 0) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d0d0f] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">Similar Movies</h3>
        <button className="text-[11px] font-semibold text-[#39FF14] hover:underline">View All</button>
      </div>
      <div className="flex gap-0 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
        {movies.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m)}
            className="group text-left cursor-pointer flex-none w-32"
          >
            <div className="aspect-[2/3] rounded-lg overflow-hidden bg-neutral-900 mb-1.5">
              <img
                src={getImageUrl(m.poster_path, "w500")}
                alt={m.title || m.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                referrerPolicy="no-referrer"
              />
            </div>
            <p className="text-[11px] font-semibold text-white truncate">{m.title || m.name}</p>
            <p className="text-[10px] text-neutral-500">
              {(m.release_date || m.first_air_date || "").slice(0, 4)}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
};

export const PlayerPage: React.FC = () => {
  const {
    selectedMovie,
    setSelectedMovie,
    setPlayerMode,
    playerMode,
    addToHistory,
    user,
    likeMovie,
    unlikeMovie,
    addToWatchlist,
    removeFromWatchlist,
    setCurrentView,
    searchQuery,
  } = useApp();

  const [activeTab, setActiveTab] = useState<"overview" | "details" | "cast" | "liveChat">("overview");
  const [playerAds, setPlayerAds] = useState<PublicAd[]>([]);
  const [currentSeason, setCurrentSeason] = useState(1);
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [tvDetails, setTvDetails] = useState<any>(null);
  const [seasonsList, setSeasonsList] = useState<number[]>([]);
  const [episodesList, setEpisodesList] = useState<number[]>([]);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [playbackUrl, setPlaybackUrl] = useState<string>("");
  const [playbackKind, setPlaybackKind] = useState<PlaybackKind>("none");
  const [providerId, setProviderId] = useState<string>(DEFAULT_EMBED_PROVIDER_ID);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const iframeContainerRef = useRef<HTMLDivElement | null>(null);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [recommendations, setRecommendations] = useState<Movie[]>([]);
  const [similarMovies, setSimilarMovies] = useState<Movie[]>([]);
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [switchingLabel, setSwitchingLabel] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicAds().then((ads) =>
      setPlayerAds(ads.filter((a) => a.placement === "player_pre_roll"))
    );
  }, []);

  const isTv = selectedMovie ? isTvShow(selectedMovie) : false;
  const playbackTmdbId = selectedMovie ? getPlaybackTmdbId(selectedMovie) : null;
  const isFavorited = user && selectedMovie ? user.favorites.includes(selectedMovie.id) : false;
  const isWatchlisted =
    user && selectedMovie
      ? (user.myList || user.watchlist || []).includes(selectedMovie.id)
      : false;

  // Reset episode/season when switching titles
  useEffect(() => {
    if (!selectedMovie) return;
    setCurrentSeason(1);
    setCurrentEpisode(1);
    setTrailerKey(null);
    setIsLoadingVideo(false);
    setActiveTab("overview");
  }, [selectedMovie?.id, selectedMovie?.media_type]);

  // Load deep details
  useEffect(() => {
    if (!selectedMovie) return;
    if (selectedMovie.isCustom && !playbackTmdbId) {
      setCast([]);
      setReviews([]);
      setSimilarMovies([]);
      setRecommendations([]);
      setTrailerKey(selectedMovie.trailerYoutubeKey || null);
      return;
    }

    const loadDetails = async () => {
      try {
        const id = playbackTmdbId ?? selectedMovie.id;
        const [castData, reviewData, similarData, recData] = await Promise.all([
          isTv ? tmdb.getTVCredits(id) : tmdb.getMovieCredits(id),
          isTv ? tmdb.getTVReviews(id) : tmdb.getMovieReviews(id),
          isTv ? tmdb.getTVRecommendations(id) : tmdb.getSimilarMovies(id),
          isTv ? tmdb.getTVRecommendations(id) : tmdb.getMovieRecommendations(id),
        ]);
        setCast(castData);
        setReviews(reviewData);
        setSimilarMovies(similarData);
        setRecommendations(recData);

        try {
          const videos = isTv ? await tmdb.getTVVideos(id) : await tmdb.getMovieVideos(id);
          setTrailerKey(videos && videos.length > 0 ? videos[0].key : null);
        } catch {
          setTrailerKey(null);
        }

        if (isTv) {
          const details = await tmdb.getTVDetails(id);
          setTvDetails(details);
          const totalSeasons = details.number_of_seasons || 1;
          const seasons = Array.from({ length: totalSeasons }, (_, i) => i + 1);
          setSeasonsList(seasons.length > 0 ? seasons : [1]);
        }

        addToHistory(
          selectedMovie.id,
          selectedMovie.title || selectedMovie.name || "Untitled",
          selectedMovie.poster_path,
          isTv ? "tv" : "movie",
          selectedMovie.runtime || 124,
          isTv ? currentSeason : undefined,
          isTv ? currentEpisode : undefined
        );
      } catch (err) {
        console.error("Error loading movie player deep details", err);
      }
    };

    loadDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMovie, playbackTmdbId, isTv]);

  // Load real episode numbers for the selected season
  useEffect(() => {
    if (!selectedMovie || !playbackTmdbId || !isTv) return;
    setEpisodesList([]);
    const loadSeasonEpisodes = async () => {
      try {
        const episodes = await tmdb.getTVSeason(playbackTmdbId, currentSeason);
        const nums = [
          ...new Set(
            episodes
              .map((e) => e.episode_number)
              .filter((n) => n != null && !isNaN(n) && n > 0)
              .sort((a, b) => a - b)
          ),
        ];
        if (nums.length > 0) {
          setEpisodesList(nums);
          setCurrentEpisode(nums[0]);
        }
      } catch (err) {
        console.error("Error loading season episodes", err);
      }
    };
    loadSeasonEpisodes();
  }, [selectedMovie, playbackTmdbId, currentSeason, isTv]);

  const handleNextEpisode = () => {
    if (!isTv || episodesList.length === 0) return;
    const idx = episodesList.indexOf(currentEpisode);
    if (idx >= 0 && idx < episodesList.length - 1) {
      setCurrentEpisode(episodesList[idx + 1]);
    } else if (idx === episodesList.length - 1) {
      const sIdx = seasonsList.indexOf(currentSeason);
      if (sIdx >= 0 && sIdx < seasonsList.length - 1) {
        setCurrentSeason(seasonsList[sIdx + 1]);
        setCurrentEpisode(1);
      }
    }
  };

  const handleToggleFavorite = () => {
    if (!user || !selectedMovie) return;
    if (isFavorited) unlikeMovie(selectedMovie.id);
    else likeMovie(selectedMovie.id);
  };

  const handleToggleWatchlist = () => {
    if (!user || !selectedMovie) return;
    if (isWatchlisted) removeFromWatchlist(selectedMovie.id);
    else addToWatchlist(selectedMovie.id);
  };

  const transitionToTitle = async (movie: Movie, options?: { smoothScroll?: boolean }) => {
    const title = movie.title || movie.name || "Untitled";
    setSwitchingLabel(title);
    setIsLoadingVideo(true);
    try {
      const ready = await prepareForPlayback(movie);
      setSelectedMovie(ready);
      setPlayerMode("full");
      if (options?.smoothScroll) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch {
      setSelectedMovie({
        ...movie,
        media_type: movie.media_type ?? (isTvShow(movie) ? "tv" : "movie"),
      });
      setPlayerMode("full");
      if (options?.smoothScroll) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally {
      setSwitchingLabel(null);
      setIsLoadingVideo(false);
    }
  };

  /**
   * Decide what to play. Full-movie mode:
   *  1. External URL (admin-provided) — wins
   *  2. Admin-uploaded owned video file
   *  3. Third-party embed provider (VidCore / VidSrc / 2Embed),
   *     keyed by TMDB id and — for TV — the picked season + episode.
   * Trailer mode uses the YouTube key.
   */
  useEffect(() => {
    if (!selectedMovie) {
      setPlaybackUrl("");
      setPlaybackKind("none");
      return;
    }

    setIsLoadingVideo(true);

    if (playerMode === "trailer") {
      const key = selectedMovie.trailerYoutubeKey || trailerKey;
      if (key) {
        setPlaybackKind("trailer");
        setPlaybackUrl(buildTrailerEmbedUrl(key));
      } else {
        setPlaybackKind("none");
        setPlaybackUrl("");
      }
      setIsLoadingVideo(false);
      return;
    }

    // Full-movie modes
    if (selectedMovie.fullMovieUrl) {
      setPlaybackKind("external");
      setPlaybackUrl(selectedMovie.fullMovieUrl);
      setIsLoadingVideo(false);
      return;
    }
    if (selectedMovie.videoUrl) {
      setPlaybackKind("video");
      setPlaybackUrl(buildOwnedVideoUrl(selectedMovie.videoUrl));
      setIsLoadingVideo(false);
      return;
    }
    // Fall back to third-party embed keyed by TMDB id (skip custom CMS ids
    // that aren't real TMDB entries).
    if (playbackTmdbId) {
      setPlaybackKind("embed");
      setPlaybackUrl(
        buildFullMovieEmbedUrl(playbackTmdbId, isTv ? "tv" : "movie", {
          season: currentSeason,
          episode: currentEpisode,
          providerId,
        })
      );
      setIsLoadingVideo(false);
      return;
    }
    // No source at all — fall back to trailer if we have one
    const key = selectedMovie.trailerYoutubeKey || trailerKey;
    if (key) {
      setPlaybackKind("trailer");
      setPlaybackUrl(buildTrailerEmbedUrl(key));
    } else {
      setPlaybackKind("none");
      setPlaybackUrl("");
    }
    setIsLoadingVideo(false);
  }, [selectedMovie, playerMode, trailerKey, providerId, currentSeason, currentEpisode, isTv, playbackTmdbId]);

  const handleGoFullscreen = () => {
    const el = iframeContainerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen?.();
    }
  };

  const handlePlaybackEnded = () => {
    if (!autoPlayNext) return;
    if (isTv) {
      handleNextEpisode();
      return;
    }
    const nextMovie = recommendations[0];
    if (nextMovie) {
      transitionToTitle(nextMovie, { smoothScroll: false });
    }
  };

  const upNextItems = useMemo(() => {
    if (isTv && episodesList.length > 0) {
      // Build queue of upcoming episodes in this season
      const idx = episodesList.indexOf(currentEpisode);
      const upcoming = episodesList.slice(Math.max(0, idx + 1));
      const poster = getImageUrl(selectedMovie?.backdrop_path || selectedMovie?.poster_path, "w500");
      return upcoming.map((ep) => ({
        id: `s${currentSeason}e${ep}`,
        title: `S${currentSeason} · E${ep}`,
        subtitle: selectedMovie?.name || selectedMovie?.title,
        meta: "Upcoming episode",
        poster,
        queued: ep === currentEpisode + 1,
        onSelect: () => setCurrentEpisode(ep),
      }));
    }
    return recommendations.slice(0, 8).map((m) => ({
      id: m.id,
      title: m.title || m.name || "Untitled",
      subtitle: (m.release_date || m.first_air_date || "").slice(0, 4),
      meta: m.vote_average ? `${m.vote_average.toFixed(1)} rating` : "Recommended for you",
      poster: getImageUrl(m.poster_path || m.backdrop_path, "w500"),
      queued: m.id === recommendations[0]?.id,
      onSelect: () => transitionToTitle(m, { smoothScroll: true }),
    }));
  }, [isTv, episodesList, currentEpisode, currentSeason, recommendations, selectedMovie]);

  if (!selectedMovie) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-neutral-500 text-sm">
        No title selected.
      </div>
    );
  }

  const yearText = (selectedMovie.release_date || selectedMovie.first_air_date || "").slice(0, 4);
  const runtimeText = selectedMovie.runtime
    ? `${selectedMovie.runtime} min`
    : selectedMovie.episode_run_time?.[0]
    ? `${selectedMovie.episode_run_time[0]} min`
    : null;
  const genres =
    selectedMovie.genres?.map((g) => g.name).join(", ") ||
    (selectedMovie as any).genre_names?.join(", ") ||
    "";
  const director =
    (selectedMovie as any).director ||
    ((selectedMovie as any).crew?.find((c: any) => c.job === "Director")?.name) ||
    "—";
  const castNames = cast.slice(0, 5).map((c) => c.name).join(", ") || "—";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06070a] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(57,255,20,0.10),transparent_32%),linear-gradient(180deg,rgba(4,7,10,0.70),rgba(4,7,10,0.98))]" />
        {selectedMovie.backdrop_path && (
          <img
            src={getImageUrl(selectedMovie.backdrop_path, "original")}
            alt={selectedMovie.title || selectedMovie.name}
            className="h-full w-full object-cover opacity-[0.14] blur-[2px]"
            referrerPolicy="no-referrer"
          />
        )}
      </div>
      <div className="relative mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
        {/* Top nav: back arrow + title header block */}
        <div className="mb-5 flex items-start gap-4 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,24,0.88),rgba(9,10,14,0.84))] p-4 shadow-[0_20px_60px_-24px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-5">
          <button
            onClick={() => {
              setPlayerMode(null);
              setSelectedMovie(null);
              if (searchQuery.trim().length <= 1) setCurrentView("home");
            }}
            aria-label="Back"
            className="mt-1 flex-none rounded-full bg-white/5 hover:bg-white/10 border border-white/10 p-2.5 text-neutral-300 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#39FF14]/80">
              <span>Now Playing</span>
              <span className="h-1 w-1 rounded-full bg-[#39FF14]" />
              <span>{isTv ? "Series" : "Movie"}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white truncate">
                {selectedMovie.title || selectedMovie.name}
              </h1>
              <span className="rounded-md bg-[#39FF14]/15 border border-[#39FF14]/40 text-[#39FF14] px-2 py-0.5 text-[10px] font-black tracking-wider">
                HD
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
              {selectedMovie.vote_average != null && (
                <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                  <Star className="h-3.5 w-3.5 fill-amber-400" />
                  {selectedMovie.vote_average.toFixed(1)}
                </span>
              )}
              {yearText && <span className="text-neutral-400">{yearText}</span>}
              {runtimeText && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {runtimeText}
                </span>
              )}
              {genres && <span className="text-[#39FF14]/80 truncate">{genres}</span>}
            </div>
          </div>
          <div className="hidden flex-none items-center gap-2 md:flex">
            <button
              onClick={handleToggleWatchlist}
              className="flex flex-col items-center gap-0.5 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-neutral-300 transition-colors hover:text-white"
              title="Add to My List"
            >
              {isWatchlisted ? (
                <BookmarkCheck className="h-4 w-4 text-[#39FF14]" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span className="text-[10px] font-semibold">Add to My List</span>
            </button>
            <button className="flex flex-col items-center gap-0.5 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-neutral-300 transition-colors hover:text-white" title="Share">
              <Share2 className="h-4 w-4" />
              <span className="text-[10px] font-semibold">Share</span>
            </button>
            <button className="flex flex-col items-center gap-0.5 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-neutral-300 transition-colors hover:text-white" title="Report">
              <Flag className="h-4 w-4" />
              <span className="text-[10px] font-semibold">Report</span>
            </button>
          </div>
        </div>

        {/* Main grid: video + right sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5">
          {/* LEFT: video + tabs + overview panel */}
          <div className="min-w-0 space-y-5">
            {/* Video area */}
            <div
              ref={iframeContainerRef}
              className="relative w-full aspect-video overflow-hidden rounded-[30px] border border-white/10 bg-black shadow-[0_20px_60px_-24px_rgba(0,0,0,0.95)]"
            >
              {isLoadingVideo && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80">
                  <div className="h-10 w-10 rounded-full border-4 border-[#39FF14]/20 border-t-[#39FF14] animate-spin" />
                </div>
              )}

              {playbackKind === "trailer" && (
                <iframe
                  key={playbackUrl}
                  src={playbackUrl}
                  className="w-full h-full border-0"
                  allow={EMBED_IFRAME_ALLOW}
                  allowFullScreen
                  referrerPolicy="origin"
                  title="Trailer"
                />
              )}
              {playbackKind === "video" && (
                <video
                  key={playbackUrl}
                  ref={videoRef}
                  src={playbackUrl}
                  className="w-full h-full bg-black"
                  controls
                  autoPlay
                  playsInline
                  onEnded={handlePlaybackEnded}
                />
              )}
              {(playbackKind === "embed" || playbackKind === "external") && (
                <iframe
                  key={playbackUrl}
                  src={playbackUrl}
                  className="w-full h-full border-0"
                  allow={EMBED_IFRAME_ALLOW}
                  allowFullScreen
                  referrerPolicy="origin"
                  sandbox="allow-scripts allow-same-origin allow-presentation allow-forms allow-popups allow-pointer-lock"
                  title="Player"
                />
              )}
              {playbackKind === "none" && !isLoadingVideo && (
                <div className="absolute inset-0 flex items-center justify-center text-center px-6">
                  <div className="space-y-3">
                    <Film className="w-12 h-12 mx-auto text-neutral-600" />
                    <p className="text-sm text-neutral-400">No source available for this title.</p>
                  </div>
                </div>
              )}

              {/* Fullscreen button (esp. helpful for trailers) */}
              <button
                onClick={handleGoFullscreen}
                title="Fullscreen"
                className="absolute top-3 right-3 z-20 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur border border-white/10 p-2 text-white/80 hover:text-white transition-colors"
              >
                <Maximize2 className="h-4 w-4" />
              </button>

              {/* Next Episode button (only for TV shows) */}
              {isTv && (
                <button
                  onClick={handleNextEpisode}
                  title="Next Episode"
                  className="absolute top-3 right-14 z-20 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur border border-white/10 p-2 text-white/80 hover:text-white transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}

              {/* Mode badge */}
              <div className="absolute top-3 left-3 z-20">
                <span className="rounded-full bg-black/60 backdrop-blur border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#39FF14]">
                  {playerMode === "trailer" ? "Trailer" : "Full Movie"}
                </span>
              </div>
            </div>

            {/* Provider + Season/Episode picker (only when playing full movie via embed) */}
            {playerMode !== "trailer" && playbackKind === "embed" && (
              <div className="space-y-3 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(10,10,14,0.92))] p-4 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.9)]">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                  <Server className="h-3.5 w-3.5" /> Stream source
                </div>
                <div className="flex flex-wrap gap-2">
                  {EMBED_PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setProviderId(p.id)}
                      className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        providerId === p.id
                          ? "border-[#39FF14] bg-[#39FF14]/10 text-[#39FF14]"
                          : "border-white/10 bg-white/[0.02] text-neutral-300 hover:border-white/20 hover:text-white"
                      }`}
                      title={p.hint}
                    >
                      {p.label}
                    </button>
                  ))}
                  <p className="basis-full text-[10px] text-neutral-500 mt-1">
                    Having trouble? Try another source — same movie, different server.
                  </p>
                </div>

                {isTv && seasonsList.length > 0 && (
                  <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 block mb-1">
                        Season
                      </span>
                      <div className="relative">
                        <select
                          value={currentSeason}
                          onChange={(e) => setCurrentSeason(Number(e.target.value))}
                          className="w-full appearance-none rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:border-[#39FF14] outline-none cursor-pointer"
                        >
                          {seasonsList.map((s) => (
                            <option key={s} value={s} className="bg-[#0a0a0a]">
                              Season {s}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      </div>
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 block mb-1">
                        Episode
                      </span>
                      <div className="relative">
                        <select
                          value={currentEpisode}
                          onChange={(e) => setCurrentEpisode(Number(e.target.value))}
                          disabled={episodesList.length === 0}
                          className="w-full appearance-none rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:border-[#39FF14] outline-none cursor-pointer disabled:opacity-50"
                        >
                          {episodesList.map((e) => (
                            <option key={e} value={e} className="bg-[#0a0a0a]">
                              Episode {e}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      </div>
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Tabs */}
            <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,24,0.88),rgba(9,10,14,0.84))] px-5 pt-4 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.9)]">
              <div className="flex gap-6">
                {(["overview", "details", "cast", "liveChat"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`relative pb-3 text-sm font-semibold transition-colors cursor-pointer capitalize ${
                      activeTab === tab
                        ? "text-white"
                        : "text-neutral-500 hover:text-neutral-300"
                    }`}
                  >
                    {tab === "liveChat" ? "Live Chat" : tab}
                    {activeTab === tab && (
                      <span className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-[#39FF14]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            {activeTab === "overview" && (
              <div className="grid grid-cols-1 gap-5 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,24,0.88),rgba(9,10,14,0.84))] p-5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.9)] md:grid-cols-[minmax(0,1fr)_260px]">
                <div className="flex gap-4">
                  {selectedMovie.poster_path && (
                    <img
                      src={getImageUrl(selectedMovie.poster_path, "w500")}
                      alt={selectedMovie.title || selectedMovie.name}
                      className="flex-none w-24 aspect-[2/3] rounded-xl object-cover border border-white/10"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="min-w-0 space-y-2 text-sm">
                    <p className="text-neutral-300 leading-relaxed">
                      {selectedMovie.overview || "No overview available."}
                    </p>
                    <div className="pt-2 space-y-1.5 text-xs">
                      <p className="text-neutral-500">
                        <span className="font-bold text-white">Director:</span>{" "}
                        <span className="text-neutral-300">{director}</span>
                      </p>
                      <p className="text-neutral-500">
                        <span className="font-bold text-white">Cast:</span>{" "}
                        <span className="text-neutral-300">{castNames}</span>
                      </p>
                      <p className="text-neutral-500">
                        <span className="font-bold text-white">Audio:</span>{" "}
                        <span className="text-neutral-300">
                          {selectedMovie.original_language?.toUpperCase() || "English"}
                        </span>
                      </p>
                      <p className="text-neutral-500">
                        <span className="font-bold text-white">Subtitles:</span>{" "}
                        <span className="text-neutral-300">English, French</span>
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={handleToggleWatchlist}
                    className="w-full flex items-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    Add to My List
                  </button>
                  <button
                    onClick={handleToggleWatchlist}
                    className="w-full flex items-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors cursor-pointer"
                  >
                    <Bookmark className="h-4 w-4" />
                    Add to Watchlist
                  </button>
                  <button
                    onClick={handleToggleFavorite}
                    className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition-colors cursor-pointer ${
                      isFavorited
                        ? "bg-[#39FF14]/10 border-[#39FF14]/40 text-[#39FF14]"
                        : "bg-white/5 hover:bg-white/10 border-white/10 text-white"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <ThumbsUp className={`h-4 w-4 ${isFavorited ? "fill-[#39FF14]" : ""}`} />
                      Like
                    </span>
                    <span className="text-[11px] text-[#39FF14] font-bold">
                      {selectedMovie.vote_average
                        ? `${Math.round(selectedMovie.vote_average * 10)}%`
                        : "—"}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === "details" && (
              <div className="grid grid-cols-1 gap-4 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,24,0.88),rgba(9,10,14,0.84))] p-5 text-sm shadow-[0_20px_50px_-24px_rgba(0,0,0,0.9)] sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                    Information
                  </h4>
                  <div className="flex justify-between text-xs text-neutral-300">
                    <span>Released</span>
                    <span className="font-semibold">
                      {selectedMovie.release_date || selectedMovie.first_air_date || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-neutral-300">
                    <span>Type</span>
                    <span className="font-semibold">{isTv ? "TV Series" : "Movie"}</span>
                  </div>
                  <div className="flex justify-between text-xs text-neutral-300">
                    <span>Language</span>
                    <span className="font-semibold">
                      {selectedMovie.original_language?.toUpperCase() || "EN"}
                    </span>
                  </div>
                  {isTv && tvDetails && (
                    <>
                      <div className="flex justify-between text-xs text-neutral-300">
                        <span>Seasons</span>
                        <span className="font-semibold">{tvDetails.number_of_seasons}</span>
                      </div>
                      <div className="flex justify-between text-xs text-neutral-300">
                        <span>Episodes</span>
                        <span className="font-semibold">{tvDetails.number_of_episodes}</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                    Genres
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedMovie.genres?.map((g) => (
                      <span
                        key={g.id}
                        className="px-2 py-1 rounded-md bg-[#39FF14]/10 border border-[#39FF14]/25 text-[11px] font-semibold text-[#39FF14]"
                      >
                        {g.name}
                      </span>
                    )) || <span className="text-xs text-neutral-500">—</span>}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "cast" && (
              <div className="grid grid-cols-3 gap-3 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,24,0.88),rgba(9,10,14,0.84))] p-5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.9)] sm:grid-cols-4 md:grid-cols-6">
                {cast.slice(0, 12).map((member, idx) => (
                  <div key={`${member.id}-${idx}`} className="text-center">
                    <img
                      src={
                        member.profile_path
                          ? getImageUrl(member.profile_path, "w500")
                          : "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop"
                      }
                      alt={member.name}
                      className="mx-auto h-20 w-20 rounded-full object-cover border border-white/10"
                      referrerPolicy="no-referrer"
                    />
                    <p className="mt-2 text-xs font-bold text-white truncate">{member.name}</p>
                    <p className="text-[10px] text-neutral-500 truncate">{member.character}</p>
                  </div>
                ))}
                {cast.length === 0 && (
                  <p className="col-span-full text-sm text-neutral-500 text-center py-6">
                    No cast information available.
                  </p>
                )}
              </div>
            )}

            {activeTab === "liveChat" && (
              <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,24,0.88),rgba(9,10,14,0.84))] p-5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.9)]">
                <LiveChat variant="sidebar" />
              </div>
            )}

            {playerAds.length > 0 && <AdBanner ads={playerAds} />}
          </div>

          {/* RIGHT sidebar */}
          <div className="space-y-4">
            <UpNextPanel
              items={upNextItems}
              autoplay={autoPlayNext}
              onAutoplayChange={setAutoPlayNext}
              switchingLabel={switchingLabel}
            />
            <SimilarStrip
              movies={similarMovies}
              onSelect={(m) => transitionToTitle(m, { smoothScroll: true })}
            />
          </div>
        </div>

        {/* You May Also Like */}
        {(similarMovies.length > 0 || recommendations.length > 0) && (
          <div className="mt-10">
            <h2 className="text-lg font-bold text-white mb-4">You May Also Like</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {(similarMovies.length > 0 ? similarMovies : recommendations)
                .slice(0, 6)
                .map((movie) => (
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                    onClick={() => transitionToTitle(movie, { smoothScroll: true })}
                  />
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerPage;
