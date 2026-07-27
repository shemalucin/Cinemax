import React, { useState, useEffect, useMemo, useRef } from "react";
import { Heart, Lock, Calendar, AlertTriangle, Loader2, SlidersHorizontal } from "lucide-react";
import { useApp } from "../context/AppContext";
import { MovieCard } from "./MovieCard";
import { tmdb } from "../utils/tmdb";
import { useInfiniteDiscover, DiscoverPage } from "../utils/useInfiniteDiscover";
import { Movie } from "../types";

interface GensPageProps {
  /** Same handler MoviesPage/TVShowsPage use — resolves streaming source and
   *  opens the exact same custom player as every other title on the site. */
  onMovieClick: (movie: Movie) => void;
}

const API_BASE =
  (typeof import.meta === "object" && (import.meta as any).env?.VITE_API_BASE_URL)
    ? String((import.meta as any).env.VITE_API_BASE_URL).replace(/\/+$/, "")
    : "";

// TMDB genre IDs used to build the mature/romance-flavored categories below.
const GENRE = {
  romance: 10749,
  drama: 18,
  comedy: 35,
  thriller: 53,
  fantasy: 14,
  music: 10402,
  history: 36,
  mystery: 9648,
};

interface GensCollection {
  id: string;
  label: string;
  subtitle: string;
  fetch: (page: number) => Promise<DiscoverPage>;
}

// Curated, real TMDB-backed categories specifically relevant to Gens' mature
// romance/drama theme (each is a genuine TMDB discover query, not fabricated
// data), so results are always legitimate, ratable, playable titles.
const GENS_CATEGORIES: GensCollection[] = [
  {
    id: "romance",
    label: "Romance",
    subtitle: "Curated from TMDB — Romance genre",
    fetch: (page) => tmdb.discoverMoviesByGenre(GENRE.romance, page, "popularity.desc"),
  },
  {
    id: "top_drama",
    label: "Top-Rated Drama",
    subtitle: "Highly rated dramas from TMDB",
    fetch: (page) => tmdb.discoverMoviesByGenre(GENRE.drama, page, "vote_average.desc"),
  },
  {
    id: "romantic_drama",
    label: "Romantic Dramas",
    subtitle: "Love stories with real emotional stakes",
    fetch: (page) => tmdb.discoverMoviesByGenres([GENRE.romance, GENRE.drama], page, "vote_average.desc"),
  },
  {
    id: "romcom",
    label: "Romantic Comedies",
    subtitle: "Love, laughs, and happy-ish endings",
    fetch: (page) => tmdb.discoverMoviesByGenres([GENRE.romance, GENRE.comedy], page, "popularity.desc"),
  },
  {
    id: "romantic_thriller",
    label: "Passion & Suspense",
    subtitle: "Romance with an edge — steamy thrillers",
    fetch: (page) => tmdb.discoverMoviesByGenres([GENRE.romance, GENRE.thriller], page, "popularity.desc"),
  },
  {
    id: "romantic_fantasy",
    label: "Romantic Fantasy",
    subtitle: "Sweeping, larger-than-life love stories",
    fetch: (page) => tmdb.discoverMoviesByGenres([GENRE.romance, GENRE.fantasy], page, "popularity.desc"),
  },
  {
    id: "period_romance",
    label: "Period Romance",
    subtitle: "Lavish, old-world love affairs",
    fetch: (page) => tmdb.discoverMoviesByGenres([GENRE.romance, GENRE.history], page, "vote_average.desc"),
  },
  {
    id: "romantic_mystery",
    label: "Forbidden & Mysterious",
    subtitle: "Secrets, longing, and slow-burn tension",
    fetch: (page) => tmdb.discoverMoviesByGenres([GENRE.romance, GENRE.mystery], page, "popularity.desc"),
  },
  {
    id: "musical_romance",
    label: "Musical Romance",
    subtitle: "Love stories set to music",
    fetch: (page) => tmdb.discoverMoviesByGenres([GENRE.romance, GENRE.music], page, "popularity.desc"),
  },
];

