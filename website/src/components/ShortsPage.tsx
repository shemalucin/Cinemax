import React, { useEffect, useRef, useState, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { tmdb, getImageUrl } from "../utils/tmdb";
import { Movie } from "../types";
import { Heart, Volume2, VolumeX, Play, Info, Film, Search, X } from "lucide-react";

interface ShortClip {
  movie: Movie;
  videoKey: string;
}

interface ShortsPageProps {
  onWatch: (movie: Movie) => void;
}

/**
 * "Shorts" — a TikTok/Reels-style vertical feed of autoplaying movie
 * trailers. Each slide snap-scrolls to fill the viewport; only the active
 * slide (plus its immediate neighbors) actually mounts a live YouTube
 * player, so scrolling stays smooth even with a long feed.
 */
export const ShortsPage = ({ onWatch }: ShortsPageProps) => {
  const { user, likeMovie, unlikeMovie, requireSignInPrompt } = useApp();

  const [clips, setClips] = useState<ShortClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [pageParam, setPageParam] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<string>("trending");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCategories, setShowCategories] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const loadingMoreRef = useRef(false);

  const favoriteIds = new Set(user?.favorites || []);

  // Categories with icons - redesigned
  const categories = [
    { id: "trending", name: "Trending", icon: "🔥", color: "from-orange-500 to-red-500" },
    { id: "popular", name: "Popular", icon: "⭐", color: "from-yellow-400 to-orange-400" },
    { id: "top_rated", name: "Top Rated", icon: "🏆", color: "from-amber-400 to-yellow-500" },
    { id: "now_playing", name: "Now Playing", icon: "🎬", color: "from-blue-500 to-purple-500" },
    { id: "upcoming", name: "Upcoming", icon: "📅", color: "from-green-500 to-emerald-500" },
    { id: "28", name: "Action", icon: "💥", color: "from-red-600 to-orange-600" },
    { id: "12", name: "Adventure", icon: "🗺️", color: "from-teal-500 to-cyan-500" },
    { id: "16", name: "Animation", icon: "🎨", color: "from-pink-500 to-rose-500" },
    { id: "35", name: "Comedy", icon: "😂", color: "from-yellow-300 to-amber-400" },
    { id: "80", name: "Crime", icon: "🔍", color: "from-slate-600 to-gray-700" },
    { id: "99", name: "Documentary", icon: "📹", color: "from-blue-600 to-indigo-600" },
    { id: "18", name: "Drama", icon: "🎭", color: "from-purple-600 to-violet-600" },
    { id: "10751", name: "Family", icon: "👨‍👩‍👧‍👦", color: "from-green-400 to-emerald-500" },
    { id: "14", name: "Fantasy", icon: "🧙", color: "from-purple-400 to-pink-500" },
    { id: "36", name: "History", icon: "📜", color: "from-amber-600 to-yellow-700" },
    { id: "27", name: "Horror", icon: "👻", color: "from-gray-800 to-black" },
    { id: "10402", name: "Music", icon: "🎵", color: "from-pink-500 to-fuchsia-500" },
    { id: "9648", name: "Mystery", icon: "🔮", color: "from-indigo-600 to-purple-700" },
    { id: "10749", name: "Romance", icon: "❤️", color: "from-red-400 to-pink-500" },
    { id: "878", name: "Sci-Fi", icon: "🚀", color: "from-cyan-500 to-blue-600" },
    { id: "53", name: "Thriller", icon: "😱", color: "from-red-700 to-orange-800" },
    { id: "10752", name: "War", icon: "⚔️", color: "from-stone-600 to-zinc-700" },
    { id: "37", name: "Western", icon: "🤠", color: "from-amber-700 to-yellow-800" },
    { id: "10770", name: "TV Movie", icon: "📺", color: "from-blue-400 to-indigo-500" },
    { id: "anime", name: "Anime", icon: "🎌", color: "from-red-500 to-pink-600" },
    { id: "superhero", name: "Superhero", icon: "🦸", color: "from-blue-600 to-cyan-500" },
    { id: "kids", name: "Kids", icon: "🧒", color: "from-lime-400 to-green-500" },
    { id: "awards", name: "Award Winners", icon: "🏅", color: "from-yellow-500 to-amber-600" },
  ];

  // Search functionality
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const results = await tmdb.searchMulti(query);
      setSearchResults(results.filter((m: Movie) => m.backdrop_path || m.poster_path));
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // Load clips based on selected category
  const loadMoreClips = useCallback(async () => {
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    try {
      let pool: Movie[] = [];

      switch (selectedCategory) {
        case "trending":
          pool = await tmdb.getTrendingMovies(pageParam);
          break;
        case "popular":
          pool = await tmdb.getPopularMovies(pageParam);
          break;
        case "top_rated":
          pool = await tmdb.getTopRatedMovies(pageParam);
          break;
        case "now_playing":
          pool = await tmdb.getNowPlayingMovies(pageParam);
          break;
        case "upcoming":
          pool = await tmdb.getUpcomingMovies(pageParam);
          break;
        case "anime":
          // Anime is genre 16 (Animation) with Japanese origin
          pool = await tmdb.getPopularMovies(pageParam);
          pool = pool.filter(m => m.original_language === "ja");
          break;
        case "superhero":
          // Superhero typically action/adventure with specific keywords
          pool = await tmdb.getPopularMovies(pageParam);
          break;
        case "kids":
          // Kids content (family genre) - use popular movies as fallback
          pool = await tmdb.getPopularMovies(pageParam);
          break;
        case "awards":
          // Award winners (top rated as proxy)
          pool = await tmdb.getTopRatedMovies(pageParam);
          break;
        default:
          // Genre-based categories - use popular movies as fallback since discoverMovies not available
          if (selectedCategory.match(/^\d+$/)) {
            pool = await tmdb.getPopularMovies(pageParam);
          } else {
            pool = await tmdb.getTrendingMovies(pageParam);
          }
      }

      // Filter for movies with backdrop images and get their videos
      pool = pool.filter((m) => m.backdrop_path);

      const withVideos = await Promise.all(
        pool.map(async (movie) => {
          try {
            const videos = await tmdb.getMovieVideos(movie.id);
            const best = videos.find((v) => v.type === "Trailer") || videos[0];
            return best ? { movie, videoKey: best.key } : null;
          } catch {
            return null;
          }
        })
      );

      const newClips = withVideos.filter((c): c is ShortClip => c !== null);
      setClips((prev) => {
        const seen = new Set(prev.map((c) => c.movie.id));
        return [...prev, ...newClips.filter((c) => !seen.has(c.movie.id))];
      });
      setPageParam((p) => p + 1);
    } catch (err) {
      console.error("Failed to load Shorts feed:", err);
    } finally {
      loadingMoreRef.current = false;
      setLoading(false);
    }
  }, [pageParam, selectedCategory]);

  useEffect(() => {
    loadMoreClips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload clips when category changes
  useEffect(() => {
    setClips([]);
    setPageParam(1);
    setLoading(true);
    loadMoreClips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  // Handle category selection
  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSearchQuery("");
    setSearchResults([]);
    setIsSearching(false);
  };

  // Handle search result click - instantly play the selected short
  const handleSearchResultClick = async (movie: Movie) => {
    try {
      // Clear search state immediately
      setSearchQuery("");
      setSearchResults([]);
      setIsSearching(false);

      // Set loading state
      setLoading(true);

      // Fetch videos for the selected movie
      const videos = await tmdb.getMovieVideos(movie.id);
      const best = videos.find((v) => v.type === "Trailer") || videos[0];

      if (best && (movie.backdrop_path || movie.poster_path)) {
        // Create the clip and immediately set it as the only clip
        const newClip = { movie, videoKey: best.key };
        setClips([newClip]);
        setActiveIndex(0);
        setLoading(false);
      } else {
        // If no video found, show error or fallback
        setLoading(false);
      }
    } catch (error) {
      console.error("Error loading search result:", error);
      setLoading(false);
    }
  };

  // Tracks which slide is centered in the viewport using IntersectionObserver
  // so we know which single player should actually be "live".
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(idx)) setActiveIndex(idx);
          }
        }
      },
      { root: container, threshold: [0.6] }
    );

    itemRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [clips.length]);

  // Infinite scroll: once the person nears the end of the loaded feed, fetch more.
  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    const nearEnd = container.scrollTop + container.clientHeight >= container.scrollHeight - window.innerHeight * 1.5;
    if (nearEnd) loadMoreClips();
  };

  const toggleFavorite = (movieId: number) => {
    if (!user) {
      requireSignInPrompt();
      return;
    }
    if (favoriteIds.has(movieId)) unlikeMovie(movieId);
    else likeMovie(movieId);
  };

  if (loading && clips.length === 0) {
    return (
      <div id="shorts-loading" className="flex flex-col items-center justify-center h-[70vh] gap-4 text-neutral-500">
        <div className="relative">
          <div className="absolute inset-0 bg-[#39FF14]/20 rounded-full blur-xl" />
          <div className="relative h-10 w-10 rounded-full border-3 border-[#39FF14]/30 border-t-[#39FF14] animate-spin" />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#39FF14]">Loading Shorts...</p>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100dvh-4rem)] lg:h-[calc(100dvh-0px)] flex bg-gradient-to-br from-[#0a0a0a] to-[#1a1a2e] lg:rounded-3xl overflow-hidden">
      {/* Premium ambient glow effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#39FF14]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/3 rounded-full blur-[100px]" />
      </div>

      {/* Left Sidebar - Categories */}
      <div className="hidden lg:flex flex-col w-64 bg-[#0a0a0a]/80 backdrop-blur-xl border-r border-white/5">
        <div className="p-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <Film className="h-5 w-5 text-[#39FF14]" />
            <h3 className="text-sm font-bold text-white">Categories</h3>
          </div>
        </div>
        <div className="p-3 overflow-y-auto flex-1 custom-scrollbar" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
          <div className="flex flex-col gap-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategorySelect(category.id)}
                className={`group relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 overflow-hidden shrink-0 ${
                  selectedCategory === category.id
                    ? "text-white"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {/* Gradient background for active state */}
                {selectedCategory === category.id && (
                  <div className={`absolute inset-0 bg-gradient-to-r ${category.color} opacity-20`} />
                )}
                
                {/* Hover gradient */}
                <div className={`absolute inset-0 bg-gradient-to-r ${category.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                
                {/* Active indicator */}
                {selectedCategory === category.id && (
                  <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b ${category.color} rounded-r-full shadow-[0_0_10px_rgba(57,255,20,0.3)]`} />
                )}
                
                {/* Icon with gradient background */}
                <div className={`relative z-10 w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all duration-300 ${
                  selectedCategory === category.id
                    ? `bg-gradient-to-br ${category.color} shadow-lg`
                    : "bg-white/5 group-hover:bg-white/10"
                }`}>
                  {category.icon}
                </div>
                
                {/* Category name */}
                <span className="relative z-10 text-xs font-semibold">{category.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Premium Search Bar */}
        <div className="relative z-20 p-4 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-2xl mx-auto">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-[#39FF14]/20 to-purple-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition-all duration-300 focus-within:border-[#39FF14]/50 focus-within:ring-1 focus-within:ring-[#39FF14]/20">
                <div className="pl-4">
                  <Search className="h-5 w-5 text-neutral-500 group-focus-within:text-[#39FF14] transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Search movies, shows, actors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                      setIsSearching(false);
                    }}
                    className="pr-4 text-neutral-500 hover:text-white transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Search Results Dropdown */}
            {isSearching && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-h-96 overflow-y-auto z-30">
                {searchResults.slice(0, 10).map((movie) => (
                  <button
                    key={movie.id}
                    onClick={() => handleSearchResultClick(movie)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 group"
                  >
                    <div className="relative w-14 h-20 rounded-lg overflow-hidden bg-neutral-900">
                      <img
                        src={getImageUrl(movie.poster_path || movie.backdrop_path, "w500")}
                        alt={movie.title || movie.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-white group-hover:text-[#39FF14] transition-colors">{movie.title || movie.name}</p>
                      <p className="text-xs text-neutral-500 mt-1">
                        {movie.release_date || movie.first_air_date || ""} • {movie.media_type === "tv" ? "TV Show" : "Movie"}
                      </p>
                      {movie.vote_average && (
                        <div className="flex items-center gap-1 mt-2">
                          <span className="text-[10px] font-bold text-[#39FF14]">{movie.vote_average.toFixed(1)}</span>
                          <span className="text-[10px] text-neutral-500">★</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Categories Toggle */}
        <div className="lg:hidden p-4 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
          <button
            onClick={() => setShowCategories(!showCategories)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
          >
            <Film className="h-4 w-4 text-[#39FF14]" />
            <span className="text-xs font-semibold text-white">
              {showCategories ? "Hide Categories" : "Show Categories"}
            </span>
          </button>
        </div>

        {/* Mobile Categories */}
        {showCategories && (
          <div className="lg:hidden p-4 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleCategorySelect(category.id)}
                  className={`group relative flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all duration-300 overflow-hidden ${
                    selectedCategory === category.id
                      ? "text-white"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {/* Gradient background for active state */}
                  {selectedCategory === category.id && (
                    <div className={`absolute inset-0 bg-gradient-to-r ${category.color}`} />
                  )}
                  
                  {/* Hover gradient */}
                  <div className={`absolute inset-0 bg-gradient-to-r ${category.color} opacity-0 group-hover:opacity-20 transition-opacity duration-300`} />
                  
                  {/* Icon */}
                  <span className="relative z-10 text-sm">{category.icon}</span>
                  {/* Category name */}
                  <span className="relative z-10 text-xs font-semibold">{category.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Shorts Content */}
        <div className="flex-1 flex items-center justify-center relative">
          {/* Ambient blurred backdrop */}
          {clips[activeIndex] && (
            <img
              src={getImageUrl(clips[activeIndex].movie.backdrop_path, "original")}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover opacity-40 blur-3xl scale-125 transition-all duration-1000"
              referrerPolicy="no-referrer"
              loading="lazy"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/80 via-[#0a0a0a]/60 to-[#1a1a2e]/90" />

          {/* Slim vertical rail */}
          <div
            id="shorts-page"
            ref={containerRef}
            onScroll={handleScroll}
            className="relative z-10 h-full w-full sm:w-[400px] sm:max-w-[400px] sm:my-4 sm:rounded-3xl overflow-y-scroll snap-y snap-mandatory scroll-smooth bg-[#0a0a0a] no-scrollbar sm:border sm:border-white/10 sm:shadow-2xl"
            style={{ scrollbarWidth: "none" }}
          >
            {clips.map((clip, idx) => (
              <ShortSlide
                key={clip.movie.id}
                ref={(el) => (itemRefs.current[idx] = el)}
                index={idx}
                clip={clip}
                isActive={idx === activeIndex}
                isNeighbor={Math.abs(idx - activeIndex) <= 1}
                muted={muted}
                setMuted={setMuted}
                isFavorite={favoriteIds.has(clip.movie.id)}
                onToggleFavorite={() => toggleFavorite(clip.movie.id)}
                onWatch={() => onWatch(clip.movie)}
              />
            ))}

            {/* Premium End-of-feed loader */}
            <div className="h-32 flex items-center justify-center text-neutral-600 text-xs snap-end">
              <div className="h-5 w-5 rounded-full border-2 border-[#39FF14]/30 border-t-[#39FF14] animate-spin mr-3" />
              <span className="font-medium">Loading more shorts...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ShortSlideProps {
  index: number;
  clip: ShortClip;
  isActive: boolean;
  isNeighbor: boolean;
  muted: boolean;
  setMuted: (m: boolean) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onWatch: () => void;
}

const ShortSlide = React.forwardRef<HTMLDivElement, ShortSlideProps>(
  ({ index, clip, isActive, isNeighbor, muted, setMuted, isFavorite, onToggleFavorite, onWatch }, ref) => {
    const { movie, videoKey } = clip;
    const title = movie.title || movie.name || "Untitled";
    const [showTapHint, setShowTapHint] = useState(false);

    const embedSrc = `https://www.youtube.com/embed/${videoKey}?autoplay=1&mute=${muted ? 1 : 0}&loop=1&playlist=${videoKey}&controls=0&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3`;

    return (
      <div
        ref={ref}
        data-index={index}
        className="relative h-full w-full snap-start snap-always flex items-center justify-center overflow-hidden bg-[#0a0a0a]"
      >
        {/* Poster fallback / background while the player mounts */}
        <img
          src={getImageUrl(movie.backdrop_path, "original")}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover opacity-50 scale-105 transition-all duration-700"
          referrerPolicy="no-referrer"
          loading="lazy"
        />

        {isNeighbor && videoKey && (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Oversized iframe cropped to fill the vertical frame, like a native shorts player */}
            <iframe
              key={`${videoKey}-${isActive}`}
              src={isActive ? embedSrc : undefined}
              title={title}
              allow="autoplay; encrypted-media; fullscreen"
              className="pointer-events-none w-[300%] h-full"
              style={{ border: 0 }}
              loading="lazy"
            />
          </div>
        )}

        {/* Tap-to-unmute affordance, shown once per active slide */}
        <button
          id={`shorts-mute-toggle-${index}`}
          onClick={() => {
            setMuted(!muted);
            setShowTapHint(true);
            setTimeout(() => setShowTapHint(false), 500);
          }}
          className="absolute inset-0 z-10 cursor-pointer"
          aria-label={muted ? "Unmute" : "Mute"}
        />

        {showTapHint && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div className="bg-[#0a0a0a]/70 backdrop-blur-sm rounded-full p-4 animate-ping-once border border-white/20">
              {muted ? <VolumeX className="h-8 w-8 text-white" /> : <Volume2 className="h-8 w-8 text-white" />}
            </div>
          </div>
        )}

        {/* Gradient overlays for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/40 pointer-events-none" />

        {/* Premium Sound indicator, top right */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 pointer-events-none">
          <div className="relative bg-black/40 backdrop-blur-xl rounded-full p-2.5 border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
            <div className={`absolute inset-0 rounded-full blur-md transition-opacity duration-300 ${muted ? 'opacity-0' : 'opacity-50 bg-[#39FF14]/20'}`} />
            {muted ? <VolumeX className="relative h-4 w-4 text-white" /> : <Volume2 className="relative h-4 w-4 text-white" />}
          </div>
        </div>

        {/* Premium Right-side action rail */}
        <div className="absolute right-3 bottom-28 lg:bottom-20 z-20 flex flex-col items-center gap-5">
          <button
            id={`shorts-like-${index}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className="flex flex-col items-center gap-2 cursor-pointer group"
          >
            <div
              className={`relative h-12 w-12 rounded-full flex items-center justify-center border transition-all duration-300 ${
                isFavorite
                  ? "bg-gradient-to-r from-[#39FF14] to-[#31dd11] border-[#39FF14] text-black scale-105 shadow-[0_0_20px_rgba(57,255,20,0.5)]"
                  : "bg-black/40 backdrop-blur-xl border-white/15 text-white group-hover:scale-110 group-hover:bg-white/10 group-hover:border-white/30"
              }`}
            >
              <div className={`absolute inset-0 rounded-full blur-md transition-opacity duration-300 ${isFavorite ? 'opacity-50 bg-[#39FF14]/30' : 'opacity-0'}`} />
              <Heart className={`relative h-5 w-5 ${isFavorite ? "fill-black" : ""}`} />
            </div>
            <span className="text-[10px] font-bold text-white drop-shadow-lg">{isFavorite ? "Saved" : "Save"}</span>
          </button>

          <button
            id={`shorts-watch-${index}`}
            onClick={(e) => {
              e.stopPropagation();
              onWatch();
            }}
            className="flex flex-col items-center gap-2 cursor-pointer group"
          >
            <div className="relative h-12 w-12 rounded-full flex items-center justify-center bg-gradient-to-r from-[#39FF14] to-[#31dd11] text-black border border-[#39FF14] group-hover:scale-110 transition-all duration-300 shadow-[0_4px_20px_rgba(57,255,20,0.4)] hover:shadow-[0_6px_30px_rgba(57,255,20,0.6)]">
              <div className="absolute inset-0 rounded-full blur-md opacity-50 bg-[#39FF14]/30" />
              <Play className="relative h-5 w-5 fill-black ml-0.5" />
            </div>
            <span className="text-[10px] font-bold text-white drop-shadow-lg">Watch</span>
          </button>
        </div>

        {/* Premium Bottom title/info bar */}
        <div className="absolute bottom-6 left-4 right-24 z-20 space-y-3 pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="relative">
              <div className="absolute inset-0 bg-[#39FF14]/20 rounded-lg blur-md" />
              <Film className="relative h-4 w-4 text-[#39FF14]" />
            </div>
            <span className="relative text-[10px] font-black uppercase tracking-widest text-[#39FF14] drop-shadow-lg">Shorts</span>
          </div>
          <h3 className="font-sans font-black text-xl text-white drop-shadow-2xl line-clamp-1">{title}</h3>
          <p className="text-xs text-neutral-200 leading-relaxed line-clamp-2 drop-shadow-lg max-w-md">{movie.overview}</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onWatch();
            }}
            className="pointer-events-auto flex items-center gap-2 text-[11px] font-bold text-white/90 hover:text-[#39FF14] transition-all duration-300 group"
          >
            <Info className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" /> More details
          </button>
        </div>

        {/* Scroll hint on the very first slide */}
        {index === 0 && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 text-white/70 animate-bounce pointer-events-none">
            <div className="w-6 h-6 rounded-full border-2 border-white/50 border-t-transparent animate-spin" />
            <span className="text-[9px] font-bold uppercase tracking-widest">Swipe up</span>
          </div>
        )}
      </div>
    );
  }
);
ShortSlide.displayName = "ShortSlide";
