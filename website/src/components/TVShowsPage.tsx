import React, { useState, useEffect, useRef, useMemo } from "react";
import { tmdb } from "../utils/tmdb";
import { useInfiniteDiscover, DiscoverPage } from "../utils/useInfiniteDiscover";
import { Movie } from "../types";
import { MovieCard } from "./MovieCard";
import { CardSizeSelector } from "./CardSizeSelector";
import { Tv, ChevronRight, Settings } from "lucide-react";
import { useApp } from "../context/AppContext";
import { HeroTV } from "./HeroTV";

interface TVShowsPageProps {
  onShowClick: (show: Movie) => void;
}

interface Collection {
  id: string;
  label: string;
  fetch: (page: number) => Promise<DiscoverPage>;
}

const CURATED: Collection[] = [
  { id: "trending", label: "Trending Now", fetch: async (page) => {
    // Fetch multiple pages for trending to get more cards
    const results = await tmdb.getTrendingTVShows(page);
    if (page === 1) {
      // Fetch additional pages for more content on first load
      const page2 = await tmdb.getTrendingTVShows(2);
      const page3 = await tmdb.getTrendingTVShows(3);
      return { results: [...results, ...page2, ...page3], totalPages: 500 };
    }
    return { results, totalPages: 500 };
  }},
  { id: "popular", label: "Popular", fetch: async (page) => ({ results: await tmdb.getPopularTVShows(page), totalPages: 500 }) },
  { id: "top_rated", label: "Top Rated", fetch: async (page) => ({ results: await tmdb.getTopRatedTVShows(page), totalPages: 500 }) },
  { id: "airing_today", label: "Airing Today", fetch: async (page) => ({ results: await tmdb.getAiringTodayTVShows(page), totalPages: 500 }) },
  { id: "on_the_air", label: "Featured / On The Air", fetch: async (page) => ({ results: await tmdb.getOnTheAirTVShows(page), totalPages: 500 }) },
];

const SkeletonCard = () => (
  <div className="flex-none w-32 sm:w-36 md:w-40 rounded-2xl overflow-hidden bg-white/5 border border-white/5 animate-pulse relative">
    <div className="aspect-[2/3] bg-gradient-to-br from-white/5 to-white/[0.02]" />
    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
    <div className="p-3 space-y-2">
      <div className="h-3 bg-white/10 rounded w-3/4" />
      <div className="h-2.5 bg-white/5 rounded w-1/2" />
    </div>
  </div>
);

const PreviewRow = ({
  title,
  shows,
  loading,
  onSeeAll,
  onShowClick,
  seeAllLabel = "See All"
}: {
  title: string;
  shows: Movie[];
  loading: boolean;
  onSeeAll: () => void;
  onShowClick: (m: Movie) => void;
  seeAllLabel?: string;
}) => (
  <div className="space-y-4 w-full">
    <div className="flex items-center justify-between px-4 lg:px-8">
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
    
    <div className="flex gap-3 overflow-x-auto pb-4 w-full scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
      {loading && shows.length === 0
        ? Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)
        : shows.map((m) => (
            <MovieCard movie={m} onClick={() => onShowClick(m)} key={m.id} />
          ))}
    </div>
  </div>
);

export const TVShowsPage = ({ onShowClick }: TVShowsPageProps) => {
  const { t } = useApp();
  const [genres, setGenres] = useState<Array<{ id: number; name: string }>>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeLabel, setActiveLabel] = useState<string>("");

  const [rowData, setRowData] = useState<Record<string, Movie[]>>({});
  const [rowLoading, setRowLoading] = useState(true);

  useEffect(() => {
    tmdb.getGenres("tv").then(setGenres).catch(() => setGenres([]));
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

  const activeFetcher = useMemo(() => {
    if (activeId === null) return null;
    const curated = CURATED.find((c) => c.id === activeId);
    if (curated) return curated.fetch;
    const genreId = Number(activeId.replace("genre-", ""));
    return (page: number) => tmdb.discoverTVByGenre(genreId, page);
  }, [activeId]);

  const { items, loading, initialLoading, hasMore, loadMore } = useInfiniteDiscover(
    activeFetcher || (async () => ({ results: [], totalPages: 1 })),
    activeId || "none"
  );

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeId === null) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0] && entries[0].isIntersecting) loadMore();
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
    <div id="tv-shows-page" className="w-full min-h-screen bg-black text-white pb-12 overflow-x-hidden">
      {/* 1. Hero TV Section - Fixed condition to render unconditionally when activeId is null */}
      {activeId === null && (
        <div className="w-full px-0 sm:px-4 lg:px-8 pt-2">
          <HeroTV />
        </div>
      )}

      {/* Premium Controls and Header Section */}
      <div className="px-4 lg:px-8 space-y-6 mt-8">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-[#39FF14]/20 rounded-xl blur-lg" />
            <Tv className="relative h-6 w-6 text-[#39FF14]" />
          </div>
          <h1 className="font-sans font-black text-2xl sm:text-3xl text-white tracking-tight">
            {activeId === null ? t("exploreTvShows") : activeLabel}
          </h1>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
          <button
            onClick={() => setActiveId(null)}
            className={`flex-none flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-full border transition-all duration-300 cursor-pointer ${
              activeId === null 
                ? "bg-gradient-to-r from-[#39FF14] to-[#31dd11] text-black border-[#39FF14] shadow-[0_4px_15px_rgba(57,255,20,0.4)]" 
                : "bg-white/5 text-neutral-300 border-white/10 hover:border-white/30 hover:bg-white/[0.08]"
            }`}
          >
            <Settings className="h-3.5 w-3.5" /> {t("browse")}
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
      </div>

      {/* Premium Infinite Explore Grid or Main Content */}
      <div className="mt-10 w-full">
        {activeId === null ? (
          <div className="space-y-12 w-full">
            {CURATED.map((c) => (
              <PreviewRow
                key={c.id}
                title={collectionLabel(c)}
                shows={rowData[c.id] || []}
                loading={rowLoading}
                onSeeAll={() => selectCollection(c.id, collectionLabel(c))}
                onShowClick={onShowClick}
              />
            ))}
          </div>
        ) : (
          <div className="px-4 lg:px-8 space-y-8 w-full">
            {initialLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-6">
                {Array.from({ length: 14 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-6 w-full">
                  {items.map((m) => (
                    <div key={m.id} className="w-full transition-transform duration-300 hover:scale-105">
                      <MovieCard movie={m} onClick={() => onShowClick(m)} />
                    </div>
                  ))}
                </div>
                
                <div ref={sentinelRef} className="flex justify-center py-8 w-full">
                  {loading && (
                    <div className="flex items-center gap-3 text-xs text-neutral-500">
                      <div className="h-5 w-5 rounded-full border-2 border-[#39FF14]/30 border-t-[#39FF14] animate-spin" />
                      <span className="font-medium">Loading more titles...</span>
                    </div>
                  )}
                  {!hasMore && items.length > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                      <div className="w-2 h-2 rounded-full bg-[#39FF14]" />
                      <p className="text-xs text-neutral-400 font-medium">{t("noMoreResults")}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TVShowsPage;
