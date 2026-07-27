import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { Plus, X, Home, Tv, Clapperboard, SlidersHorizontal, Sparkles, Bot } from "lucide-react";

/**
 * Mobile-only bottom navigation. Starts collapsed to a single floating "+"
 * button so it stays out of the way of content; tapping it slides the full
 * bar up into view. A second tap (the button morphs into an "×") slides it
 * back down. This is deliberately separate from <Sidebar> — that's the
 * full drawer menu behind the hamburger icon; this is a lightweight,
 * always-reachable strip for the handful of things people jump to most.
 */
export const MobileBottomNav: React.FC = () => {
  const { currentView, setCurrentView, activeGenre, setActiveGenre, setActiveGenreName, t } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const quickFilters: Array<{ id: number | string; label: string }> = [
    { id: "trending", label: "Trend Now" },
    { id: "top_rated", label: "Top Rated" },
    { id: "popular", label: "Popular" },
    { id: "now_playing", label: "New Release" },
    { id: "upcoming", label: "Upcoming" },
    { id: 28, label: "Action" },
    { id: 35, label: "Comedy" },
    { id: 27, label: "Horror" },
    { id: 10749, label: "Romance" },
    { id: 878, label: "Sci-Fi" },
    { id: 16, label: "Animation" },
    { id: 53, label: "Thriller" },
  ];

  const goTo = (viewId: string) => {
    setActiveGenre(null);
    setActiveGenreName(null);
    setCurrentView(viewId);
    setFilterOpen(false);
  };

  const pickFilter = (id: number | string, label: string) => {
    setActiveGenre(id);
    setActiveGenreName(label);
    setCurrentView("movies");
    setFilterOpen(false);
  };

  const navItems = [
    { id: "home", label: "Home", icon: Home, onClick: () => goTo("home") },
    { id: "tv", label: "TV Show", icon: Tv, onClick: () => goTo("tv") },
    { id: "shorts", label: "Shorts", icon: Clapperboard, onClick: () => goTo("shorts") },
    {
      id: "filter",
      label: "Filter",
      icon: SlidersHorizontal,
      onClick: () => setFilterOpen((v) => !v),
    },
    { id: "gens", label: "Gens", icon: Bot, onClick: () => goTo("gens") },
  ];

  const isItemActive = (id: string) => {
    if (id === "filter") return filterOpen || (currentView === "movies" && activeGenre !== null);
    return currentView === id && activeGenre === null;
  };

  return (
    <div className="mobile-bottom-nav-root lg:hidden">
      {/* Filter quick-picker — slides up above the bar when Filter is tapped */}
      <div className={`mobile-filter-sheet ${filterOpen ? "mobile-filter-sheet--open" : ""}`}>
        <div className="mobile-filter-sheet-inner">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase">{t ? t("categories") : "Browse by"}</span>
            <button
              aria-label="Close filters"
              onClick={() => setFilterOpen(false)}
              className="text-neutral-500 hover:text-white p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mobile-filter-chip-grid">
            {quickFilters.map((f) => (
              <button
                key={f.id}
                onClick={() => pickFilter(f.id, f.label)}
                className={`mobile-filter-chip ${activeGenre === f.id ? "mobile-filter-chip--active" : ""}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* The bar itself */}
      <nav className={`mobile-bottom-bar ${expanded ? "mobile-bottom-bar--expanded" : "mobile-bottom-bar--collapsed"}`}>
        {navItems.map((item, i) => {
          const Icon = item.icon;
          const active = isItemActive(item.id);
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              style={{ transitionDelay: expanded ? `${i * 35}ms` : "0ms" }}
              className={`mobile-bottom-bar-item ${active ? "mobile-bottom-bar-item--active" : ""}`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Floating +/× toggle — collapses/reveals the bar above */}
      <button
        aria-label={expanded ? "Hide quick navigation" : "Show quick navigation"}
        onClick={() => {
          setExpanded((v) => !v);
          if (expanded) setFilterOpen(false);
        }}
        className={`mobile-fab ${expanded ? "mobile-fab--expanded" : ""}`}
      >
        {expanded ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
      </button>

      <style>{`
        .mobile-bottom-nav-root {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 45;
          display: flex;
          justify-content: center;
          pointer-events: none;
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }

        .mobile-bottom-bar {
          pointer-events: auto;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-around;
          width: calc(100% - 24px);
          max-width: 480px;
          margin: 0 12px 14px;
          border-radius: 20px;
          background: rgba(10, 10, 10, 0.92);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
          overflow: hidden;
          transition: max-height 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease, transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .mobile-bottom-bar--collapsed {
          max-height: 0;
          padding: 0 8px;
          opacity: 0;
          transform: translateY(16px) scale(0.96);
          border-width: 0;
          box-shadow: none;
        }

        .mobile-bottom-bar--expanded {
          max-height: 90px;
          padding: 10px 6px;
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        .mobile-bottom-bar-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          flex: 1;
          padding: 6px 2px;
          border-radius: 12px;
          color: rgba(163, 163, 163, 1);
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
          background: transparent;
          border: none;
          opacity: 0;
          transform: translateY(10px);
          transition: opacity 0.35s ease, transform 0.35s ease, color 0.2s ease;
        }

        .mobile-bottom-bar--expanded .mobile-bottom-bar-item {
          opacity: 1;
          transform: translateY(0);
        }

        .mobile-bottom-bar-item:active {
          background: rgba(255, 255, 255, 0.06);
        }

        .mobile-bottom-bar-item--active {
          color: #39FF14;
        }

        .mobile-fab {
          pointer-events: auto;
          position: absolute;
          bottom: 14px;
          left: 50%;
          transform: translateX(-50%);
          width: 46px;
          height: 46px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(145deg, #39FF14, #2ed011);
          color: #000;
          border: none;
          cursor: pointer;
          box-shadow: 0 6px 24px rgba(57, 255, 20, 0.45), 0 0 0 4px rgba(10, 10, 10, 0.92);
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s ease;
          z-index: 2;
        }

        .mobile-bottom-bar--expanded ~ .mobile-fab,
        .mobile-fab--expanded {
          transform: translateX(-50%) translateY(-75px) rotate(90deg);
        }

        .mobile-fab:active {
          transform: translateX(-50%) scale(0.92);
        }

        .mobile-bottom-bar--expanded ~ .mobile-fab:active,
        .mobile-fab--expanded:active {
          transform: translateX(-50%) translateY(-75px) rotate(90deg) scale(0.92);
        }

        /* Filter quick-picker sheet */
        .mobile-filter-sheet {
          pointer-events: none;
          position: absolute;
          bottom: 100px;
          left: 12px;
          right: 12px;
          max-width: 480px;
          margin: 0 auto;
          max-height: 0;
          opacity: 0;
          transform: translateY(16px);
          transition: max-height 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
          border-radius: 18px;
        }

        .mobile-filter-sheet--open {
          pointer-events: auto;
          max-height: 260px;
          opacity: 1;
          transform: translateY(0);
        }

        .mobile-filter-sheet-inner {
          background: rgba(10, 10, 10, 0.96);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
          padding: 14px;
        }

        .mobile-filter-chip-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          max-height: 180px;
          overflow-y: auto;
        }

        .mobile-filter-chip {
          padding: 7px 14px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          color: #d4d4d4;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .mobile-filter-chip--active {
          color: #000;
          background: #39FF14;
          border-color: #39FF14;
        }
      `}</style>
    </div>
  );
};
