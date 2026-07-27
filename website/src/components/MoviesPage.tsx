import React, { useState, useEffect, useRef, useMemo } from "react";
import { tmdb } from "../utils/tmdb";
import { useInfiniteDiscover, DiscoverPage } from "../utils/useInfiniteDiscover";
import { Movie } from "../types";
import { MovieCard } from "./MovieCard";
import { CardSizeSelector } from "./CardSizeSelector";
import { Film, ChevronRight, Loader2, SlidersHorizontal } from "lucide-react";
import { useApp } from "../context/AppContext";

interface MoviesPageProps {
  onMovieClick: (movie: Movie) => void;
  initialGenre?: number | string | null;
  initialGenreLabel?: string | null;
}

// Maps the Sidebar's legacy category ids (including a few aliases that
// aren't real TMDB genres) onto our curated collections / genre ids.
function resolveInitialSelection(initialGenre?: number | string | null): string | null {
  if (initialGenre === null || initialGenre === undefined) return null;
  if (typeof initialGenre === "number") return `genre-${initialGenre}`;
  const aliases: Record<string, string> = {
    superhero: "genre-28", // Action
    anime: "genre-16", // Animation
    kids: "genre-10751", // Family
    classic: "top_rated",
    award: "top_rated",
    latest: "now_playing",
  };
  if (aliases[initialGenre]) return aliases[initialGenre];
  // trending / popular / top_rated / upcoming / now_playing map 1:1
  return initialGenre;
}

interface Collection {
  id: string;
  label: string;
  fetch: (page: number) => Promise<DiscoverPage>;
}

// Curated, real TMDB-backed collections (not fabricated categories).
const CURATED: Collection[] = [
  { id: "trending", label: "Trending Now", fetch: async (page) => ({ results: await tmdb.getTrendingMovies(page), totalPages: 500 }) },
  { id: "popular", label: "Popular", fetch: async (page) => ({ results: await tmdb.getPopularMovies(page), totalPages: 500 }) },
  { id: "top_rated", label: "Top Rated", fetch: async (page) => ({ results: await tmdb.getTopRatedMovies(page), totalPages: 500 }) },
  { id: "now_playing", label: "New Releases", fetch: async (page) => ({ results: await tmdb.getNowPlayingMovies(page), totalPages: 500 }) },
  { id: "upcoming", label: "Upcoming", fetch: async (page) => ({ results: await tmdb.getUpcomingMovies(page), totalPages: 500 }) },
];

const SkeletonCard: React.FC = () => (
  <div className="flex-none w-32 sm:w-36 md:w-40 rounded-2xl overflow-hidden bg-white/5 border border-white/5 animate-pulse relative">
    <div className="aspect-[2/3] bg-gradient-to-br from-white/5 to-white/[0.02]" />
    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
    <div className="p-3 space-y-2">
      <div className="h-3 bg-white/10 rounded w-3/4" />
      <div className="h-2.5 bg-white/5 rounded w-1/2" />
    </div>
  </div>
);

/** Premium Horizontal preview row for the overview/browse landing state. */
const PreviewRow: React.FC<{
  title: string;
  movies: Movie[];
  loading: boolean;
  onSeeAll: () => void;
  onMovieClick: (m: Movie) => void;
  seeAllLabel?: string;
}> = ({ title, movies, loading, onSeeAll, onMovieClick, seeAllLabel = "See All" }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="font-sans font-extrabold text-lg sm:text-xl text-white flex items-center gap-3">
        <span className="h-6 w-1.5 bg-gradient-to-b from-[#39FF14] to-[#31dd11] rounded-full shadow-[0_0_15px_rgba(57,255,20,0.5)]" />
        {title}
      </h3>
      <div className="flex items-center gap-4">
        <CardSizeSelector />
        <button
          onClick={onSeeAll}
          className="group flex items-center gap-2 text-xs font-bold text-[#39FF14] hover:text-[#31dd11] transition-all duration-300 cursor-pointer"
        >
          <span className="group-hover:translate-x-0.5 transition-transform">{seeAllLabel}</span> <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
    <div className="flex gap-0 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
      {loading && movies.length === 0
        ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        : movies.slice(0, 14).map((m) => (
            <MovieCard movie={m} onClick={() => onMovieClick(m)} key={m.id} />
          ))}
    </div>
  </div>
);

