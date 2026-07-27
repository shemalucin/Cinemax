import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
import { AppProvider, useApp } from "./context/AppContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Sidebar } from "./components/Sidebar";
import { MovieCard } from "./components/MovieCard";
import { WatchChoiceModal } from "./components/WatchChoiceModal";
import { AdminRedirect } from "./components/AdminRedirect";
import { AdBanner } from "./components/AdBanner";
import { MaintenanceScreen } from "./components/MaintenanceScreen";
import { PipPlayer } from "./components/PipPlayer";
import { AvatarRenderer } from "./components/AnimatedAvatar";
import { LandingPage } from "./components/LandingPage";
import { CinemaxLogo } from "./components/CinemaxLogo";
import { CinemaxTypingLogo } from "./components/CinemaxTypingLogo";
import { MobileBottomNav } from "./components/MobileBottomNav";
import { InstallAppButton } from "./components/InstallAppButton";
import { Footer } from "./components/Footer";
import { CardSizeSelector } from "./components/CardSizeSelector";

// Route-level and modal components are code-split so the initial bundle only
// contains what's needed to paint the first screen. Each becomes its own
// lazily-fetched chunk, downloaded only when the user actually navigates
// there or opens that modal — this is what cuts the initial JS payload down.
const PlayerPage = lazy(() => import("./components/PlayerPage").then(m => ({ default: m.PlayerPage })));
const ProfilePage = lazy(() => import("./components/ProfilePage").then(m => ({ default: m.ProfilePage })));
const DownloadsPage = lazy(() => import("./components/DownloadsPage").then(m => ({ default: m.DownloadsPage })));
const HelpDeskPage = lazy(() => import("./components/HelpDeskPage").then(m => ({ default: m.HelpDeskPage })));
const AuthModal = lazy(() => import("./components/AuthModal").then(m => ({ default: m.AuthModal })));
const NotificationCenter = lazy(() => import("./components/NotificationCenter").then(m => ({ default: m.NotificationCenter })));
const AboutPage = lazy(() => import("./components/AboutPage").then(m => ({ default: m.AboutPage })));
const MoviesPage = lazy(() => import("./components/MoviesPage").then(m => ({ default: m.MoviesPage })));
const TVShowsPage = lazy(() => import("./components/TVShowsPage").then(m => ({ default: m.TVShowsPage })));
const ShortsPage = lazy(() => import("./components/ShortsPage").then(m => ({ default: m.ShortsPage })));
const GensPage = lazy(() => import("./components/GensPage").then(m => ({ default: m.GensPage })));
const HomeAIAssistant = lazy(() => import("./components/HomeAIAssistant").then(m => ({ default: m.HomeAIAssistant })));
const MovieDetailsModal = lazy(() => import("./components/MovieDetailsModal").then(m => ({ default: m.MovieDetailsModal })));
const LiveChat = lazy(() => import("./components/LiveChat").then(m => ({ default: m.LiveChat })));
const AdminDestinationModal = lazy(() => import("./components/AdminDestinationModal").then(m => ({ default: m.AdminDestinationModal })));
const OnboardingPreferences = lazy(() => import("./components/OnboardingPreferences").then(m => ({ default: m.OnboardingPreferences })));

// Minimal, brand-colored fallback shown only on the very first fetch of a
// lazy chunk (subsequent visits are served from the browser cache, so this
// almost never appears after the initial navigation to a section).
const PageLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center w-full min-h-[40vh]">
    <div className="w-8 h-8 rounded-full border-2 border-[#39FF14]/20 border-t-[#39FF14] animate-spin" />
  </div>
);
import { tmdb, getImageUrl, isTvShow, prepareForPlayback } from "./utils/tmdb";
import { getQuickSearchAgent, ScoutResponse } from "./lib/quickSearchAgent";
import {
  filterHiddenMovies,
  applyTrendingOverride,
  loadFeaturedMovies,
  fetchPublicAds,
  PublicAd,
} from "./utils/siteConfig";
import { Movie } from "./types";
import { 
  Search, 
  Bell, 
  Menu, 
  Star, 
  Play, 
  Info, 
  Bookmark, 
  Heart, 
  History as HistoryIcon,
  Download,
  Tv,
  ChevronRight,
  ListPlus,
  Lock,
  Tag,
  X as XIcon,
  Mic,
  Globe,
  Film,
  Sparkles,
  Bot
} from "lucide-react";

// Pre-configured "Supergirl" Featured Hero Movie matching references
const SUPERGIRL_HERO: Movie = {
  id: 502356,
  title: "Supergirl",
  overview: "Kara Zor-El faces new challenges as she embraces her destiny in a world that needs a hero.",
  poster_path: "/subfash_supergirl_poster.jpg", // TMDB path or fallback
  backdrop_path: "/z993883u82.jpg", // fallback background
  vote_average: 8.2,
  release_date: "2023-06-16",
  genres: [{ id: 28, name: "Action" }, { id: 878, name: "Sci-Fi" }],
  runtime: 124,
};

// SUPERGIRL_HERO's backdrop_path isn't a real TMDB fragment, so it needs its
// own fallback image whenever it's the one showing in the rotating hero.
const HERO_FALLBACK_BACKDROP = "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1400&auto=format&fit=crop";

// Maps the genre ids used by the onboarding card (OnboardingPreferences.tsx)
// to their real TMDB genre ids, so "Because You Like ___" shelves can pull
// actual titles instead of staying empty.
const ONBOARDING_GENRE_ID_MAP: Record<string, number> = {
  action: 28,
  comedy: 35,
  drama: 18,
  horror: 27,
  romance: 10749,
  thriller: 53,
  "sci-fi": 878,
  animation: 16,
  documentary: 99,
  music: 10402,
  fantasy: 14,
  crime: 80,
};

