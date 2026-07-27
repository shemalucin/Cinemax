import React, { useEffect, useMemo, useState } from "react";
import {
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  Mail,
  ArrowUpRight,
  MessageCircle,
} from "lucide-react";

import { useApp } from "../context/AppContext";
import { tmdb } from "../utils/tmdb";
import { Movie, SocialMediaLink } from "../types";
import { MovieCard } from "./MovieCard";
import { adminApi } from "../utils/adminApi";

export const Footer: React.FC = () => {
  const { setCurrentView, user, requireSignInPrompt, isGuest } = useApp();
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [featuredMovies, setFeaturedMovies] = useState<Movie[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [socialMediaLinks, setSocialMediaLinks] = useState<SocialMediaLink[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const trending = await tmdb.getTrendingMovies(1);
        // Byongeye kugarura firime 20 zose kugira ngo ihinguranya rirangire neza
        const list = Array.isArray(trending) ? (trending as Movie[]).slice(0, 20) : [];
        if (!cancelled) setFeaturedMovies(list);
      } catch {
        if (!cancelled) setFeaturedMovies([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch social media links
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const links = await adminApi.getSocialMedia();
        if (!cancelled) setSocialMediaLinks(links);
      } catch (err) {
        console.error("Failed to fetch social media links:", err);
        // Fallback to default links if API fails
        if (!cancelled) {
          setSocialMediaLinks([
            { id: "1", platform: "instagram", url: "https://www.instagram.com/cinemaxmov01/?hl=en", icon: "Instagram", name: "Instagram", enabled: true },
            { id: "2", platform: "youtube", url: "https://www.youtube.com/@Cinemaxmov", icon: "Youtube", name: "YouTube", enabled: true },
            { id: "3", platform: "whatsapp", url: "https://wa.me/738664438", icon: "MessageCircle", name: "WhatsApp", enabled: true },
          ]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!featuredMovies.length) return;
    const timer = window.setInterval(() => {
      setCarouselIndex((i) => (i + 1) % featuredMovies.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [featuredMovies.length]);

  // Aha twahinduye umubare w'udukarita twerekanwa rimwe akaba 8 (biva kuri 5)
  const carouselVisible = useMemo(() => {
    const visibleCount = 8;
    if (!featuredMovies.length) return [];
    const out: Movie[] = [];
    for (let k = 0; k < visibleCount; k++) {
      const idx = (carouselIndex + k) % featuredMovies.length;
      out.push(featuredMovies[idx]);
    }
    return out;
  }, [carouselIndex, featuredMovies]);

  const handleFooterMovieClick = (m: Movie) => {
    if (!user || isGuest) {
      requireSignInPrompt();
      return;
    }
    setCurrentView("player");
    (window as any).__cinemaxSelectMovie = m;
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
    setEmail("");
    setTimeout(() => setSubscribed(false), 2000);
  };

  return (
    <footer
      id="site-footer"
      className="relative z-10 mt-10 border-t border-white/5 bg-gradient-to-b from-neutral-950 to-black"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#39FF14]/40 to-transparent"
      />

      <div className="mx-auto max-w-6xl px-6 sm:px-12 py-8">
        {/* ── Top row: brand + newsletter ─────────────────────────────── */}
        <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr] mb-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <img
                src="/branding/cinemax-logo-mark.svg"
                alt="Cinemax mark"
                className="h-8 w-8 rounded-xl border border-[#39FF14]/30 bg-[#0a0a0a]/40 p-1 shadow-[0_0_12px_rgba(57,255,20,0.1)]"
              />
              <div className="leading-tight">
                <span className="block text-base font-black tracking-tighter text-white">
                  <span className="text-[#39FF14]">C</span>INEMAX
                </span>
              </div>
            </div>

            <p className="max-w-md text-xs leading-relaxed text-neutral-400">
              Your personal movie &amp; TV companion — AI-powered discovery.
            </p>

            <div className="flex items-center gap-2 pt-1">
              {socialMediaLinks.filter(link => link.enabled).map((link) => {
                const IconMap: Record<string, any> = {
                  Instagram,
                  Youtube,
                  MessageCircle,
                  Facebook,
                  Twitter,
                };
                const Icon = IconMap[link.icon] || MessageCircle;
                return (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={link.name}
                    className="group flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-neutral-400 transition-all hover:border-[#39FF14]/40 hover:bg-[#39FF14]/10 hover:text-[#39FF14]"
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Newsletter */}
          <div className="rounded-xl border border-white/10 bg-white/[0.01] p-4 backdrop-blur">
            <h4 className="text-xs font-black uppercase tracking-widest text-white">
              Get weekly picks
            </h4>

            <form onSubmit={handleSubscribe} className="mt-2.5 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@cinema.night"
                  className="w-full rounded-lg border border-white/10 bg-[#0a0a0a]/40 py-1.5 pl-8 pr-2 text-xs text-white placeholder-neutral-600 outline-none transition focus:border-[#39FF14]/50"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#39FF14] px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-black transition hover:bg-[#39FF14]/90"
              >
                Subscribe <ArrowUpRight className="h-3 w-3" />
              </button>
            </form>
            {subscribed && (
              <p className="mt-2 text-[11px] text-[#39FF14]">✓ Subscribed.</p>
            )}
          </div>
        </div>

        {/* ── Bottom row: Company Links + Movie Cards Carousel (Full Right Width) ── */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1fr_3.5fr] border-t border-white/5 pt-6 items-start">
          
          {/* Left Column: Company & Support */}
          <div className="space-y-4">
            <div>
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Company</h5>
              <ul className="space-y-1 text-xs text-neutral-500">
                <li>
                  <button
                    type="button"
                    onClick={() => setCurrentView("about")}
                    className="hover:text-white transition cursor-pointer"
                  >
                    About Us
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setCurrentView("help")}
                    className="hover:text-white transition cursor-pointer"
                  >
                    Help Desk
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Support & Website</h5>
              <ul className="space-y-1 text-xs text-neutral-500">
                <li><a href="#" className="hover:text-white transition">Help Desk</a></li>
                <li><a href="#" className="hover:text-white transition">About Website</a></li>
                <li><a href="#" className="hover:text-white transition text-[#39FF14]">Download TV Shows</a></li>
              </ul>
            </div>
          </div>

          {/* Right Column: Full-Width Tiny Movie Carousel (Uduzura kugera ku gikuta) */}
          <div className="space-y-3 w-full">
            <div>
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                Trending Showcase
              </h5>
              
              {carouselVisible.length > 0 ? (
// Hano grid yahindutse grid-cols-8 kandi hakuweho max-w-md
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 bg-white/[0.01] p-1 rounded-lg border border-white/5 w-full">
                  {carouselVisible.map((movie) => (
                    <div key={movie.id} className="cursor-pointer transition-transform duration-200 hover:scale-105 w-full">
                      <MovieCard movie={movie} onClick={() => handleFooterMovieClick(movie)} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-neutral-600 italic">Loading live showcase...</p>
              )}
            </div>

            {/* Copyright Note */}
            <div className="pt-2 border-t border-white/5 flex items-center justify-end">
              <p className="text-[11px] text-neutral-600">
                &copy; {new Date().getFullYear()} Cinemax. All rights reserved.
              </p>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
};