export const GensPage: React.FC<GensPageProps> = ({ onMovieClick }) => {
  const { user, isGuest, setCurrentView, requireSignInPrompt } = useApp();
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessReason, setAccessReason] = useState("");
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [activeId, setActiveId] = useState<string>(GENS_CATEGORIES[0].id);

  // Restrict guest access
  useEffect(() => {
    if (isGuest) {
      requireSignInPrompt();
      setAccessDenied(true);
      setAccessReason("Guests cannot access this page. Please sign in to continue.");
      setCheckingAccess(false);
    }
  }, [isGuest, requireSignInPrompt]);

  const activeCategory = useMemo(
    () => GENS_CATEGORIES.find((c) => c.id === activeId) || GENS_CATEGORIES[0],
    [activeId]
  );

  const { items, loading, initialLoading, hasMore, loadMore } = useInfiniteDiscover(
    activeCategory.fetch,
    activeId
  );

  useEffect(() => {
    let cancelled = false;

    const checkAgeRestriction = async () => {
      if (!user) {
        setAccessDenied(true);
        setAccessReason("Please sign in to access this page.");
        setCheckingAccess(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/auth/age-verification`, {
          credentials: "include",
        });
        const data = await response.json();
        if (cancelled) return;

        if (!data.allowed) {
          setAccessDenied(true);
          setAccessReason(data.reason || "Age restriction applies to this content.");
        } else {
          setAccessDenied(false);
        }
      } catch {
        if (!cancelled) {
          setAccessDenied(true);
          setAccessReason("Unable to verify age at this time. Please try again later.");
        }
      } finally {
        if (!cancelled) setCheckingAccess(false);
      }
    };

    checkAgeRestriction();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // IntersectionObserver-driven infinite scroll, same pattern as MoviesPage
  // and TVShowsPage, so the browsing feel is identical across the site.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (accessDenied || checkingAccess) return;
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
  }, [accessDenied, checkingAccess, loadMore]);

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-500/10 border border-red-500/30 rounded-3xl p-6 sm:p-8 text-center">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Access Denied</h2>
            <p className="text-neutral-300 mb-6">{accessReason}</p>
            <div className="bg-[#0a0a0a]/30 rounded-xl p-4 text-left text-sm text-neutral-400">
              <p className="font-semibold text-white mb-2">Access Policy</p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <span>You must be at least 18 years old to enter Gens.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <span>
                    Your age is recalculated automatically from your date of birth,
                    so access unlocks the day you turn 18.
                  </span>
                </li>
              </ul>
            </div>
            <button
              onClick={() => setCurrentView("home")}
              className="mt-6 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#39FF14]/30 border-t-[#39FF14] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-neutral-400">Loading content…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6 sm:mb-8">
        <div className="flex items-center gap-3 sm:gap-4 mb-4">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-pink-500 to-red-500 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Heart className="h-6 w-6 sm:h-8 sm:w-8 text-white" fill="currentColor" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-pink-400 to-red-400 bg-clip-text text-transparent">
              Gens
            </h1>
            <p className="text-xs sm:text-base text-neutral-400">Romance & top-rated drama for the 18+ crowd</p>
          </div>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 sm:p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <p className="font-semibold text-yellow-400">18+ Only</p>
            <p className="text-neutral-400">
              Gens is restricted to users aged 18 and over. Your age is recalculated
              from your date of birth each visit, so access opens automatically the
              day you become eligible.
            </p>
          </div>
        </div>
      </div>

      {/* Category pill bar — mature/romance-specific categories */}
      <div className="max-w-7xl mx-auto mb-6 sm:mb-8">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-neutral-900 scrollbar-track-transparent">
          <div className="flex-none flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full text-pink-300">
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </div>
          {GENS_CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`flex-none text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-full border transition-all cursor-pointer whitespace-nowrap ${
                activeId === c.id
                  ? "bg-gradient-to-r from-pink-500 to-red-500 text-white border-transparent"
                  : "bg-white/5 text-neutral-300 border-white/10 hover:border-white/30"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active category grid */}
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <h2 className="text-xl sm:text-2xl font-bold">{activeCategory.label}</h2>
          <p className="text-xs text-neutral-500">{activeCategory.subtitle}</p>
        </div>

        {initialLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden bg-white/5 border border-white/5 animate-pulse">
                <div className="aspect-[2/3] bg-white/5" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-white/10 rounded w-3/4" />
                  <div className="h-2.5 bg-white/5 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-neutral-500 text-sm py-12 text-center">No content available for this category right now.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
              {items.map((movie) => (
                <MovieCard key={movie.id} movie={movie} onClick={() => onMovieClick(movie)} />
              ))}
            </div>

            {/* Bottom of the listing — Continue / Load More Movies */}
            <div ref={sentinelRef} className="flex justify-center py-6 sm:py-8">
              {loading && (
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <Loader2 className="h-4 w-4 animate-spin text-pink-400" />
                  Loading more titles...
                </div>
              )}
              {!hasMore && !loading && (
                <p className="text-xs text-neutral-600">You've reached the end of this collection.</p>
              )}
              {hasMore && !loading && (
                <button
                  onClick={loadMore}
                  className="text-xs sm:text-sm font-bold px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-400 hover:to-red-400 text-white transition-all cursor-pointer"
                >
                  Continue / Load More Movies
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