const CinemaxDashboard: React.FC = () => {
  const { 
    currentView, 
    setCurrentView, 
    selectedMovie, 
    setSelectedMovie, 
    playerMode, 
    setPlayerMode,
    searchQuery, 
    setSearchQuery, 
    user,
    activeGenre,
    setActiveGenre,
    activeGenreName,
    setActiveGenreName,
    rememberChoice,
    defaultWatchChoice,
    addToWatchlist,
    unreadCount,
    authLoading,
    requireSignInPrompt,
    enterAsGuest,
    isGuest,
    authModalOpen,
    authModalMode,
    authModalInitialStep,
    authModalPrefillEmail,
    openAuthModal,
    openForgotPasswordModal,
    closeAuthModal,
    t,
    adminDestinationOpen,
    goToAdminPanel,
    dismissAdminToWebsite,
    siteConfig,
  } = useApp();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [allGenres, setAllGenres] = useState<Array<{ id: number; name: string }>>([]);
  const [choiceModalOpen, setChoiceModalOpen] = useState(false);
  const [modalTargetMovie, setModalTargetMovie] = useState<Movie | null>(null);
  const [mobileSearchExpanded, setMobileSearchExpanded] = useState(false);
  const [isConversationalAIActive, setIsConversationalAIActive] = useState(false);
  // Scout's captions: what you said, and what Scout said back — both always
  // shown as text regardless of whether the audio actually plays.
  const [scoutHeardText, setScoutHeardText] = useState<string>("");
  const [scoutReplyText, setScoutReplyText] = useState<string>("");
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [showTranscriptPopup, setShowTranscriptPopup] = useState(false);

  // Scout — the search bar's voice agent (separate personality and backend
  // route from the "All Kiki's" chat assistant; see src/lib/quickSearchAgent.ts)
  const scoutAgent = useRef(getQuickSearchAgent());
  // handleMovieClick is redefined every render; Scout's setup effect below
  // only runs once on mount, so it reads through this ref instead of
  // closing over a stale copy directly.
  const handleMovieClickRef = useRef<(movie: Movie) => void>(() => {});

  // Hero banner rotation — cycles the homepage hero through a handful of
  // featured titles every 3 seconds.
  const [heroIndex, setHeroIndex] = useState(0);

  // "More Info" details modal — a distinct, fuller view of a title, separate
  // from actually starting playback.
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsModalMovie, setDetailsModalMovie] = useState<Movie | null>(null);

  // Splash screen states
  const [showSplash, setShowSplash] = useState(true);
  const [fadeSplash, setFadeSplash] = useState(false);

  // Post-login typing animation state
  const [showTypingLogo, setShowTypingLogo] = useState(false);
  const [hasShownTypingLogo, setHasShownTypingLogo] = useState(false);

  // TMDB Lists state
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const [trendingTV, setTrendingTV] = useState<Movie[]>([]);
  const [popularMovies, setPopularMovies] = useState<Movie[]>([]);
  const [topRated, setTopRated] = useState<Movie[]>([]);
  const [upcoming, setUpcoming] = useState<Movie[]>([]);
  const [nowPlaying, setNowPlaying] = useState<Movie[]>([]);
  const [customContent, setCustomContent] = useState<Movie[]>([]);
  const [featuredHeroMovies, setFeaturedHeroMovies] = useState<Movie[]>([]);
  const [publicAds, setPublicAds] = useState<PublicAd[]>([]);
  // Real TMDB results for the user's onboarding-selected genres, keyed by
  // genre slug (e.g. "action"). Populated below once onboarding data is
  // available, so the "Your Favorites" shelves show actual titles instead
  // of staying empty.
  const [personalizedMovies, setPersonalizedMovies] = useState<Record<string, Movie[]>>({});

  // Search/Filters results state
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [genreFilteredMovies, setGenreFilteredMovies] = useState<Movie[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
  const [searchNextPage, setSearchNextPage] = useState(4);
  const searchSentinelRef = useRef<HTMLDivElement>(null);
  const [preparingPlayKey, setPreparingPlayKey] = useState<string | null>(null);

  // (Live TV feature replaced by Shorts — see ShortsPage.tsx)

  // Load all lists — honors admin catalog curation (hidden IDs, trending override, featured hero)
  useEffect(() => {
    const loadAllLists = async () => {
      try {
        const hiddenIds = siteConfig.hiddenMovieIds || [];
        const trendingOverride = siteConfig.trendingOverrideIds || [];
        const featuredIds = siteConfig.featuredMovieIds || [];

        // Load custom content first to merge into TMDB lists
        let customMovies: Movie[] = [];
        try {
          const customRes = await fetch("/api/content/custom");
          if (customRes.ok) {
            const { movies } = await customRes.json();
            customMovies = movies || [];
            setCustomContent(customMovies);
          }
        } catch {
          /* optional */
        }

        // Helper to merge custom content into TMDB lists
        const mergeCustomContent = (tmdbList: Movie[], mediaType?: 'movie' | 'tv') => {
          const filteredCustom = mediaType 
            ? customMovies.filter(m => m.media_type === mediaType)
            : customMovies;
          
          // Merge by removing duplicates and maintaining order
          const seen = new Set(tmdbList.map(m => m.id));
          const uniqueCustom = filteredCustom.filter(m => !seen.has(m.id));
          
          return [...tmdbList, ...uniqueCustom];
        };

        // Load multiple pages from each endpoint to get more content
        const loadMultiplePages = async (fetchFn: (page: number) => Promise<Movie[]>, pages: number = 3) => {
          const results = await Promise.all(
            Array.from({ length: pages }, (_, i) => fetchFn(i + 1))
          );
          return results.flat();
        };

        const [trendingM, trendingT, popular, top, up, now] = await Promise.all([
          loadMultiplePages((page) => tmdb.getTrendingMovies(page), 3),
          loadMultiplePages((page) => tmdb.getTrendingTVShows(page), 6),
          loadMultiplePages((page) => tmdb.getPopularMovies(page), 3),
          loadMultiplePages((page) => tmdb.getTopRatedMovies(page), 2),
          tmdb.getAllUpcomingMovies(), // Fetch all upcoming movies across multiple pages
          loadMultiplePages((page) => tmdb.getNowPlayingMovies(page), 2),
        ]);

        const applyHidden = (list: Movie[]) => filterHiddenMovies(list, hiddenIds);
        
        // Merge custom content into TMDB lists
        let curatedTrending = applyHidden(mergeCustomContent(trendingM, 'movie'));
        if (trendingOverride.length) {
          curatedTrending = await applyTrendingOverride(curatedTrending, trendingOverride);
        }

        setTrendingMovies(curatedTrending);
        setTrendingTV(applyHidden(mergeCustomContent(trendingT, 'tv')));
        setPopularMovies(applyHidden(mergeCustomContent(popular, 'movie')));
        setTopRated(applyHidden(mergeCustomContent(top)));
        setUpcoming(applyHidden(up));
        setNowPlaying(applyHidden(mergeCustomContent(now, 'movie')));

        if (featuredIds.length) {
          setFeaturedHeroMovies(await loadFeaturedMovies(featuredIds));
        } else {
          setFeaturedHeroMovies([]);
        }

        try {
          setPublicAds(await fetchPublicAds());
        } catch {
          setPublicAds([]);
        }

        const genreList = await tmdb.getGenres("movie");
        try {
          const catRes = await fetch("/api/categories/public");
          if (catRes.ok) {
            const { hiddenIds: hiddenGenreIds, labels } = await catRes.json();
            const hiddenSet = new Set(hiddenGenreIds || []);
            setAllGenres(
              genreList
                .filter((g: { id: number }) => !hiddenSet.has(g.id))
                .map((g: { id: number; name: string }) => ({
                  id: g.id,
                  name: labels?.[String(g.id)] || g.name,
                }))
            );
          } else {
            console.warn("[App] Categories API returned non-OK status, using default genres");
            setAllGenres(genreList);
          }
        } catch (err) {
          console.error("[App] Failed to fetch categories overrides, using default genres:", err);
          setAllGenres(genreList);
        }
      } catch (err) {
        console.error("Failed to load TMDB lists on app startup:", err);
      }
    };
    loadAllLists();
  }, [siteConfig.hiddenMovieIds, siteConfig.trendingOverrideIds, siteConfig.featuredMovieIds]);

  // Fetch real titles for each of the signed-in user's favorite genres
  // (collected during onboarding) so the homepage can actually show them,
  // not just reserve empty shelves.
  useEffect(() => {
    const favoriteGenres = user?.onboarding?.favoriteGenres;
    if (!favoriteGenres || favoriteGenres.length === 0) {
      setPersonalizedMovies({});
      return;
    }
    let cancelled = false;
    (async () => {
      const hiddenIds = siteConfig.hiddenMovieIds || [];
      const entries = await Promise.all(
        favoriteGenres
          .map((g) => g.toLowerCase())
          .filter((g) => ONBOARDING_GENRE_ID_MAP[g])
          .map(async (genreKey) => {
            try {
              const { results } = await tmdb.discoverMoviesByGenre(ONBOARDING_GENRE_ID_MAP[genreKey]);
              return [genreKey, filterHiddenMovies(results, hiddenIds)] as const;
            } catch {
              return [genreKey, []] as const;
            }
          })
      );
      if (!cancelled) {
        setPersonalizedMovies(Object.fromEntries(entries));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.onboarding?.favoriteGenres, siteConfig.hiddenMovieIds]);

  // One-time movie-focused splash screen timer - logo visible for 4 seconds
  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setFadeSplash(true);
    }, 3500);

    const unmountTimer = setTimeout(() => {
      setShowSplash(false);
    }, 4000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
    };
  }, []);

  // Show typing animation after user logs in (only once per session)
  useEffect(() => {
    // Only trigger if user is logged in, hasn't seen the animation yet, and splash is done
    if (user && !hasShownTypingLogo && !showSplash) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setShowTypingLogo(true);
        setHasShownTypingLogo(true);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [user, hasShownTypingLogo, showSplash]);

  const handleTypingComplete = () => {
    setShowTypingLogo(false);
  };

  // Hero rotation — admin-featured titles, or curated Supergirl + trending fallback
  const heroMovies =
    featuredHeroMovies.length > 0
      ? featuredHeroMovies
      : trendingMovies.length > 0
        ? [SUPERGIRL_HERO, ...trendingMovies.slice(0, 4)]
        : [SUPERGIRL_HERO];
  const heroMovie = heroMovies[heroIndex % heroMovies.length];

  useEffect(() => {
    if (heroMovies.length < 2) return;
    const t = setInterval(() => setHeroIndex((i) => (i + 1) % heroMovies.length), 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroMovies.length]);

  // Initialize Conversational AI Agent
  useEffect(() => {
    const agent = scoutAgent.current;

    agent.onInterimTranscript((text: string) => {
      setInterimTranscript(text);
      if (text.length > 6) setShowTranscriptPopup(true);
    });

    agent.onFinalTranscript((text: string) => {
      setScoutHeardText(text);
      setInterimTranscript('');
      setShowTranscriptPopup(false);
    });

    // Scout's job is deliberately narrow: search, or play a title it just
    // found. Anything else comes back as intent "decline" and Scout says so
    // instead of trying to act on it — it does not navigate the site, open
    // settings, manage the watchlist, or anything the chat assistant covers.
    agent.onReplyReady(async (response: ScoutResponse) => {
      setScoutReplyText(response.text);

      if (response.intent === "search" && response.query?.trim()) {
        const q = response.query.trim();
        setSearchQuery(q); // Same state the visible header input is bound to — this *is* the search bar integration.
        try {
          const [tmdbBatch, customMatches] = await Promise.all([
            tmdb.searchEverything(q, { startPage: 1, pageCount: 3 }),
            tmdb.searchCustomContent(q),
          ]);
          const seen = new Set<string>();
          const combined: Movie[] = [];
          for (const item of [...customMatches, ...tmdbBatch.results]) {
            const key = `${item.media_type || (item.title ? "movie" : "tv")}:${item.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            combined.push(item);
          }
          setSearchResults(combined);
          setSearchHasMore(tmdbBatch.hasMore);
          setSearchNextPage(4);
        } catch (err) {
          console.error("Scout search error:", err);
        }
      } else if (response.intent === "play" && response.title?.trim()) {
        const title = response.title.trim().toLowerCase();
        try {
          const { results } = await tmdb.searchEverything(response.title.trim(), { startPage: 1, pageCount: 1 });
          const bestMatch =
            results.find((m) => (m.title || m.name || "").toLowerCase() === title) || results[0];
          if (bestMatch) {
            handleMovieClickRef.current(bestMatch);
          } else {
            setScoutReplyText(`I couldn't find "${response.title.trim()}" — try a different title.`);
          }
        } catch (err) {
          console.error("Scout play-lookup error:", err);
        }
      }
      // intent === "decline": caption already shown above, nothing to execute.
    });

    return () => {
      agent.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleConversationalAI = () => {
    const agent = scoutAgent.current;

    if (!agent.isActive()) {
      setScoutHeardText("");
      setScoutReplyText("");
      const started = agent.start();
      if (started) {
        setIsConversationalAIActive(true);
        agent.speak("Scout here. Say a title to search, or say play and a title.");
      } else {
        alert('Voice search is not supported in your browser. Please use Chrome or Edge.');
      }
    } else {
      agent.stop();
      setIsConversationalAIActive(false);
    }
  };

  // Unified search — movies + TV + multi index, ranked and paginated
  useEffect(() => {
    if (searchQuery.trim().length <= 1) {
      setSearchResults([]);
      setSearchHasMore(false);
      setSearchNextPage(4);
      return;
    }

    setIsSearching(true);
    const q = searchQuery.trim();
    const delayDebounce = setTimeout(async () => {
      try {
        console.log('Starting search for:', q);
        const [tmdbBatch, customMatches] = await Promise.all([
          tmdb.searchEverything(q, { startPage: 1, pageCount: 3 }),
          tmdb.searchCustomContent(q),
        ]);
        
        console.log('TMDB search results:', tmdbBatch.results.length, 'Custom matches:', customMatches.length);
        
        const seen = new Set<string>();
        const combined: Movie[] = [];
        for (const item of [...customMatches, ...tmdbBatch.results]) {
          const key = `${item.media_type || (item.title ? "movie" : "tv")}:${item.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          combined.push(item);
        }
        
        console.log('Combined search results:', combined.length);
        setSearchResults(combined);
        setSearchHasMore(tmdbBatch.hasMore);
        setSearchNextPage(4);
      } catch (err) {
        console.error("Advanced search query error:", err);
        setSearchResults([]);
        setSearchHasMore(false);
      } finally {
        setIsSearching(false);
      }
    }, 150);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const loadMoreSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (q.length <= 1 || searchLoadingMore || !searchHasMore) return;
    setSearchLoadingMore(true);
    try {
      const batch = await tmdb.searchEverything(q, { startPage: searchNextPage, pageCount: 2 });
      setSearchResults((prev) => {
        const seen = new Set(prev.map((m) => `${m.media_type || (m.title ? "movie" : "tv")}:${m.id}`));
        const added = batch.results.filter((m) => {
          const key = `${m.media_type || (m.title ? "movie" : "tv")}:${m.id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        return [...prev, ...added];
      });
      setSearchHasMore(batch.hasMore);
      setSearchNextPage((p) => p + 2);
    } catch (err) {
      console.error("Search pagination error:", err);
    } finally {
      setSearchLoadingMore(false);
    }
  }, [searchQuery, searchLoadingMore, searchHasMore, searchNextPage]);

  useEffect(() => {
    const el = searchSentinelRef.current;
    if (!el || searchQuery.trim().length <= 1) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMoreSearch();
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [searchQuery, loadMoreSearch, searchHasMore]);

  // Handle genre/category filter changes (upgraded to support all 29 categories!)
  useEffect(() => {
    if (activeGenre !== null) {
      const loadGenreMovies = async () => {
        try {
          const allPool = [
            ...trendingMovies,
            ...popularMovies,
            ...topRated,
            ...upcoming,
            ...nowPlaying,
            ...trendingTV
          ];
          
          // Remove duplicates
          const uniquePool = Array.from(new Map(allPool.map(item => [item.id, item])).values());
          
          let filtered: Movie[] = [];
          if (typeof activeGenre === "number") {
            filtered = uniquePool.filter(m => m.genre_ids?.includes(activeGenre));
          } else {
            // String-based custom category matches
            switch (activeGenre) {
              case "trending":
                filtered = [...trendingMovies];
                break;
              case "popular":
                filtered = [...popularMovies];
                break;
              case "top_rated":
                filtered = [...topRated];
                break;
              case "upcoming":
                filtered = [...upcoming];
                break;
              case "now_playing":
                filtered = [...nowPlaying];
                break;
              case "superhero":
                const keywords = ["super", "man", "spider", "bat", "captain", "avenger", "hero", "knight", "girl", "marvel", "dc", "justice"];
                filtered = uniquePool.filter(m => {
                  const title = (m.title || m.name || "").toLowerCase();
                  return keywords.some(kw => title.includes(kw));
                });
                break;
              case "anime":
                filtered = uniquePool.filter(m => 
                  m.genre_ids?.includes(16) || 
                  (m.title || m.name || "").toLowerCase().includes("anime") ||
                  (m.title || m.name || "").toLowerCase().includes("demon")
                );
                break;
              case "kids":
                filtered = uniquePool.filter(m => m.genre_ids?.includes(10751) || m.genre_ids?.includes(16));
                break;
              case "classic":
                filtered = uniquePool.filter(m => {
                  const date = m.release_date || m.first_air_date || "";
                  const year = parseInt(date.substring(0, 4));
                  return !isNaN(year) && year < 2018;
                });
                break;
              case "award":
                filtered = uniquePool.filter(m => m.vote_average >= 8.0);
                break;
              case "latest":
                filtered = uniquePool.filter(m => {
                  const date = m.release_date || m.first_air_date || "";
                  const year = parseInt(date.substring(0, 4));
                  return !isNaN(year) && year >= 2023;
                });
                break;
              default:
                filtered = uniquePool;
            }
          }
          setGenreFilteredMovies(filtered);
        } catch (err) {
          console.error("Error filtering by genre:", err);
        }
      };
      loadGenreMovies();
    } else {
      setGenreFilteredMovies([]);
    }
  }, [activeGenre, trendingMovies, popularMovies, topRated, upcoming, nowPlaying, trendingTV]);

  const handleMovieClick = async (movie: Movie, fromSearch: boolean = false) => {
    const playKey = `${movie.media_type || (isTvShow(movie) ? "tv" : "movie")}:${movie.id}`;
    setPreparingPlayKey(playKey);
    // Clear search query when clicking a movie to ensure player view takes priority
    setSearchQuery("");
    
    // Check if movie is upcoming (future release date)
    const today = new Date().toISOString().split('T')[0];
    const releaseDate = movie.release_date || movie.first_air_date;
    const isUpcoming = releaseDate && releaseDate > today;
    
    try {
      console.log(`handleMovieClick: Preparing ${movie.title || movie.name} for playback`);
      const ready = await prepareForPlayback(movie);
      console.log(`handleMovieClick: Prepared movie with media_type=${ready.media_type}, id=${ready.id}`);
      
      // For upcoming movies, only show trailer (no full movie option)
      if (isUpcoming) {
        console.log(`handleMovieClick: Movie is upcoming, showing trailer only`);
        setSelectedMovie(ready);
        setPlayerMode("trailer");
        setCurrentView("player");
      } else if (fromSearch) {
        // When coming from search, default to full movie playback directly
        console.log(`handleMovieClick: From search, defaulting to full movie playback`);
        setSelectedMovie(ready);
        setPlayerMode("full");
        setCurrentView("player");
      } else if (rememberChoice && defaultWatchChoice) {
        // User has chosen to remember their choice — use it directly
        console.log(`handleMovieClick: Using remembered choice: ${defaultWatchChoice}`);
        setSelectedMovie(ready);
        setPlayerMode(defaultWatchChoice);
        setCurrentView("player");
      } else {
        // Every other card click opens the "Watch Full Movie / Watch Trailer"
        // prompt so the user always picks intentionally.
        console.log(`handleMovieClick: Opening watch-choice modal`);
        setModalTargetMovie(ready);
        setChoiceModalOpen(true);
      }
    } catch (err) {
      console.error("Failed to prepare title for playback:", err);
      const fallback: Movie = {
        ...movie,
        media_type: movie.media_type ?? (isTvShow(movie) ? "tv" : "movie"),
      };
      
      // For upcoming movies, only show trailer even on error
      if (isUpcoming) {
        setSelectedMovie(fallback);
        setPlayerMode("trailer");
        setCurrentView("player");
      } else if (fromSearch) {
        // When coming from search, default to full movie playback even on error
        setSelectedMovie(fallback);
        setPlayerMode("full");
        setCurrentView("player");
      } else {
        // Fall back to the same choice prompt so the user still picks
        setModalTargetMovie(fallback);
        setChoiceModalOpen(true);
      }
    } finally {
      setPreparingPlayKey(null);
    }
  };
  useEffect(() => {
    handleMovieClickRef.current = handleMovieClick;
  });

  const handlePlayFullMovie = async (movie: Movie) => {
    const playKey = `${movie.media_type || (isTvShow(movie) ? "tv" : "movie")}:${movie.id}`;
    setPreparingPlayKey(playKey);
    try {
      console.log(`handlePlayFullMovie: Preparing ${movie.title || movie.name} for full playback`);
      const ready = await prepareForPlayback(movie);
      console.log(`handlePlayFullMovie: Prepared movie with media_type=${ready.media_type}, id=${ready.id}`);
      setSelectedMovie(ready);
      setPlayerMode("full");
      setChoiceModalOpen(false);
      setCurrentView("player");
    } catch (err) {
      console.error("Failed to prepare full movie stream:", err);
      // Even if prepareForPlayback fails, still try to play with original data
      setSelectedMovie({
        ...movie,
        media_type: movie.media_type ?? (isTvShow(movie) ? "tv" : "movie"),
      });
      setPlayerMode("full");
      setChoiceModalOpen(false);
      setCurrentView("player");
    } finally {
      setPreparingPlayKey(null);
    }
  };

  const handleChoiceSelected = (choice: "full" | "trailer") => {
    if (!modalTargetMovie) return;
    setSelectedMovie(modalTargetMovie);
    setPlayerMode(choice);
    setChoiceModalOpen(false);
    setCurrentView("player");
  };

  // Check Watchlisted items for "My List" view
  const getMyListMovies = () => {
    if (!user) return [];
    const ids = user.myList || user.watchlist || [];
    const all = [...trendingMovies, ...trendingTV, ...popularMovies, ...topRated];
    const matched = all.filter(m => ids.includes(m.id));
    return Array.from(new Map(matched.map(item => [item.id, item])).values());
  };

  const getContinueWatchingMovies = () => {
    if (!user?.watchHistory) return [];
    const inProgress = user.watchHistory.filter(h => h.progress > 0 && h.progress < 100);
    const all = [...trendingMovies, ...trendingTV, ...popularMovies, ...topRated];
    return inProgress.map(h => {
      const found = all.find(m => m.id === h.id);
      return found ? { ...found, _progress: h.progress, _season: h.season, _episode: h.episode } : null;
    }).filter(Boolean) as (Movie & { _progress?: number; _season?: number; _episode?: number })[];
  };

  // Reusable "sign in required" placeholder for guest-restricted views
  const renderGuestLock = (label: string) => (
    <div className="text-center py-24 text-neutral-500 space-y-4">
      <div className="h-14 w-14 rounded-2xl surface-elevated flex items-center justify-center mx-auto text-neutral-400">
        <Lock className="h-6 w-6" />
      </div>
      <h3 className="font-sans font-bold text-lg text-neutral-300">Sign in to view {label}</h3>
      <p className="text-xs max-w-sm mx-auto">You're browsing as a guest. Create a free account or sign in to unlock this.</p>
    </div>
  );

  // Helper for rendering horizontal row shelfs - Premium Enhanced
  const renderRowShelf = (title: string, movies: Movie[], hasRank = false, seeAllTarget?: { view: "movies" | "tv"; genre?: string | number | null; genreLabel?: string }) => {
    if (movies.length === 0) return null;
    return (
      <div className="space-y-4 sm:space-y-5 pt-4 sm:pt-6">
        <div className="flex items-center justify-between px-4 lg:px-0">
          <div className="flex items-center gap-3">
            <span className="h-6 w-1.5 bg-gradient-to-b from-[#39FF14] to-[#31dd11] rounded-full shadow-[0_0_15px_rgba(57,255,20,0.5)]" />
            <h3 className="font-sans font-extrabold text-lg sm:text-xl tracking-tight text-white">
              {title}
            </h3>
          </div>
          <div className="flex items-center gap-4">
            <CardSizeSelector />
            <button
              onClick={() => {
                if (seeAllTarget) {
                  setActiveGenre(seeAllTarget.genre ?? null);
                  setActiveGenreName(seeAllTarget.genreLabel ?? title);
                  setCurrentView(seeAllTarget.view);
                } else {
                  setCurrentView("movies");
                }
              }}
              className="group flex items-center gap-2 text-xs font-bold text-[#39FF14] hover:text-[#31dd11] transition-all duration-300 cursor-pointer"
            >
              <span className="group-hover:translate-x-0.5 transition-transform">See All</span>
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        <div className="flex gap-2 sm:gap-2.5 overflow-x-auto pb-4 sm:pb-6 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent px-4 lg:px-0">
          {movies.map((movie, index) => (
            <MovieCard
              movie={movie}
              rank={hasRank ? index + 1 : undefined}
              onClick={() => handleMovieClick(movie)}
              key={movie.id}
            />
          ))}
        </div>
      </div>
    );
  };

  const splashScreen = (
    <div
      id="splash-loader-screen"
      className={`fixed inset-0 z-[10000] bg-[#121418] on-dark-bg flex flex-col items-center justify-center transition-opacity duration-500 ease-out ${fadeSplash ? "opacity-0 pointer-events-none" : "opacity-100"}`}
    >
      <div className="flex flex-col items-center gap-6 max-w-sm px-6 text-center">
        <div className="h-20 w-20 rounded-3xl logo-mark flex items-center justify-center">
          <svg
            className="h-10 w-10 text-black"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 2a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H2Z" />
            <path d="M2 7h20" />
            <path d="m14 2-4 5" />
            <path d="m8 2-4 5" />
            <path d="m20 2-4 5" />
            <path d="M10 11H7v7h3V11Z" />
            <path d="M17 11h-3v7h3V11Z" />
          </svg>
        </div>

        <div className="space-y-1.5">
          <span className="text-2xl font-black tracking-tighter flex items-center justify-center select-none font-sans">
            <span className="brand-cinema">CINEMA</span><span className="brand-x">X</span>
          </span>
          <p className="text-[10px] text-neutral-500 font-mono tracking-widest uppercase font-black">
            STRICTLY MOVIES & SERIES ONLY
          </p>
        </div>
      </div>
    </div>
  );

  // Minimal branded header shown above Help/About when browsed pre-login,
  // so those pages don't feel orphaned on a blank background. Clicking the
  // logo returns to the marketing landing page.
  const publicPageHeader = (
    <header className="relative z-10 flex items-center justify-between px-6 sm:px-12 py-6">
      <button
        id="public-page-logo-home-btn"
        onClick={() => setCurrentView("home")}
        className="flex items-center gap-2 cursor-pointer"
      >
        <CinemaxLogo compact />
      </button>
    </header>
  );

  // Splash always shows first (brand moment + gives the session check time to
  // resolve). Only once it's done do we know whether to show the marketing
  // landing page (unauthenticated) or the real dashboard (authenticated).
  if (showSplash || authLoading) {
    return splashScreen;
  }

  // Show typing animation after login (only once per session)
  if (showTypingLogo) {
    return <CinemaxTypingLogo onComplete={handleTypingComplete} />;
  }

  const inMaintenance = siteConfig.maintenanceMode && user?.role !== "admin";
  if (inMaintenance) {
    return (
      <MaintenanceScreen
        siteName={siteConfig.siteName}
        heroTagline={siteConfig.heroTagline}
      />
    );
  }

  const homepageAdsTop = publicAds.filter((a) => a.placement === "homepage_top");
  const homepageAdsMid = publicAds.filter((a) => a.placement === "homepage_mid");

  // Personalized sections based on user onboarding preferences — populated
  // with real TMDB results by the effect below (personalizedMovies).
  const personalizedSections = user?.onboarding?.favoriteGenres
    ? user.onboarding.favoriteGenres
        .filter((genre) => ONBOARDING_GENRE_ID_MAP[genre.toLowerCase()])
        .map((genre) => ({
          id: `personalized_${genre}`,
          genreKey: genre.toLowerCase(),
          label: `Because You Like ${genre.charAt(0).toUpperCase() + genre.slice(1)}`,
          genreId: ONBOARDING_GENRE_ID_MAP[genre.toLowerCase()],
          visible: true,
        }))
    : [];

  const homepageSectionData: Record<
    string,
    { movies: Movie[]; hasRank?: boolean; seeAll?: { view: "movies" | "tv"; genre?: string | number | null; genreLabel?: string } }
  > = {
    trending: { movies: trendingMovies, hasRank: true, seeAll: { view: "movies", genre: "trending", genreLabel: "Trending Now" } },
    tv: { movies: trendingTV, seeAll: { view: "tv" } },
    popular: { movies: popularMovies, seeAll: { view: "movies", genre: "popular", genreLabel: "Popular Movies" } },
    top_rated: { movies: topRated, seeAll: { view: "movies", genre: "top_rated", genreLabel: "Top Rated Cinema Hits" } },
    upcoming: { movies: upcoming, seeAll: { view: "movies", genre: "upcoming", genreLabel: "Upcoming Blockbusters" } },
    now_playing: { movies: nowPlaying, seeAll: { view: "movies", genre: "now_playing", genreLabel: "Now Playing in Theaters" } },
  };

  // Add personalized genre sections if user has completed onboarding —
  // backed by the real titles fetched in the effect above.
  if (personalizedSections.length > 0) {
    personalizedSections.forEach((section) => {
      homepageSectionData[section.id] = {
        movies: personalizedMovies[section.genreKey] || [],
        seeAll: { view: "movies", genre: section.genreId, genreLabel: section.label },
      };
    });
  }

  if (!user) {
    // The footer's Help/About links work even before signing in — they
    // reuse the same currentView state the authenticated app uses, so once
    // someone does sign in, they land right back on the page they were
    // reading instead of being reset to the dashboard.
    if (currentView === "help") {
      return (
        <div id="public-help-page" className="min-h-screen bg-[#121418] text-white">
          {publicPageHeader}
          <Suspense fallback={<PageLoadingFallback />}>
            <HelpDeskPage />
          </Suspense>
          <Footer />
          <Suspense fallback={null}>
            <AuthModal isOpen={authModalOpen} onClose={closeAuthModal} defaultMode={authModalMode} initialStep={authModalInitialStep} initialEmail={authModalPrefillEmail} />
          </Suspense>
        </div>
      );
    }
    if (currentView === "about") {
      return (
        <div id="public-about-page" className="min-h-screen bg-[#121418] text-white">
          {publicPageHeader}
          <Suspense fallback={<PageLoadingFallback />}>
            <AboutPage />
          </Suspense>
          <Footer />
          <Suspense fallback={null}>
            <AuthModal isOpen={authModalOpen} onClose={closeAuthModal} defaultMode={authModalMode} initialStep={authModalInitialStep} initialEmail={authModalPrefillEmail} />
          </Suspense>
        </div>
      );
    }
    return (
      <>
        <LandingPage />
        <Suspense fallback={null}>
          <AuthModal isOpen={authModalOpen} onClose={closeAuthModal} defaultMode={authModalMode} initialEmail={authModalPrefillEmail} />
        </Suspense>
      </>
    );
  }

  return (
    <div id="dashboard-wrapper" className="min-h-screen bg-[#121418] text-neutral-200 relative overflow-hidden">
      <Suspense fallback={<PageLoadingFallback />}>
      {/* Background Radial Glow Gradient from theme */}
      <div className="bg-gradient-radial-overlay" />

      {/* Left Sidebar Menu */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Main Content Area Container */}
      <div id="main-content-panel" className="lg:pl-56 flex flex-col min-h-screen">
        
        {/* Top Header Navbar with frosted blur */}
        <header id="top-navbar" className="h-16 sm:h-20 glass-navbar sticky top-0 z-40 px-3 sm:px-4 lg:px-8 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Left Section: Mobile menu, Search, Voice Agent, Download App */}
          <div className="flex items-center gap-1.5 sm:gap-2 sm:gap-4 flex-shrink-0">
            <button
              id="mobile-menu-trigger"
              aria-label="Open navigation menu"
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl border border-white/5 text-neutral-400 hover:bg-white/5 hover:text-white lg:hidden cursor-pointer flex-shrink-0"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Mobile Categories Dropdown */}
            <div className="relative sm:hidden">
              <button
                id="mobile-categories-btn"
                onClick={() => setCategoriesOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  categoriesOpen ? "bg-[#39FF14]/10 text-[#39FF14]" : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <span>All</span>
                <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-300 ${categoriesOpen ? "rotate-90" : ""}`} />
              </button>
              {categoriesOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setCategoriesOpen(false)} />
                  <div
                    id="mobile-categories-dropdown"
                    className="absolute left-0 top-full mt-2 z-50 w-72 animate-dropdown-pop transition-all duration-300 ease-out"
                  >
                    <div className="absolute -top-1.5 left-4 h-3 w-3 rotate-45 bg-[#0c0c0c] border-l border-t border-[#39FF14]/20" />
                    <div className="relative rounded-2xl border border-neutral-800 surface-panel overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 bg-gradient-to-r from-[#39FF14]/10 to-transparent">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-[#39FF14]/15 border border-[#39FF14]/30 flex items-center justify-center text-[#39FF14]">
                            <Tag className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-xs font-black text-white uppercase tracking-wider">{t("browseCategories")}</span>
                        </div>
                        <span className="text-[10px] font-bold text-[#39FF14] bg-[#39FF14]/10 border border-[#39FF14]/20 px-2 py-0.5 rounded-full">
                          {allGenres.length}
                        </span>
                      </div>
                      <div className="max-h-80 overflow-y-auto p-2 grid grid-cols-2 gap-1.5 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
                        {allGenres.map((g) => {
                          const isActive = activeGenre === g.id;
                          return (
                            <button
                              key={g.id}
                              onClick={() => {
                                setActiveGenre(g.id);
                                setActiveGenreName(t(`genre.${g.name}`));
                                setCurrentView("movies");
                                setCategoriesOpen(false);
                              }}
                              className={`group relative flex items-center gap-2 text-left px-3 py-2.5 rounded-xl text-[11px] font-semibold transition-all duration-200 cursor-pointer overflow-hidden ${
                                isActive
                                  ? "accent-chip"
                                  : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 transition-all duration-200 ${
                                isActive ? "bg-[#39FF14]" : "bg-neutral-700 group-hover:bg-neutral-600"
                              }`} />
                              <span className="truncate">{t(`genre.${g.name}`)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Instant Search input — permanently visible across all devices */}
            <div className="relative w-40 sm:w-56 md:w-64 lg:w-80 xl:w-96 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 pointer-events-none transition-colors group-focus-within:text-[#39FF14]" aria-hidden="true" />
              <input
                id="header-search-input"
                type="text"
                aria-label="Search movies, TV shows, and actors"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="header-search-input-mobile w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-12 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#39FF14]/50 focus:bg-white/10 focus:shadow-[0_0_20px_rgba(57,255,20,0.3)] transition-all duration-300 ease-out transform sm:focus:scale-105"
              />
              {/* Scout — voice search button. Scout only searches and plays; it doesn't navigate, open settings, etc. */}
              <button
                onClick={toggleConversationalAI}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-all duration-300 cursor-pointer ${
                  isConversationalAIActive 
                    ? 'voice-button-active text-[#39FF14] scale-110 shadow-[0_0_15px_rgba(57,255,20,0.5)]' 
                    : 'hover:bg-white/10 text-neutral-400 hover:text-[#39FF14] hover:scale-110'
                }`}
                title={isConversationalAIActive ? "Scout is listening…" : "Voice search (Scout)"}
              >
                <Mic className="h-4 w-4" />
              </button>
            </div>

            {/* Scout's captions — always shown as text, whether or not the audio plays */}
            {(scoutHeardText || scoutReplyText) && (
              <div className="mt-2 px-3 py-2 rounded-xl bg-[#39FF14]/10 border border-[#39FF14]/30 text-xs space-y-1">
                {scoutHeardText && (
                  <p className="text-neutral-400">
                    <span className="font-semibold text-neutral-300">You said:</span> {scoutHeardText}
                  </p>
                )}
                {scoutReplyText && (
                  <p className="text-[#39FF14]">
                    <span className="font-semibold">Scout:</span> {scoutReplyText}
                  </p>
                )}
              </div>
            )}

            {/* Real-time Transcript Popup */}
            {showTranscriptPopup && interimTranscript && (
              <div className="fixed bottom-4 right-4 w-64 bg-[#1a1d23]/95 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl z-50 p-3 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#39FF14] animate-pulse mt-1.5" />
                  <div className="flex-1">
                    <p className="text-xs text-neutral-400 mb-1">Listening…</p>
                    <p className="text-sm text-white leading-relaxed">{interimTranscript}</p>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Center Navigation: Movies / TV Shows / Genres —
             hidden on mobile (the hamburger drawer already covers every one
             of these links); shown from sm up once there's room for it. */}
          <nav className="hidden sm:flex items-center gap-1 flex-shrink-0 overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
            <button
              id="nav-movies-btn"
              onClick={() => { setActiveGenre(null); setActiveGenreName(null); setCurrentView("movies"); }}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentView === "movies" ? "bg-[#39FF14]/10 text-[#39FF14]" : "text-neutral-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Film className="h-3.5 w-3.5" />
              {t("movies")}
            </button>
            <button
              id="nav-tv-btn"
              onClick={() => setCurrentView("tv")}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentView === "tv" ? "bg-[#39FF14]/10 text-[#39FF14]" : "text-neutral-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Tv className="h-3.5 w-3.5" />
              {t("tvShows")}
            </button>
          </nav>

          {/* Right Header Navigation widgets */}
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {/* Premium upsell chip — hidden once the person already has an ad-free plan */}
            {(!user || isGuest || user.subscription !== "Premium") && (
              <button
                onClick={() => setCurrentView("profile")}
                title="Upgrade to remove ads"
                className="hidden md:inline-flex premium-chip"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Watch Ad-Free</span>
              </button>
            )}

            {/* Notification bell — locked for guests */}
            <div className="relative">
              <button
                id="notification-bell-btn"
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
                onClick={() => (user && !isGuest ? setNotifOpen((v) => !v) : requireSignInPrompt())}
                className="p-2 sm:p-2.5 rounded-2xl border border-white/10 hover:border-[#39FF14]/20 bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-all relative cursor-pointer"
              >
                {isGuest ? <Lock className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                {!isGuest && unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 px-0.5 items-center justify-center rounded-full bg-[#39FF14] text-black text-[9px] font-black">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {!isGuest && <NotificationCenter isOpen={notifOpen} onClose={() => setNotifOpen(false)} />}
            </div>

            {/* Profile circular menu — locked for guests */}
            {user && !isGuest ? (
              <button
                id="header-profile-menu-avatar"
                aria-label={`Open account settings for ${user.name}`}
                onClick={() => setCurrentView("profile")}
                className="rounded-full border border-white/15 overflow-hidden cursor-pointer hover:border-[#39FF14] transition-colors"
              >
                <AvatarRenderer value={user.avatar} size={36} initials={user.name?.[0]?.toUpperCase() || "C"} />
              </button>
            ) : (
              <button
                id="header-login-btn"
                onClick={() => requireSignInPrompt()}
                title="Sign in to access your profile"
                className="text-[10px] sm:text-xs px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 bg-[#39FF14] hover:bg-[#31dd11] text-black font-bold border border-[#39FF14]/30"
              >
                <Lock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}
          </div>
        </header>

        {/* Dynamic Display Rendering Area */}
        <main id="dashboard-main-content" className="flex-1 pb-24 lg:pb-0">

          {/* Player always takes priority — search overlay was blocking playback */}
          {currentView === "player" ? (
            <div className="player-enter">
              <PlayerPage />
            </div>
          ) : searchQuery.trim().length > 1 ? (
            <div id="search-results-panel" className="p-4 lg:p-8 space-y-6 search-panel-enter">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="font-sans font-bold text-xl text-white">
                    Search Results for: <span className="text-[#39FF14]">"{searchQuery}"</span>
                  </h2>
                  {!isSearching && searchResults.length > 0 && (
                    <p className="text-xs text-neutral-500 mt-1">
                      {searchResults.length} titles · movies & TV · scroll for more
                    </p>
                  )}
                </div>
                <button
                  id="clear-search-btn"
                  onClick={() => setSearchQuery("")}
                  className="text-xs text-neutral-500 hover:text-white cursor-pointer"
                >
                  Clear Search
                </button>
              </div>

              {isSearching ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-neutral-400">
                  <div className="w-full max-w-md h-2 rounded-full overflow-hidden search-shimmer" />
                  <span className="text-xs font-mono font-bold tracking-widest text-[#39FF14] uppercase animate-pulse-soft">
                    Searching movies, TV shows & Cinemax catalog…
                  </span>
                </div>
              ) : searchResults.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-0">
                    {searchResults.map((movie, index) => {
                      const cardKey = `${movie.media_type || (isTvShow(movie) ? "tv" : "movie")}:${movie.id}`;
                      const isPreparing = preparingPlayKey === cardKey;
                      return (
                        <div
                          key={cardKey}
                          className="search-card-enter"
                          style={{ animationDelay: `${Math.min(index, 24) * 35}ms` }}
                        >
                          <MovieCard
                            movie={movie}
                            isPreparing={isPreparing}
                            onClick={() => handleMovieClick(movie, true)}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div ref={searchSentinelRef} className="h-8 flex items-center justify-center py-8">
                    {searchLoadingMore && (
                      <span className="text-xs font-mono text-[#39FF14] animate-pulse">Loading more titles…</span>
                    )}
                    {!searchLoadingMore && searchHasMore && (
                      <button
                        type="button"
                        onClick={loadMoreSearch}
                        className="neon-btn text-xs font-bold px-6 py-2.5 rounded-xl uppercase tracking-wide cursor-pointer"
                      >
                        Load more
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-20 text-neutral-500">
                  <p>No results found. Try a different spelling or shorter keywords.</p>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* VIEW: HOME DISCOVERY */}
              {currentView === "home" && (
                <div id="home-view" className="pb-12 space-y-8">
                  {homepageAdsTop.length > 0 && (
                    <div className="px-4 lg:px-8 pt-4 space-y-3">
                      {homepageAdsTop.map((ad) => (
                        <AdBanner key={ad.id} ad={ad} />
                      ))}
                    </div>
                  )}
                  {/* Premium Featured Hero Banner — rotates through featured titles */}
                  <div 
                    id="hero-banner" 
                    className="relative w-full h-[420px] sm:h-[480px] md:h-[560px] lg:h-[640px] flex items-end p-4 sm:p-6 lg:p-12 overflow-hidden bg-[#0a0a0a] rounded-2xl sm:rounded-3xl border border-white/5 shadow-2xl"
                  >
                    {/* Premium ambient glow effects */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                      <div className="absolute top-0 right-0 w-96 h-96 bg-[#39FF14]/5 rounded-full blur-[120px]" />
                      <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/3 rounded-full blur-[100px]" />
                    </div>

                    {/* Premium Backdrop */}
                    <img 
                      id="hero-backdrop"
                      key={heroMovie.id}
                      src={heroMovie.id === SUPERGIRL_HERO.id ? HERO_FALLBACK_BACKDROP : getImageUrl(heroMovie.backdrop_path, "original")}
                      alt={`${heroMovie.title || heroMovie.name} Hero Background`}
                      className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 scale-105"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/70 via-[#0a0a0a]/30 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/90 via-[#0a0a0a]/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent" />

                    {/* Premium rotation progress dots */}
                    {heroMovies.length > 1 && (
                      <div className="absolute top-6 right-6 lg:right-12 z-20 flex items-center gap-2 bg-black/30 backdrop-blur-md rounded-full px-4 py-2 border border-white/10">
                        {heroMovies.map((_, i) => (
                          <span
                            key={i}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              i === heroIndex % heroMovies.length ? "w-8 bg-[#39FF14] shadow-[0_0_10px_rgba(57,255,20,0.8)]" : "w-1.5 bg-white/25 hover:bg-white/40"
                            }`}
                          />
                        ))}
                      </div>
                    )}

                    {/* Premium Meta/Descriptions */}
                    <div key={`meta-${heroMovie.id}`} className="relative max-w-3xl space-y-5 z-20 animate-fade-in">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="relative px-3 py-1.5 rounded-full bg-gradient-to-r from-[#39FF14] to-[#31dd11] text-black text-[10px] font-extrabold uppercase tracking-widest shadow-[0_4px_15px_rgba(57,255,20,0.4)]">
                          Trending Now
                        </span>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                          <Star className="h-3.5 w-3.5 fill-amber-400" />
                          <span className="text-xs font-bold">{heroMovie.vote_average != null ? heroMovie.vote_average.toFixed(1) : "N/A"}</span>
                        </div>
                        {(heroMovie.release_date || heroMovie.first_air_date) && (
                          <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-neutral-300 text-xs font-semibold">
                            {(heroMovie.release_date || heroMovie.first_air_date || "").slice(0, 4)}
                          </span>
                        )}
                        {heroMovie.runtime && (
                          <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-neutral-300 text-xs font-semibold">
                            {Math.floor(heroMovie.runtime / 60)}h {heroMovie.runtime % 60}m
                          </span>
                        )}
                        <span className={`px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${
                          heroMovie.title ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                        }`}>
                          {heroMovie.title ? "Movie" : "Series"}
                        </span>
                      </div>

                      <h1 className="font-sans text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight uppercase line-clamp-2 drop-shadow-2xl">
                        {heroMovie.title || heroMovie.name}
                      </h1>

                      <p className="text-sm sm:text-base text-neutral-200 leading-relaxed line-clamp-3 max-w-2xl">
                        {heroMovie.overview}
                      </p>

                      <div className="flex items-center gap-3 sm:gap-4 pt-2">
                        <button
                          id="hero-play-btn"
                          onClick={() => handleMovieClick(heroMovie)}
                          className="group relative flex items-center gap-2.5 neon-btn font-extrabold px-6 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl transition-all duration-300 cursor-pointer text-sm sm:text-base shadow-[0_4px_20px_rgba(57,255,20,0.3)] hover:shadow-[0_6px_30px_rgba(57,255,20,0.5)] hover:scale-105"
                        >
                          <Play className="h-5 w-5 sm:h-6 sm:w-6 fill-black ml-0.5" />
                          <span>Play Now</span>
                        </button>
                        <button
                          id="hero-more-info-btn"
                          onClick={() => {
                            setDetailsModalMovie(heroMovie);
                            setDetailsModalOpen(true);
                          }}
                          className="flex items-center gap-2 btn-secondary font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all cursor-pointer text-xs sm:text-sm"
                        >
                          <Info className="h-4 w-4 sm:h-5 sm:w-5" />
                          <span>More Info</span>
                        </button>
                        <button
                          id="hero-watchlist-btn"
                          onClick={() => (user && !isGuest ? addToWatchlist(heroMovie.id) : requireSignInPrompt())}
                          title="Add to My List"
                          aria-label="Add to My List"
                          className="flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 hover:border-white/25 text-white transition-all cursor-pointer"
                        >
                          <ListPlus className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Personalized shelves — driven by the genres picked during
                      onboarding. Placed first, above every admin-curated row,
                      so a user's favorites are the most prominent thing on
                      their homepage. */}
                  {personalizedSections.length > 0 && (
                    <div id="personalized-shelves" className="px-4 lg:px-8 space-y-6 sm:space-y-8 lg:space-y-10">
                      {personalizedSections.map((section) => {
                        const data = homepageSectionData[section.id];
                        if (!data || data.movies.length === 0) return null;
                        return (
                          <React.Fragment key={section.id}>
                            {renderRowShelf(section.label, data.movies, false, data.seeAll)}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}

                  {/* Curated Row shelves — visibility controlled from Admin Panel */}
                  <div id="curated-shelves" className="px-4 lg:px-8 space-y-6 sm:space-y-8 lg:space-y-10">
                    {(siteConfig.homepageSections || [])
                      .filter((s) => s.visible)
                      .map((section, idx) => {
                        const data = homepageSectionData[section.id];
                        if (!data) return null;
                        const shelf = renderRowShelf(section.label, data.movies, data.hasRank, data.seeAll);
                        if (!shelf) return null;
                        const showMidAds = idx === 1 && homepageAdsMid.length > 0;
                        return (
                          <React.Fragment key={section.id}>
                            {shelf}
                            {showMidAds && (
                              <div className="space-y-3">
                                {homepageAdsMid.map((ad) => (
                                  <AdBanner key={ad.id} ad={ad} />
                                ))}
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                  </div>

                  {/* Up Next + Live Chat */}
<div id="home-up-next-section" className="px-4 lg:px-8 space-y-8 pt-4">
                    <section className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="font-sans font-bold text-xl lg:text-2xl tracking-tight">{t("upNext")}</h2>
                        <div className="flex items-center gap-3">
                          <CardSizeSelector />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{t("trendingNow")}</span>
                        </div>
                      </div>
                      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                        {(trendingMovies.length > 0 ? trendingMovies : popularMovies).slice(0, 12).map((movie) => (
<MovieCard key={movie.id} movie={movie} onClick={() => handleMovieClick(movie)} />
                        ))}
                      </div>
                    </section>

                    <section id="home-live-chat" className="max-w-3xl">
                      <LiveChat variant="home" />
                    </section>
                  </div>
                </div>
              )}

              {/* VIEW: MOVIES GRID */}
              {currentView === "movies" && (
                <MoviesPage
                  key={`movies-${String(activeGenre)}`}
                  onMovieClick={handleMovieClick}
                  initialGenre={activeGenre}
                  initialGenreLabel={activeGenreName}
                />
              )}

              {/* VIEW: TV SHOWS GRID */}
              {currentView === "tv" && <TVShowsPage onShowClick={handleMovieClick} />}

              {/* VIEW: MY LIST / WATCHLIST */}
              {currentView === "mylist" && (
                <div id="mylist-view" className="p-4 lg:p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ListPlus className="h-5 w-5 text-[#22c55e]" />
                      <h2 className="font-sans font-bold text-xl text-white">My List — Saved for Later</h2>
                    </div>
                    <CardSizeSelector />
                  </div>
                  {isGuest ? renderGuestLock("My List") : getMyListMovies().length > 0 ? (
                    <div className="flex flex-wrap gap-4">
                      {getMyListMovies().map(movie => (
                        <MovieCard key={movie.id} movie={movie} onClick={() => handleMovieClick(movie)} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-24 text-neutral-500 space-y-3">
                      <ListPlus className="h-12 w-12 text-neutral-700 mx-auto" />
                      <h3 className="font-sans font-bold text-lg text-neutral-400">My List is Empty</h3>
                      <p className="text-xs max-w-sm mx-auto">Save titles you want to watch later from any movie card or player page.</p>
                    </div>
                  )}
                </div>
              )}

              {currentView === "watchlist" && (
                <div id="watchlist-view" className="p-4 lg:p-8 space-y-6">
                  <div className="flex items-center gap-2">
                    <Bookmark className="h-5 w-5 text-[#22c55e]" />
                    <h2 className="font-sans font-bold text-xl text-white">Watchlist — Continue Watching</h2>
                  </div>
                  {isGuest ? renderGuestLock("your watchlist") : getContinueWatchingMovies().length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {getContinueWatchingMovies().map(movie => (
                        <div
                          key={movie.id}
                          onClick={() => handleMovieClick(movie)}
                          className="flex gap-4 p-4 rounded-3xl solid-card hover:border-[#22c55e]/30 transition-all cursor-pointer"
                        >
                          <img src={getImageUrl(movie.poster_path)} alt={movie.title || movie.name} className="h-24 w-20 rounded-xl object-cover" referrerPolicy="no-referrer" />
                          <div className="flex-1">
                            <h4 className="font-bold text-sm text-white">{movie.title || movie.name}</h4>
                            <p className="text-[10px] text-neutral-500 mt-1">Resume at {movie._progress}%</p>
                            <div className="w-full bg-neutral-900 h-1 rounded-full mt-2">
                              <div className="bg-[#22c55e] h-full rounded-full" style={{ width: `${movie._progress || 0}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-24 text-neutral-500 space-y-3">
                      <Bookmark className="h-12 w-12 text-neutral-700 mx-auto" />
                      <h3 className="font-sans font-bold text-lg text-neutral-400">Nothing in Progress</h3>
                      <p className="text-xs max-w-sm mx-auto">Start watching a movie or series — it will appear here so you can resume where you left off.</p>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW: HISTORY */}
              {currentView === "history" && (
                <div id="history-view" className="p-4 lg:p-8 space-y-6">
                  <div className="flex items-center gap-2">
                    <HistoryIcon className="h-5 w-5 text-[#39FF14]" />
                    <h2 className="font-sans font-bold text-xl text-white">
                      Continue Watching History
                    </h2>
                  </div>

                  {user && user.watchHistory && user.watchHistory.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {user.watchHistory.map((hist, idx) => (
                        <div 
                          key={idx} 
                          onClick={async () => {
                            const fullMovie = hist.type === "movie" 
                              ? await tmdb.getMovieDetails(hist.id)
                              : await tmdb.getTVDetails(hist.id);
                            setSelectedMovie(fullMovie);
                            setPlayerMode("full");
                            setCurrentView("player");
                          }}
                          className="flex gap-4 p-4 rounded-3xl glass-card hover:border-[#39FF14]/30 transition-all cursor-pointer group"
                        >
                          <img 
                            src={getImageUrl(hist.poster)} 
                            alt={hist.title}
                            className="h-24 w-20 rounded-xl object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="flex-1 flex flex-col justify-between py-1">
                            <div>
                              <div className="flex items-center justify-between">
                                <h4 className="font-sans font-bold text-sm text-white group-hover:text-[#39FF14] transition-colors">
                                  {hist.title}
                                </h4>
                                <span className="text-[10px] text-neutral-500 font-extrabold uppercase">
                                  {hist.type === "movie" ? "Movie" : "TV Series"}
                                </span>
                              </div>
                              <p className="text-[10px] text-neutral-600 font-mono mt-1">
                                Last Streamed: {new Date(hist.watchedAt).toLocaleDateString()}
                              </p>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[10px] text-neutral-400 font-medium">
                                <span>Progress: {hist.progress}%</span>
                                <span>{Math.round((hist.progress / 100) * hist.duration)}m watched</span>
                              </div>
                              <div className="w-full bg-[#1a1d23] h-1 rounded-full overflow-hidden">
                                <div className="bg-[#39FF14] h-full rounded-full" style={{ width: `${hist.progress}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-24 text-neutral-500 space-y-3">
                      <HistoryIcon className="h-12 w-12 text-neutral-700 mx-auto" />
                      <h3 className="font-sans font-bold text-lg text-neutral-400">No History Saved</h3>
                      <p className="text-xs max-w-sm mx-auto">Start streaming your favorite titles, and we will track your progress right here!</p>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW: FAVORITES */}
              {currentView === "favorites" && (
                <div id="favorites-view" className="p-4 lg:p-8 space-y-6">
                  <div className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-[#39FF14]" />
                    <h2 className="font-sans font-bold text-xl text-white">
                      My Favorites Collection
                    </h2>
                  </div>

                  {isGuest ? renderGuestLock("your favorites") : user && user.favorites && user.favorites.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                      {[...trendingMovies, ...popularMovies, ...topRated]
                        .filter(m => user.favorites.includes(m.id))
                        .map(movie => (
                          <MovieCard key={movie.id} movie={movie} onClick={() => handleMovieClick(movie)} />
                        ))
                      }
                    </div>
                  ) : (
                    <div className="text-center py-24 text-neutral-500 space-y-3">
                      <Heart className="h-12 w-12 text-neutral-700 mx-auto" />
                      <h3 className="font-sans font-bold text-lg text-neutral-400">Favorites empty</h3>
                      <p className="text-xs max-w-sm mx-auto">Add items to your favorites within the streaming player details tab!</p>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW: DOWNLOADS */}
              {currentView === "downloads" && <DownloadsPage />}

              {/* VIEW: GENS - Age-restricted romance/mature content */}
              {currentView === "gens" && <GensPage onMovieClick={handleMovieClick} />}

              {/* VIEW: SHORTS — vertical autoplay trailer feed */}
              {currentView === "shorts" && (
                <div id="shorts-view" className="lg:p-4">
                  <ShortsPage onWatch={handleMovieClick} />
                </div>
              )}

              {/* VIEW: PREMIUM PLAYER (FULL / TRAILER) */}
              {/* VIEW: PREMIUM PLAYER (FULL / TRAILER) — rendered at main level when active */}

              {/* VIEW: PROFILE */}
              {currentView === "profile" && <ProfilePage />}
              {currentView === "help" && <HelpDeskPage />}
              {currentView === "about" && <AboutPage />}
              {currentView === "admin" && <AdminRedirect />}

            </>
          )}

        </main>


        {currentView !== "player" && currentView !== "shorts" && currentView !== "help" && currentView !== "about" && <Footer />}
      </div>

      {/* POPUP WATCH DECIDER MODAL */}
      <WatchChoiceModal
        movie={modalTargetMovie}
        isOpen={choiceModalOpen}
        onClose={() => setChoiceModalOpen(false)}
        onChoose={handleChoiceSelected}
      />

      {/* REGISTRATION / LOGIN AUTH DIALOG */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={closeAuthModal}
        defaultMode={authModalMode}
        initialStep={authModalInitialStep}
        initialEmail={authModalPrefillEmail}
      />

      {/* FLOATING PICTURE IN PICTURE STREAMING CONTAINER */}
      <PipPlayer />

      {/* AI ASSISTANT — available on every page, not just Home. Only ever
          appears via its own floating "Ask AI" launcher button; it stays
          fully closed/hidden otherwise. */}
      <HomeAIAssistant 
        onSelectMovie={handleMovieClick} 
        onNavigate={setCurrentView}
        onSearch={setSearchQuery}
      />

      {/* MOVIE DETAILS MODAL — powers the Hero's "More Info" button with a
          full detail view, distinct from "Play Now" which jumps straight
          into playback. */}
      <MovieDetailsModal
        movie={detailsModalMovie}
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        onPlay={(m) => {
          setDetailsModalOpen(false);
          handleMovieClick(m);
        }}
        onWatchTrailer={(m) => {
          setDetailsModalOpen(false);
          handleMovieClick(m);
          setSelectedMovie(m);
          setPlayerMode("trailer");
          setCurrentView("player");
        }}
        onAddToWatchlist={(m) => {
          addToWatchlist(m.id);
        }}
      />

      <AdminDestinationModal
        isOpen={adminDestinationOpen}
        onAdmin={goToAdminPanel}
        onWebsite={dismissAdminToWebsite}
      />

      {currentView !== "player" && <MobileBottomNav />}
      </Suspense>
    </div>
  );
};

const OnboardingGate: React.FC = () => {
  const { needsOnboarding, completeOnboarding, dismissOnboarding } = useApp();
  return (
    <Suspense fallback={null}>
      <OnboardingPreferences
        isOpen={needsOnboarding}
        onComplete={async (preferences) => {
          await completeOnboarding(preferences);
        }}
        onSkip={dismissOnboarding}
      />
    </Suspense>
  );
};

export default function App() {
  return (
    <ErrorBoundary label="App">
      <AppProvider>
        <ErrorBoundary label="CinemaxDashboard">
          <CinemaxDashboard />
        </ErrorBoundary>
        <ErrorBoundary label="OnboardingGate">
          <OnboardingGate />
        </ErrorBoundary>
      </AppProvider>
    </ErrorBoundary>
  );
}
