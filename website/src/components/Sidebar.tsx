import React, { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { 
  Home, 
  Film, 
  Tv, 
  Clapperboard, 
  ListPlus, 
  Bookmark, 
  History, 
  Heart, 
  Download, 
  Settings, 
  HelpCircle,
  Info,
  Menu,
  ChevronDown,
  LogOut,
  Lock,
  Sun,
  Moon,
  Globe,
  Tag,
  Sparkles,
  Crown,
  Bot,
  MessageSquare,
} from "lucide-react";
import { AvatarRenderer } from "./AnimatedAvatar";
import { InstallAppButton } from "./InstallAppButton";
import { APP_LANGUAGES } from "../i18n/translations";
import { AdBanner } from "./AdBanner";
import { fetchPublicAds, PublicAd } from "../utils/siteConfig";
import { CinemaxLogo } from "./CinemaxLogo";

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, isCollapsed, setIsCollapsed }) => {
  const {
    currentView,
    setCurrentView,
    activeGenre,
    setActiveGenre,
    setActiveGenreName,
    user,
    isGuest,
    requireSignInPrompt,
    openLiveChat,
    setPremiumLiveChatOpen,
    logoutUser,
    openAuthModal,
    theme,
    t,
    appLanguage,
    setAppLanguage,
    siteConfig,
  } = useApp();

  const [sidebarAds, setSidebarAds] = useState<PublicAd[]>([]);
  const [genresExpanded, setGenresExpanded] = useState(false);
  const isPremium = !!user && !isGuest && user.subscription === "Premium";

  useEffect(() => {
    fetchPublicAds().then((ads) => setSidebarAds(ads.filter((a) => a.placement === "sidebar")));
  }, []);

  const pageConfig = siteConfig.contentPages || {};

  const GUEST_LOCKED_VIEWS = new Set(["mylist", "watchlist", "favorites", "profile"]);

  const primaryNavigation = [
    { id: "home", labelKey: "home", icon: Home },
    { id: "movies", labelKey: "movies", icon: Film },
    { id: "tv", labelKey: "tvShows", icon: Tv },
    { id: "shorts", labelKey: "shorts", icon: Clapperboard, badge: "NEW" },
    { id: "live-chat", label: "Live Chat", icon: MessageSquare },
    { id: "mylist", labelKey: "myList", icon: ListPlus },
    { id: "watchlist", labelKey: "watchlist", icon: Bookmark },
    { id: "history", labelKey: "history", icon: History },
    { id: "favorites", labelKey: "favorites", icon: Heart },
    { id: "gens", label: "Gens", icon: Bot, badge: "18+" },
    { id: "download-app", label: "Download App", icon: Download, isAction: true },
  ];

  const visiblePrimaryNav = primaryNavigation.filter((item) => {
    const cfg = pageConfig[item.id];
    return cfg ? cfg.enabled !== false : true;
  });

  const genres = [
    { id: "trending", label: "Trending" },
    { id: "popular", label: "Popular" },
    { id: "top_rated", label: "Top Rated" },
    { id: "upcoming", label: "Upcoming" },
    { id: "now_playing", label: "Now Playing" },
    { id: 28, label: "Action" },
    { id: 12, label: "Adventure" },
    { id: 16, label: "Animation" },
    { id: 35, label: "Comedy" },
    { id: 80, label: "Crime" },
    { id: 99, label: "Documentary" },
    { id: 18, label: "Drama" },
    { id: 10751, label: "Family" },
    { id: 14, label: "Fantasy" },
    { id: 36, label: "History" },
    { id: 27, label: "Horror" },
    { id: 10402, label: "Music" },
    { id: 9648, label: "Mystery" },
    { id: 10749, label: "Romance" },
    { id: 878, label: "Sci-Fi" },
    { id: 53, label: "Thriller" },
    { id: 10752, label: "War" },
    { id: 37, label: "Western" },
    { id: "superhero", label: "Superhero" },
    { id: "anime", label: "Anime" },
    { id: "kids", label: "Kids" },
    { id: "classic", label: "Classic" },
    { id: "award", label: "Award Winners" },
    { id: "latest", label: "Latest Releases" },
  ];

  const handleNavClick = (viewId: string) => {
    if (isGuest && GUEST_LOCKED_VIEWS.has(viewId)) {
      requireSignInPrompt();
      setIsOpen(false);
      return;
    }
    if (viewId === "live-chat") {
      setCurrentView("live-chat");
      setIsOpen(false);
      setIsCollapsed(false);
      return;
    }
    setActiveGenre(null);
    setActiveGenreName(null);
    setCurrentView(viewId);
  };

  const handleLiveChatHover = () => {
    setCurrentView("live-chat");
  };

  const handleGenreClick = (genreId: number | string, label: string) => {
    setActiveGenre(genreId);
    setActiveGenreName(label);
    setCurrentView("movies");
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          id="mobile-backdrop"
          className="fixed inset-0 z-40 bg-[#0a0a0a] lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Hamburger Menu Button (Desktop) */}
      <button
        id="desktop-hamburger-btn"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`fixed top-4 left-4 z-50 p-3 rounded-xl bg-gradient-to-br from-[#0d0e12] to-[#0a0a0a] border border-white/10 text-white hover:border-[#39FF14]/50 hover:text-[#39FF14] transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_rgba(57,255,20,0.3)] hidden lg:flex items-center justify-center gap-2 cursor-pointer ${
          isCollapsed ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Premium Sidebar Container */}
      <aside
        id="sidebar"
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col border-r border-white/10 bg-gradient-to-b from-[#0d0e12] to-[#0a0a0a] text-neutral-400 transition-all duration-300 ease-in-out shadow-2xl ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 ${
          isCollapsed ? "lg:w-16 lg:opacity-90" : "lg:w-56 sm:w-64 lg:opacity-100"
        }`}
        onMouseEnter={() => isCollapsed && setIsCollapsed(false)}
      >
        {/* Premium ambient glow effect */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#39FF14]/3 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/2 rounded-full blur-[80px]" />
        </div>
        {/* Premium Logo Section */}
        <div id="logo-section" className={`relative flex h-16 sm:h-20 items-center border-b border-white/5 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent ${
          isCollapsed ? "justify-center px-4" : "justify-between px-4 sm:px-6"
        }`}>
          <div 
            className={`flex items-center cursor-pointer select-none group ${
              isCollapsed ? "gap-0" : "gap-2 sm:gap-3"
            }`}
            onClick={() => handleNavClick("home")}
          >
            <div className="relative">
              <div className="absolute inset-0 bg-[#39FF14]/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CinemaxLogo compact={isCollapsed} />
            </div>
          </div>
          {!isCollapsed && (
            <button 
              id="close-sidebar-btn"
              aria-label="Close navigation menu"
              className="relative p-2 rounded-xl text-neutral-400 hover:bg-white/10 hover:text-white lg:hidden transition-all duration-300 group"
              onClick={() => setIsOpen(false)}
            >
              <div className="absolute inset-0 bg-[#39FF14]/10 rounded-xl blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <Menu className="h-4 w-4 sm:h-5 sm:w-5 relative z-10" />
            </button>
          )}
          {isCollapsed && (
            <button 
              id="collapse-toggle-btn"
              aria-label="Expand sidebar"
              className="absolute top-1/2 -translate-y-1/2 right-2 p-2 rounded-xl text-neutral-400 hover:bg-white/10 hover:text-white transition-all duration-300 group"
              onClick={() => setIsCollapsed(false)}
            >
              <Menu className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Premium Scrollable Navigation Lists */}
        <div id="nav-scroll-area" className="relative flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6 space-y-6 sm:space-y-8 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
          {/* Main Views - Enhanced */}
          <div id="primary-nav-group" className="space-y-1">
            {visiblePrimaryNav.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id && activeGenre === null;
              const navLabel = pageConfig[item.id]?.label || (item.labelKey ? t(item.labelKey) : item.label);
              const isGens = item.id === "gens";
              const isDownloadApp = (item as any).isAction;
              
              if (isDownloadApp) {
                return (
                  <div key={item.id} className="px-3 sm:px-4">
                    <InstallAppButton variant="sidebar" label="Download App" />
                  </div>
                );
              }
              
              const isLiveChat = item.id === "live-chat";
              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  onClick={() => {
                    handleNavClick(item.id);
                    setIsOpen(false);
                  }}
                  onMouseEnter={isLiveChat ? handleLiveChatHover : undefined}
                  className={`relative flex w-full items-center gap-3 px-3 sm:px-3.5 py-3 sm:py-3.5 rounded-2xl font-sans text-[14px] sm:text-[15px] font-semibold transition-all duration-300 group cursor-pointer overflow-hidden ${
                    isActive
                      ? "bg-gradient-to-r from-[#39FF14]/15 via-[#39FF14]/[0.08] to-transparent text-white shadow-[0_0_20px_rgba(57,255,20,0.15)] border border-[#39FF14]/20"
                      : "text-neutral-300 hover:bg-white/[0.06] hover:text-white border border-transparent"
                  } ${
                    isCollapsed ? "justify-center px-3" : ""
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-[#39FF14] shadow-[0_0_15px_rgba(57,255,20,0.8)]" />
                  )}
                  {isGens ? (
                    <span className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-red-500 shadow-[0_4px_15px_-2px_rgba(236,72,153,0.5)] transition-transform duration-300 group-hover:scale-110">
                      <div className="absolute inset-0 bg-gradient-to-br from-pink-400 to-red-400 rounded-xl blur-md opacity-50" />
                      <Heart className="h-5 w-5 text-white relative z-10" fill="currentColor" />
                    </span>
                  ) : (
                    <span className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${
                      isActive ? "bg-[#39FF14]/20 text-[#39FF14] shadow-[0_0_15px_rgba(57,255,20,0.3)]" : "bg-white/[0.05] text-neutral-400 group-hover:bg-white/[0.1] group-hover:text-white"
                    }`}>
                      <Icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
                    </span>
                  )}
                  {!isCollapsed && (
                    <span className={`flex-1 text-left truncate leading-tight ${isGens ? "bg-gradient-to-r from-pink-400 to-red-400 bg-clip-text font-bold text-transparent" : ""} ${isActive && !isGens ? "text-[#39FF14] font-bold" : ""}`}>{navLabel}</span>
                  )}
                  {isGuest && GUEST_LOCKED_VIEWS.has(item.id) && (
                    <Lock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-neutral-600 flex-shrink-0" />
                  )}
                  {item.badge && (
                    <span className="relative px-2 py-0.5 rounded-md bg-gradient-to-r from-[#39FF14] to-[#31dd11] text-[9px] sm:text-[10px] font-extrabold text-black uppercase tracking-wider shadow-[0_2px_10px_-2px_rgba(57,255,20,0.6)]">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Premium Categories Section */}
          {!isCollapsed && (
            <div id="categories-group" className="space-y-2 sm:space-y-3">
              <button
                onClick={() => setGenresExpanded((v) => !v)}
                className="flex w-full items-center justify-between px-3 sm:px-4 py-2.5 text-[12px] sm:text-[13px] font-black tracking-widest text-neutral-400 uppercase hover:text-neutral-200 transition-colors cursor-pointer group"
              >
                <span className="group-hover:text-[#39FF14] transition-colors font-semibold">{t("categories")}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${genresExpanded ? "rotate-180 text-[#39FF14]" : ""}`} />
              </button>
              <button
                id="sidebar-all-categories-btn"
                onClick={() => {
                  setActiveGenre(null);
                  setActiveGenreName(null);
                  setCurrentView("movies");
                  setIsOpen(false);
                }}
                className="relative flex w-full items-center px-3 sm:px-4 py-3 text-[14px] sm:text-[15px] font-bold rounded-xl transition-all duration-300 bg-gradient-to-r from-[#39FF14]/15 to-transparent text-[#39FF14] border border-[#39FF14]/30 hover:border-[#39FF14]/50 hover:from-[#39FF14]/20 hover:shadow-[0_0_20px_rgba(57,255,20,0.2)] cursor-pointer overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#39FF14]/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
                <Tag className="h-4 w-4 mr-3 relative z-10" />
                <span className="relative z-10">{t("allCategories")}</span>
              </button>
              <div className={`space-y-1 overflow-y-auto custom-scrollbar pr-1 transition-all duration-300 ease-out ${genresExpanded ? "max-h-80 opacity-100" : "max-h-0 opacity-0 pointer-events-none"}`}>
              {genres.map((g) => {
                const isActive = activeGenre === g.id;
                return (
                  <button
                    key={g.id}
                    id={`genre-item-${g.id}`}
                    onClick={() => {
                      handleGenreClick(g.id, t(`genre.${g.label}`));
                      setIsOpen(false);
                    }}
                    className={`relative flex w-full items-center px-3 sm:px-4 py-2.5 sm:py-3 text-[14px] sm:text-[15px] rounded-xl transition-all duration-200 overflow-hidden ${
                      isActive 
                        ? "text-[#39FF14] font-semibold bg-gradient-to-r from-[#39FF14]/10 to-transparent border border-[#39FF14]/20 shadow-[0_0_15px_rgba(57,255,20,0.15)]" 
                        : "text-neutral-300 hover:text-white hover:bg-white/[0.06] border border-transparent"
                    }`}
                  >
                    <span className={`mr-3 h-2.5 w-2.5 rounded-full transition-all duration-200 flex-shrink-0 ${
                      isActive ? "bg-[#39FF14] shadow-[0_0_10px_rgba(57,255,20,0.8)] scale-125" : "bg-neutral-600"
                    }`} />
                    <span className="relative z-10">{t(`genre.${g.label}`)}</span>
                  </button>
                );
              })}
              </div>
            </div>
          )}

          {sidebarAds.length > 0 && (
            <div className="space-y-2 px-1">
              {sidebarAds.map((ad) => (
                <AdBanner key={ad.id} ad={ad} variant="sidebar" />
              ))}
            </div>
          )}

          {/* Settings & Support */}
          {!isCollapsed && (
            <div id="support-group" className="space-y-1">
              <button
                id="nav-settings-btn"
                onClick={() => {
                  handleNavClick("profile");
                  setIsOpen(false);
                }}
                className="flex w-full items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3 text-[14px] sm:text-[15px] rounded-lg hover:text-white hover:bg-white/5 transition-colors"
              >
                <Settings className="h-4 w-4 text-neutral-400" />
                <span className="flex-1 text-left">{t("settings")}</span>
                {isGuest && <Lock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-neutral-600" />}
              </button>
              <button
                id="nav-support-btn"
                onClick={() => {
                  setCurrentView("help");
                  setIsOpen(false);
                }}
                className="flex w-full items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3 text-[14px] sm:text-[15px] rounded-lg hover:text-white hover:bg-white/5 transition-colors"
              >
                <HelpCircle className="h-4 w-4 text-neutral-400" />
                <span>{t("helpDesk")}</span>
              </button>
              <button
                id="nav-about-btn"
                onClick={() => {
                  setCurrentView("about");
                  setIsOpen(false);
                }}
                className="flex w-full items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3 text-[14px] sm:text-[15px] rounded-lg hover:text-white hover:bg-white/5 transition-colors"
              >
                <Info className="h-4 w-4 text-neutral-400" />
                <span>{t("aboutCinemax")}</span>
              </button>
              <div className="flex w-full items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3 text-[14px] sm:text-[15px] rounded-lg">
                <Globe className="h-4 w-4 text-neutral-400 flex-shrink-0" />
                <span className="flex-1 text-left text-neutral-300">{t("language")}</span>
                <select
                  value={appLanguage}
                  onChange={(e) => setAppLanguage(e.target.value as typeof appLanguage)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[12px] text-white focus:outline-none focus:border-[#39FF14]/40 cursor-pointer max-w-[100px] sm:max-w-[110px]"
                  aria-label={t("language")}
                >
                  {APP_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>
              <InstallAppButton label="Install APK" />
              <div className="lg:hidden">
                <InstallAppButton variant="sidebar" label="Download App" />
              </div>
            </div>
          )}
        </div>


        {/* Premium User Card Footer */}
        {user && !isCollapsed && (
          <div
            id="user-sidebar-footer"
            className="relative border-t border-white/5 bg-gradient-to-r from-[#0a0a0a]/60 to-[#0a0a0a]/40 p-4 flex items-center gap-3"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#39FF14]/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
            <button
              onClick={() => handleNavClick("profile")}
              className="relative group/avatar flex-shrink-0 cursor-pointer"
              title="Account Settings"
            >
              <div className="relative rounded-2xl overflow-hidden border border-white/10 group-hover/avatar:border-[#39FF14] transition-all duration-300 shadow-lg group-hover/avatar:shadow-[0_0_20px_rgba(57,255,20,0.3)]">
                <AvatarRenderer value={user.avatar} size={44} initials={user.name?.[0]?.toUpperCase() || "C"} />
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#39FF14] shadow-[0_0_10px_rgba(57,255,20,0.8)]"></span>
              </span>
            </button>
            <button
              onClick={() => handleNavClick("profile")}
              className="relative min-w-0 flex-1 text-left cursor-pointer"
              title="Account Settings"
            >
              <p className="text-xs font-bold text-white truncate">{user.name}</p>
              <span className={`inline-flex items-center gap-1 mt-0.5 text-[9px] font-black uppercase tracking-wide ${isPremium ? "text-[#39FF14]" : "text-neutral-500"}`}>
                {isPremium && <Crown className="h-2.5 w-2.5" />}
                {isPremium ? "Premium" : "Free Plan"}
              </span>
            </button>
            <button
              id="sidebar-logout-btn"
              onClick={logoutUser}
              aria-label="Log out"
              title="Log out"
              className="relative flex-shrink-0 p-2 rounded-xl text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-300 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </aside>
    </>
  );
};
