import React, { useState, useEffect, useMemo } from "react";
import { Power, PowerOff } from "lucide-react";

// TMDB API Constants
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
const API_KEY = "8e887749d8a5b7a31b807aadd903d25a";

// Define the structure for a TMDB TV Series object with comprehensive data
interface TMDBTVShow {
  id: number;
  name: string;
  backdrop_path: string;
  poster_path: string;
  overview: string;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  original_language: string;
  popularity: number;
}

export const HeroTV: React.FC = () => {
  const [tvShows, setTvShows] = useState<TMDBTVShow[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isTVOn, setIsTVOn] = useState(true);
  // Tracks which backdrop size to use for the *currently shown* show only.
  // Keyed by show id so a late-arriving error for a show we've already
  // rotated away from can never bleed onto the new show's image.
  const [backdropSize, setBackdropSize] = useState<"original" | "w1280">("original");

  // Fallback data if API fails with comprehensive show information - using known working TMDB paths
  const fallbackShows: TMDBTVShow[] = [
    {
      id: 1,
      name: "Breaking Bad",
      backdrop_path: "/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
      poster_path: "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
      overview: "A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine in order to secure his family's future.",
      first_air_date: "2008-01-20",
      vote_average: 9.5,
      vote_count: 15000,
      genre_ids: [18, 80],
      original_language: "en",
      popularity: 450.5
    },
    {
      id: 2,
      name: "Game of Thrones",
      backdrop_path: "/suopoADq0k8YZr4dQXcU6pToj6s.jpg",
      poster_path: "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg",
      overview: "Seven noble families fight for control of the mythical land of Westeros. Friction between the houses leads to full-scale war.",
      first_air_date: "2011-04-17",
      vote_average: 8.4,
      vote_count: 23000,
      genre_ids: [10765, 18],
      original_language: "en",
      popularity: 380.3
    },
    {
      id: 3,
      name: "Stranger Things",
      backdrop_path: "/56v2KjBlU4XaOv9rVYEQypROD7P.jpg",
      poster_path: "/49WJfeN0moxb9IPfGn8AIqMGskD.jpg",
      overview: "When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.",
      first_air_date: "2016-07-15",
      vote_average: 8.7,
      vote_count: 18000,
      genre_ids: [18, 10765],
      original_language: "en",
      popularity: 420.7
    }
  ];

  const displayShows = tvShows.length > 0 ? tvShows : fallbackShows;

  // Fetch trending or popular TV shows directly from TMDB API on component mount with comprehensive data
  useEffect(() => {
    let cancelled = false;

    const fetchTVShows = async () => {
      try {
        const pages = [1, 2, 3];
        const allShows: TMDBTVShow[] = [];

        for (const page of pages) {
          const response = await fetch(
            `${BASE_URL}/tv/popular?api_key=${API_KEY}&language=en-US&page=${page}`
          );
          const data = await response.json();

          if (data.results) {
            allShows.push(...data.results);
          }
        }

        // Filter out any series that do not contain a valid backdrop image path,
        // and de-duplicate by id (TMDB pages can overlap).
        const seen = new Set<number>();
        const filteredShows = allShows.filter((show: TMDBTVShow) => {
          if (!show.backdrop_path || !show.overview) return false;
          if (seen.has(show.id)) return false;
          seen.add(show.id);
          return true;
        });

        if (!cancelled) {
          setTvShows(filteredShows);
          setLoading(false);
        }
      } catch (error) {
        console.error("HeroTV: Failed fetching series data from TMDB API:", error);
        if (!cancelled) setLoading(false);
      }
    };

    fetchTVShows();
    return () => {
      cancelled = true;
    };
  }, []);

  // Whenever the list of shows we're actually displaying changes shape
  // (e.g. fallback -> fetched data), make sure currentIndex still points
  // at a valid entry instead of relying on it staying in range by luck.
  useEffect(() => {
    if (currentIndex >= displayShows.length) {
      setCurrentIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayShows.length]);

  // Handle the automatic widescreen backdrop image rotations — slowed down
  // to give people enough time to actually read the overlay info before the
  // next title rotates in.
  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % displayShows.length);
        setIsTransitioning(false);
      }, 800); // Matches the .hero-screen-content fade transition duration below
    }, 7000); // 7 seconds per image — was 2s, far too quick to read the info panel

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayShows.length]);

  // Always resolve against a safe, in-range index so image + text can
  // never point at two different array positions.
  const safeIndex = displayShows.length > 0 ? currentIndex % displayShows.length : 0;
  const currentShow = displayShows[safeIndex];

  // Reset the backdrop size preference every time the show actually changes,
  // so a fallback triggered by a previous show can't carry over to this one.
  useEffect(() => {
    setBackdropSize("original");
  }, [currentShow?.id]);

  const backdropUrl = useMemo(() => {
    if (!currentShow) return "";
    return `${IMAGE_BASE_URL}/${backdropSize}${currentShow.backdrop_path}`;
  }, [currentShow, backdropSize]);

  if (!currentShow) {
    return null;
  }

  return (
    <div className="hero-tv-container">
      <div className="hero-tv-wrapper">
        {/* TV Screen Frame with Ultra-Thin Metallic Black Bezel */}
        <div className="hero-tv-frame">
          {/* Neon Green LED Backlight Glow */}
          <div className="hero-tv-backlight" />

          <div className="hero-tv-inner-bezel">
            <div className="hero-tv-screen relative">
              {/* TV Header Interface */}
              <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
                {/* Cinemax Logo */}
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg logo-mark font-black text-lg flex items-center justify-center">
                    C
                  </div>
                  <span className="text-white font-bold text-sm tracking-wider">CINEMAX</span>
                </div>
                
                {/* Power Button */}
                <button
                  onClick={() => setIsTVOn(!isTVOn)}
                  className="flex items-center gap-2 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 text-white font-semibold transition-all cursor-pointer group"
                  title={isTVOn ? "Turn TV Off" : "Turn TV On"}
                >
                  {isTVOn ? (
                    <>
                      <PowerOff className="h-4 w-4 text-rose-400" />
                      <span className="text-xs">Off</span>
                    </>
                  ) : (
                    <>
                      <Power className="h-4 w-4 text-[#39FF14]" />
                      <span className="text-xs">On</span>
                    </>
                  )}
                </button>
              </div>
              
              <div className={`hero-screen-content ${isTransitioning ? "fade" : ""} ${!isTVOn ? "opacity-0" : ""}`}>
                {/* key={currentShow.id} forces React to remount the <img> on every
                    rotation, which guarantees any onError fallback state (and the
                    browser's in-flight request for the old image) can never be
                    applied to the new show. This is what keeps image + text in sync. */}
                <img
                  key={currentShow.id}
                  src={backdropUrl}
                  alt={currentShow.name || "Trending TV Series"}
                  className="hero-backdrop-img"
                  loading="eager"
                  onError={() => {
                    // Only step down in size; never touch the DOM node directly.
                    setBackdropSize((size) => (size === "original" ? "w1280" : size));
                  }}
                />
              </div>

              {/* Blank Screen Overlay when TV is Off */}
              {!isTVOn && (
                <div className="absolute inset-0 bg-black z-10">
                </div>
              )}

              {/* Show Information Overlay */}
              <div className="hero-show-info" key={currentShow.id}>
                <div className="hero-info-content">
                  <h2 className="hero-show-title">{currentShow.name || "Loading..."}</h2>
                  <div className="hero-show-meta">
                    <span className="hero-year">{currentShow.first_air_date?.slice(0, 4) || "N/A"}</span>
                    <span className="hero-rating">⭐ {currentShow.vote_average?.toFixed(1) || "N/A"}</span>
                    <span className="hero-language">{currentShow.original_language?.toUpperCase() || "N/A"}</span>
                  </div>
                  <p className="hero-show-overview">
                    {currentShow.overview?.slice(0, 150) || "Loading show information..."}
                    {currentShow.overview && currentShow.overview.length > 150 ? "..." : ""}
                  </p>
                  <div className="hero-show-stats">
                    <span className="hero-stat-item">
                      <span className="hero-stat-label">Popularity</span>
                      <span className="hero-stat-value">{currentShow.popularity?.toFixed(1) || "N/A"}</span>
                    </span>
                    <span className="hero-stat-item">
                      <span className="hero-stat-label">Votes</span>
                      <span className="hero-stat-value">{currentShow.vote_count?.toLocaleString() || "N/A"}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Glossy cinematic glass panel shine reflection */}
              <div className="hero-screen-glare-reflection" />
            </div>
          </div>
        </div>

        {/* Thick, Bold, Chunky Outward-Flaring Neon Green Stand Legs */}
        <div className="hero-tv-legs-mount">
          {/* Left TV Leg - Extra Wide Thick Footing */}
          <div className="tv-hardware-leg left-leg">
            <div className="leg-vertical-stem" />
            <div className="leg-angled-foot-base" />
          </div>
          {/* Right TV Leg - Extra Wide Thick Footing */}
          <div className="tv-hardware-leg right-leg">
            <div className="leg-vertical-stem" />
            <div className="leg-angled-foot-base" />
          </div>
        </div>

        {/* Ambient Glowing Smile Light Reflex Under TV */}
        <div className="tv-green-smile-glow" />
      </div>

      <style>{`
        .hero-tv-container {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 2rem 1rem;
          background: transparent;
          box-sizing: border-box;
        }

        .hero-tv-wrapper {
          position: relative;
          width: 100%;
          max-width: 900px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        /* TV Frame with Ultra-Thin Metallic Black Bezel */
        .hero-tv-frame {
          position: relative;
          width: 100%;
          background: linear-gradient(145deg, #0a0a0a 0%, #000000 100%);
          border-radius: 8px;
          padding: 4px;
          box-sizing: border-box;
          z-index: 2;
        }

        /* Neon Green LED Backlight Glow - Radiating from sides and behind */
        .hero-tv-backlight {
          position: absolute;
          inset: -20px;
          background: radial-gradient(ellipse at center, rgba(57, 255, 20, 0.15) 0%, transparent 70%);
          border-radius: 16px;
          filter: blur(20px);
          z-index: -1;
          pointer-events: none;
        }

        .hero-tv-backlight::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(57, 255, 20, 0.3) 0%, transparent 15%, transparent 85%, rgba(57, 255, 20, 0.3) 100%),
            linear-gradient(180deg, rgba(57, 255, 20, 0.2) 0%, transparent 20%, transparent 80%, rgba(57, 255, 20, 0.2) 100%);
          border-radius: 16px;
          filter: blur(15px);
        }

        /* Ultra-thin metallic black inner bezel with 16:9 cinema aspect ratio */
        .hero-tv-inner-bezel {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          background: #000000;
          overflow: hidden;
          border: 2px solid #1a1a1a;
          box-shadow:
            inset 0 0 20px rgba(0, 0, 0, 0.8),
            0 0 0 1px rgba(255, 255, 255, 0.05);
        }

        @media (max-width: 768px) {
          .hero-tv-inner-bezel {
            aspect-ratio: 16 / 9;
          }
        }

        .hero-tv-screen {
          position: relative;
          width: 100%;
          height: 100%;
          background: #000;
        }

        .hero-screen-content {
          width: 100%;
          height: 100%;
          opacity: 1;
          transition: opacity 0.8s ease-in-out;
        }

        .hero-screen-content.fade {
          opacity: 0;
        }

        .hero-backdrop-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center center;
          min-height: 300px;
          background: #1a1a1a;
        }

        .hero-screen-glare-reflection {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.04) 0%,
            transparent 40%
          );
          pointer-events: none;
        }

        /* Show Information Overlay */
        .hero-show-info {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 4.5rem 2rem 2rem;
          background: linear-gradient(
            to top,
            rgba(0, 0, 0, 0.96) 0%,
            rgba(0, 0, 0, 0.9) 35%,
            rgba(0, 0, 0, 0.65) 70%,
            rgba(0, 0, 0, 0.25) 100%
          );
          pointer-events: none;
          z-index: 10;
        }

        .hero-info-content {
          max-width: 600px;
        }

        .hero-show-title {
          font-size: 1.8rem;
          font-weight: 800;
          color: #fff;
          margin: 0 0 0.75rem 0;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.95), 0 1px 3px rgba(0, 0, 0, 1), 0 0 24px rgba(0, 0, 0, 0.6);
          line-height: 1.2;
        }

        .hero-show-meta {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 0.75rem;
        }

        .hero-year,
        .hero-rating,
        .hero-language {
          font-size: 0.85rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
          text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
        }

        .hero-rating {
          color: #fbbf24;
        }

        .hero-show-overview {
          font-size: 0.95rem;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.85);
          line-height: 1.5;
          margin: 0 0 1rem 0;
          text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .hero-show-stats {
          display: flex;
          gap: 1.5rem;
        }

        .hero-stat-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .hero-stat-label {
          font-size: 0.7rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.6);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .hero-stat-value {
          font-size: 0.9rem;
          font-weight: 700;
          color: #39FF14;
          text-shadow: 0 0 8px rgba(57, 255, 20, 0.4);
        }

        /* Stance layout for the dual support stands positioned out near the frame margins */
        .hero-tv-legs-mount {
          width: 90%;
          display: flex;
          justify-content: space-between;
          position: relative;
          height: 50px;
          margin-top: -2px;
          pointer-events: none;
          z-index: 1;
        }

        .tv-hardware-leg {
          position: relative;
          width: 80px;
          height: 100%;
        }

        /* Vertical stem connecting to TV frame */
        .leg-vertical-stem {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 12px;
          height: 20px;
          background: linear-gradient(180deg, #39FF14 0%, #2ed011 100%);
          box-shadow:
            0 0 15px #39FF14,
            0 0 30px rgba(57, 255, 20, 0.6);
          border-radius: 2px;
        }

        /* Thick, bold, chunky outward-flaring neon green leg (Left Stand) */
        .left-leg .leg-angled-foot-base {
          position: absolute;
          top: 18px;
          left: 50%;
          transform: translateX(-50%) rotate(25deg);
          transform-origin: top center;
          width: 24px;
          height: 40px;
          background: linear-gradient(180deg, #39FF14 0%, #2ed011 100%);
          box-shadow:
            0 0 25px #39FF14,
            0 0 50px rgba(57, 255, 20, 0.8),
            -4px 8px 15px rgba(0, 0, 0, 0.7);
          border-radius: 6px;
        }

        /* Thick, bold, chunky outward-flaring neon green leg (Right Stand) */
        .right-leg .leg-angled-foot-base {
          position: absolute;
          top: 18px;
          left: 50%;
          transform: translateX(-50%) rotate(-25deg);
          transform-origin: top center;
          width: 24px;
          height: 40px;
          background: linear-gradient(180deg, #39FF14 0%, #2ed011 100%);
          box-shadow:
            0 0 25px #39FF14,
            0 0 50px rgba(57, 255, 20, 0.8),
            4px 8px 15px rgba(0, 0, 0, 0.7);
          border-radius: 6px;
        }

        /* Ambient glowing smile light reflex under TV */
        .tv-green-smile-glow {
          position: absolute;
          bottom: -35px;
          width: 80%;
          height: 25px;
          background: radial-gradient(ellipse at center, rgba(57, 255, 20, 0.5) 0%, rgba(57, 255, 20, 0.15) 40%, transparent 70%);
          border-radius: 50%;
          filter: blur(10px);
          z-index: 0;
          pointer-events: none;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .hero-tv-wrapper {
            max-width: 100%;
          }

          .hero-tv-frame {
            padding: 3px;
          }

          .hero-tv-legs-mount {
            width: 85%;
            height: 40px;
          }

          .tv-hardware-leg {
            width: 60px;
          }

          .leg-vertical-stem {
            width: 8px;
            height: 15px;
          }

          .left-leg .leg-angled-foot-base,
          .right-leg .leg-angled-foot-base {
            width: 18px;
            height: 30px;
            top: 14px;
          }

          .tv-green-smile-glow {
            bottom: -25px;
            height: 18px;
          }

          .hero-show-info {
            padding: 3.25rem 1.5rem 1.5rem;
          }

          .hero-show-title {
            font-size: 1.4rem;
          }

          .hero-show-overview {
            font-size: 0.85rem;
            -webkit-line-clamp: 2;
          }

          .hero-show-stats {
            gap: 1rem;
          }
        }
      `}</style>
    </div>
  );
};