export const MoviesPage: React.FC<MoviesPageProps> = ({ onMovieClick, initialGenre, initialGenreLabel }) => {
  const { t } = useApp();
  const [genres, setGenres] = useState<Array<{ id: number; name: string }>>([]);
  const [activeId, setActiveId] = useState<string | null>(() => resolveInitialSelection(initialGenre));
  const [activeLabel, setActiveLabel] = useState<string>(initialGenreLabel || "");

  // Overview-mode row data
  const [rowData, setRowData] = useState<Record<string, Movie[]>>({});
  const [rowLoading, setRowLoading] = useState(true);

  useEffect(() => {
    tmdb.getGenres("movie").then(setGenres).catch(() => setGenres([]));
  }, []);

  useEffect(() => {
    if (activeId !== null) return;
    let cancelled = false;
    setRowLoading(true);
    (async () => {
      const entries = await Promise.all(
        CURATED.map(async (c) => {
          const { results } = await c.fetch(1).catch(() => ({ results: [], totalPages: 1 }));
          return [c.id, results] as const;
        })
      );
      if (cancelled) return;
      setRowData(Object.fromEntries(entries));
      setRowLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  // Fetcher for the active infinite-scroll selection
  const activeFetcher = useMemo(() => {
    if (activeId === null) return null;
    const curated = CURATED.find((c) => c.id === activeId);
    if (curated) return curated.fetch;
    const genreId = Number(activeId.replace("genre-", ""));
    return (page: number) => tmdb.discoverMoviesByGenre(genreId, page);
  }, [activeId]);

  const { items, loading, initialLoading, hasMore, loadMore } = useInfiniteDiscover(
    activeFetcher || (async () => ({ results: [], totalPages: 1 })),
    activeId || "none"
  );

  // IntersectionObserver-driven infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeId === null) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeId, loadMore]);

  const selectCollection = (id: string, label: string) => {
    setActiveId(id);
    setActiveLabel(label);
  };

  const collectionLabel = (collection: Collection) => t(`collection.${collection.id}`);
  const genreLabel = (name: string) => t(`genre.${name}`);

  return (
    <div id="movies-page" className="p-4 lg:p-8 space-y-10">
      {/* Premium Header */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="absolute inset-0 bg-[#39FF14]/20 rounded-xl blur-lg" />
          <Film className="relative h-6 w-6 text-[#39FF14]" />
        </div>
        <h1 className="font-sans font-black text-2xl sm:text-3xl text-white tracking-tight">
          {activeId === null ? t("exploreMovies") : activeLabel}
        </h1>
      </div>

      {/* Premium Filter pill bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
        <button
          onClick={() => setActiveId(null)}
          className={`flex-none flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-full border transition-all duration-300 cursor-pointer ${
            activeId === null 
              ? "bg-gradient-to-r from-[#39FF14] to-[#31dd11] text-black border-[#39FF14] shadow-[0_4px_15px_rgba(57,255,20,0.4)]" 
              : "bg-white/5 text-neutral-300 border-white/10 hover:border-white/30 hover:bg-white/[0.08]"
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" /> {t("browse")}
        </button>
        {CURATED.map((c) => (
          <button
            key={c.id}
            onClick={() => selectCollection(c.id, collectionLabel(c))}
            className={`flex-none text-xs font-bold px-4 py-2.5 rounded-full border transition-all duration-300 cursor-pointer ${
              activeId === c.id 
                ? "bg-gradient-to-r from-[#39FF14] to-[#31dd11] text-black border-[#39FF14] shadow-[0_4px_15px_rgba(57,255,20,0.4)]" 
                : "bg-white/5 text-neutral-300 border-white/10 hover:border-white/30 hover:bg-white/[0.08]"
            }`}
          >
            {collectionLabel(c)}
          </button>
        ))}
        {genres.map((g) => (
          <button
            key={g.id}
            onClick={() => selectCollection(`genre-${g.id}`, genreLabel(g.name))}
            className={`flex-none text-xs font-bold px-4 py-2.5 rounded-full border transition-all duration-300 cursor-pointer ${
              activeId === `genre-${g.id}` 
                ? "bg-gradient-to-r from-[#39FF14] to-[#31dd11] text-black border-[#39FF14] shadow-[0_4px_15px_rgba(57,255,20,0.4)]" 
                : "bg-white/5 text-neutral-300 border-white/10 hover:border-white/30 hover:bg-white/[0.08]"
            }`}
          >
            {genreLabel(g.name)}
          </button>
        ))}
      </div>

      {activeId === null ? (
        // OVERVIEW MODE — curated rows + one row per genre
        <div className="space-y-12">
          {CURATED.map((c) => (
            <PreviewRow
              key={c.id}
              title={collectionLabel(c)}
              movies={rowData[c.id] || []}
              loading={rowLoading}
              onSeeAll={() => selectCollection(c.id, collectionLabel(c))}
              onMovieClick={onMovieClick}
              seeAllLabel={t("seeAll")}
            />
          ))}

          {genres.map((g) => (
            <GenreRow key={g.id} genreId={g.id} name={genreLabel(g.name)} onSeeAll={() => selectCollection(`genre-${g.id}`, genreLabel(g.name))} onMovieClick={onMovieClick} seeAllLabel={t("seeAll")} />
          ))}
        </div>
      ) : (
        // PREMIUM INFINITE-SCROLL FILTERED GRID
        <div className="space-y-10">
          {initialLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-32 text-neutral-500">
              <div className="flex flex-col items-center gap-4">
                <Film className="h-12 w-12 text-neutral-600" />
                <p className="text-sm">No movies found for this category right now.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {items.map((movie) => (
                  <MovieCard movie={movie} onClick={() => onMovieClick(movie)} key={movie.id} />
                ))}
              </div>

              <div ref={sentinelRef} className="flex justify-center py-8">
                {loading && (
                  <div className="flex items-center gap-3 text-xs text-neutral-500">
                    <Loader2 className="h-5 w-5 animate-spin text-[#39FF14]" />
                    <span className="font-medium">Loading more titles...</span>
                  </div>
                )}
                {!hasMore && !loading && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                    <div className="w-2 h-2 rounded-full bg-[#39FF14]" />
                    <p className="text-xs text-neutral-400 font-medium">You've reached the end of this collection.</p>
                  </div>
                )}
                {hasMore && !loading && (
                  <button
                    onClick={loadMore}
                    className="group relative flex items-center gap-2 text-xs font-bold px-6 py-3 rounded-xl bg-gradient-to-r from-[#39FF14]/10 to-[#39FF14]/5 border border-[#39FF14]/30 text-[#39FF14] hover:from-[#39FF14]/15 hover:to-[#39FF14]/8 hover:border-[#39FF14]/50 transition-all duration-300 cursor-pointer"
                  >
                    Load More <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

/** Lazily loads a single genre's first page for the overview browse rows. */
const GenreRow: React.FC<{ genreId: number; name: string; onSeeAll: () => void; onMovieClick: (m: Movie) => void; seeAllLabel: string }> = ({
  genreId,
  name,
  onSeeAll,
  onMovieClick,
  seeAllLabel,
}) => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const rowRef = useRef<HTMLDivElement>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const el = rowRef.current;
    if (!el || hasLoaded) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setHasLoaded(true);
          tmdb
            .discoverMoviesByGenre(genreId, 1)
            .then(({ results }) => setMovies(results))
            .catch(() => setMovies([]))
            .finally(() => setLoading(false));
          observer.disconnect();
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [genreId, hasLoaded]);

  return (
    <div ref={rowRef}>
      <PreviewRow title={name} movies={movies} loading={loading} onSeeAll={onSeeAll} onMovieClick={onMovieClick} seeAllLabel={seeAllLabel} />
    </div>
  );
};

export default MoviesPage;
