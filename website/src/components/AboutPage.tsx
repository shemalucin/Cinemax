import React from "react";
import { useApp } from "../context/AppContext";
import { Bot, Mic, Bookmark, ShieldCheck, Sparkles, Users, Rocket, Heart, Building2, Globe, Link } from "lucide-react";

const FEATURES = [
  {
    icon: Bot,
    title: "AI Help Desk",
    description: "A fast, professional assistant that answers questions and can adjust your settings on request — always with your confirmation first.",
  },
  {
    icon: Mic,
    title: "Voice Search",
    description: "Use voice commands to search for movies, ask questions, and navigate the site hands-free.",
  },
  {
    icon: Bookmark,
    title: "Watchlist & Favorites",
    description: "Keep track of what you want to watch and what you love, synced to your profile.",
  },
  {
    icon: ShieldCheck,
    title: "Real Account Controls",
    description: "Change your name, password, and preferences in a settings panel that actually works.",
  },
];

const VALUES = [
  {
    icon: Sparkles,
    title: "Discovery First",
    description: "We think finding your next favorite show should feel effortless, not like scrolling forever.",
  },
  {
    icon: Users,
    title: "Built Around You",
    description: "Your watch history and preferences shape what Cinemax surfaces — not the other way around.",
  },
  {
    icon: Rocket,
    title: "Always Improving",
    description: "We ship small, meaningful upgrades often — new AI capabilities, smoother UI, better performance.",
  },
];

export const AboutPage: React.FC = () => {
  const { setCurrentView } = useApp();

  return (
    <div id="about-page" className="max-w-5xl mx-auto px-4 sm:px-6 py-14 pb-24 text-white">
      {/* Hero */}
      <div className="text-center max-w-2xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#39FF14] font-black text-black shadow-[0_0_15px_rgba(57,255,20,0.4)] text-lg">
            C
          </div>
          <span className="text-lg font-black tracking-tighter select-none">
            <span className="text-white">CINEMA</span><span className="text-[#39FF14]">X</span>
          </span>
        </div>
        <h1 className="font-sans text-3xl sm:text-4xl font-black tracking-tight mb-4">
          Your movies, remembered. Your next watch, discovered.
        </h1>
        <p className="text-neutral-400 text-sm leading-relaxed">
          Cinemax is a personal movie & TV companion built around one idea: discovery should feel smart, not
          overwhelming. An AI Help Desk, voice search, and a watchlist that actually keeps up with you.
        </p>
      </div>

      {/* Mission */}
      <div className="glass-card rounded-3xl p-8 sm:p-10 mb-12 text-center">
        <Heart className="h-8 w-8 text-[#39FF14] mx-auto mb-4" />
        <h2 className="font-sans text-xl font-bold mb-3">Our Mission</h2>
        <p className="text-neutral-400 text-sm max-w-xl mx-auto leading-relaxed">
          We built Cinemax because tracking what you want to watch shouldn't take more effort than watching it.
          Every feature — from AI recommendations to voice search — exists to shorten the distance between "I'm
          bored" and "I found something great."
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-16">
        {[
          { value: "1M+", label: "Titles Indexed" },
          { value: "24/7", label: "AI Help Desk" },
          { value: "99.9%", label: "Uptime Target" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl bg-white/5 border border-white/10 py-6 text-center">
            <p className="font-sans text-2xl sm:text-3xl font-black text-[#39FF14]">{stat.value}</p>
            <p className="text-[10px] sm:text-xs text-neutral-500 font-semibold uppercase tracking-wider mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* CEO Card */}
      <div className="glass-card rounded-3xl p-8 sm:p-10 mb-16">
        <div className="flex items-center gap-2 mb-6">
          <Building2 className="h-6 w-6 text-[#39FF14]" />
          <h2 className="font-sans text-xl font-bold">Leadership</h2>
        </div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 h-16 w-16 rounded-2xl bg-gradient-to-br from-[#39FF14]/20 to-[#39FF14]/5 border border-[#39FF14]/30 flex items-center justify-center">
              <span className="text-2xl font-black text-[#39FF14]">S</span>
            </div>
            <div className="flex-1">
              <h3 className="font-sans text-lg font-bold text-white mb-1">SHEMA lucin</h3>
              <p className="text-xs font-semibold text-[#39FF14] mb-3">CEO & Founder</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-neutral-400">
                  <Globe className="h-4 w-4" />
                  <span>Rwanda</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-400">
                  <Link className="h-4 w-4" />
                  <span>cinemaxmov</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="mb-16">
        <h2 className="font-sans text-2xl font-black mb-8 text-center">What You Get</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="flex gap-4 p-5 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex-shrink-0 h-11 w-11 rounded-2xl bg-[#39FF14]/10 border border-[#39FF14]/20 text-[#39FF14] flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-sans font-bold text-sm text-white mb-1">{f.title}</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">{f.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Values */}
      <div className="mb-16">
        <h2 className="font-sans text-2xl font-black mb-8 text-center">What We Believe</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {VALUES.map((v) => {
            const Icon = v.icon;
            return (
              <div key={v.title} className="text-center p-6 rounded-2xl bg-white/5 border border-white/10">
                <div className="h-11 w-11 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center mx-auto mb-4 text-[#39FF14]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-sans font-bold text-sm text-white mb-1.5">{v.title}</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">{v.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center">
        <button
          onClick={() => setCurrentView("home")}
          className="neon-btn inline-flex items-center gap-2 font-extrabold px-8 py-3.5 rounded-xl text-sm uppercase tracking-wide transition-all cursor-pointer"
        >
          Explore Cinemax
        </button>
      </div>
    </div>
  );
};
