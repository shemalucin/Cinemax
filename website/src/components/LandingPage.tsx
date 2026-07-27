import React from "react";
import { useApp } from "../context/AppContext";
import { tmdb, getImageUrl } from "../utils/tmdb";
import { Movie } from "../types";
import { Footer } from "./Footer";
import {
  Bookmark,
  Bot,
  MonitorSmartphone,
  ChevronDown,
  Mail,
  Lock,
  ArrowRight,
  ArrowLeft,
  Shield,
  Mic,
  Loader2,
  Code2,
  Globe2,
  MapPin,
  UserRound,
} from "lucide-react";
import { CinemaxLogo } from "./CinemaxLogo";

const REASONS = [
  {
    icon: Bot,
    title: "AI Help Desk",
    description: "All Kiki's answers questions, curates picks, and can even adjust your settings - just ask.",
    accent: "from-[#39FF14]/20 to-transparent text-[#39FF14]",
  },
  {
    icon: Mic,
    title: "Voice Search",
    description: "Use voice commands to search for movies, ask questions, and navigate the site hands-free.",
    accent: "from-sky-400/20 to-transparent text-sky-400",
  },
  {
    icon: Bookmark,
    title: "Smart Watchlist",
    description: "Favorite titles, build a watchlist, and pick up exactly where you left off.",
    accent: "from-fuchsia-400/20 to-transparent text-fuchsia-400",
  },
  {
    icon: MonitorSmartphone,
    title: "Every Device",
    description: "A responsive, installable experience that feels native on desktop, tablet, and mobile.",
    accent: "from-amber-400/20 to-transparent text-amber-400",
  },
];

const FAQS = [
  {
    q: "What makes Cinemax different?",
    a: "AI-powered personalized recommendations, voice search, offline downloads, and a stunning modern interface—all completely free.",
  },
  {
    q: "Is Cinemax really free?",
    a: "Yes! 100% free with no subscriptions, hidden fees, or credit card required. Supported by minimal ads.",
  },
  {
    q: "How does the AI assistant help?",
    a: "All Kiki's understands natural language, curates personalized picks, and can adjust your settings on request.",
  },
  {
    q: "What is Voice Search?",
    a: "Speak naturally to search titles, get recommendations, or find content by genre, mood, or actor—hands-free.",
  },
  {
    q: "Can I watch offline?",
    a: "Yes! Download movies and shows to watch anywhere without internet. Perfect for travel.",
  },
  {
    q: "How do I install the app?",
    a: "Click 'Install App' in your browser. No app store needed—works on desktop and mobile.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. Industry-standard encryption, no data selling, and full control over your account and data.",
  },
  {
    q: "What devices are supported?",
    a: "All modern devices: desktop, laptop, tablet, smartphone. Works on Chrome, Firefox, Safari, Edge.",
  },
];

const HERO_ROTATE_MS = 6500;

export const LandingPage: React.FC = () => {
  const { enterAsGuest, signIn, openAuthModal, openForgotPasswordModal, authError } = useApp();

  const [openFaq, setOpenFaq] = React.useState<number | null>(0);

  // --- Hero carousel state -------------------------------------------------
  const [heroMovies, setHeroMovies] = React.useState<Movie[]>([]);
  const [heroIndex, setHeroIndex] = React.useState(0);

  React.useEffect(() => {
    tmdb.getTrendingMovies().then((movies) => {
      setHeroMovies(movies.filter((m) => m.backdrop_path).slice(0, 8));
    }).catch(() => setHeroMovies([]));
  }, []);

  // Auto-rotate the featured movie
  React.useEffect(() => {
    if (heroMovies.length < 2) return;
    const rotateTimer = setInterval(() => {
      setHeroIndex((i: number) => (i + 1) % heroMovies.length);
    }, 5000);
    return () => clearInterval(rotateTimer);
  }, [heroMovies.length]);

  const featuredMovie = heroMovies[heroIndex];

  // --- Email to password sign-in flow ---------------------------------------
  const [step, setStep] = React.useState<"email" | "password">("email");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [signInError, setSignInError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSignInError("Please enter a valid email address.");
      return;
    }
    setSignInError(null);
    setStep("password");
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setSignInError("Please enter your password.");
      return;
    }
    setSignInError(null);
    setSubmitting(true);
    const result = await signIn(email, password);
    setSubmitting(false);
    if (!result.ok) {
      setSignInError(result.error || "Couldn't sign you in - check your email and password.");
    }
    // If successful, the main App component will handle the transition
  };

  return (
    <div id="landing-page" className="min-h-screen bg-[#121418] text-white overflow-x-hidden on-dark-bg">
      {/* HERO */}
      <section className="relative min-h-screen flex flex-col">
        {/* Sliding image-only carousel. No trailer or movie autoplay on the first page. */}
        <div className="absolute inset-0 overflow-hidden bg-[#121418]">
          {heroMovies.map((movie: Movie, idx: number) => (
            <div
              key={movie.id}
              className="absolute inset-0 transition-transform duration-1000 ease-in-out"
              style={{ transform: `translateX(${(idx - heroIndex) * 100}%)` }}
            >
              <img
                src={getImageUrl(movie.backdrop_path, "original")}
                alt=""
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-8 left-4 right-4 hidden sm:block">
                <p className="max-w-xl truncate text-xs font-black uppercase tracking-[0.35em] text-white/45">
                  {movie.title || movie.name}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-[#121418]" />
        <div className="absolute inset-0 bg-gradient-radial-overlay" />

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-4 sm:px-12 py-4 sm:py-6">
          <div className="flex items-center gap-2">
            <CinemaxLogo compact className="scale-[0.9]" />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              id="landing-signup-btn"
              onClick={() => openAuthModal("signup")}
              className="neon-btn text-xs sm:text-sm font-extrabold px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl transition-all cursor-pointer"
            >
              Sign Up
            </button>
            <button
              id="landing-guest-btn"
              onClick={() => enterAsGuest()}
              className="group relative text-xs sm:text-sm font-extrabold px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl border border-white/20 bg-white/5 text-white backdrop-blur-md transition-all cursor-pointer hover:bg-white/10 hover:border-white/35 active:scale-95"
              title="Browse Cinemax without an account — sign-in is only needed for features like watchlists and playback"
            >
              <span className="flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 opacity-80 group-hover:opacity-100 transition-opacity">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" />
                </svg>
                Guest
              </span>
            </button>
          </div>
        </header>

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 sm:px-6 max-w-3xl mx-auto py-8 sm:py-0">
          <div className="mb-6 flex items-center justify-center">
            <CinemaxLogo className="scale-[1.05] sm:scale-[1.2]" />
          </div>

          {/* Tagline */}
          <p className="text-neutral-300 text-base sm:text-lg font-semibold max-w-xl mb-2">
            Welcome to Cinemax! Enjoy new trend movies and TV shows.
          </p>
          {featuredMovie && (
            <p className="text-[11px] text-neutral-500 font-semibold uppercase tracking-widest mb-6">
              Now Featuring - {featuredMovie.title || featuredMovie.name}
            </p>
          )}

          {/* Email to Password Sign-In flow */}
          <div className="w-full max-w-lg">
            {step === "email" ? (
              <form id="landing-email-form" onSubmit={handleEmailSubmit} className="w-full flex flex-col sm:flex-row gap-2.5 sm:gap-3">
                <div className="relative flex-1">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    placeholder="Email address"
                    aria-label="Email address"
                    className="w-full surface-input rounded-xl pl-11 pr-4 py-2.5 sm:py-3.5 text-sm placeholder:text-neutral-500 transition-colors focus:outline-none"
                  />
                </div>
                <button
                  id="landing-continue-btn"
                  type="submit"
                  className="neon-btn flex items-center justify-center gap-2 font-extrabold px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-xl text-sm uppercase tracking-wide transition-all cursor-pointer whitespace-nowrap"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            ) : (
              <form id="landing-password-form" onSubmit={handlePasswordSubmit} className="w-full flex flex-col sm:flex-row gap-2.5 sm:gap-3 animate-fade-in">
                <div className="relative flex-1">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    placeholder={`Password for ${email}`}
                    aria-label="Password"
                    autoFocus
                    className="w-full surface-input rounded-xl pl-11 pr-4 py-2.5 sm:py-3.5 text-sm placeholder:text-neutral-500 transition-colors focus:outline-none"
                  />
                </div>
                <button
                  id="landing-signin-submit-btn"
                  type="submit"
                  disabled={submitting}
                  className="neon-btn flex items-center justify-center gap-2 font-extrabold px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-xl text-sm uppercase tracking-wide transition-all cursor-pointer whitespace-nowrap disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign In <ArrowRight className="h-4 w-4" /></>}
                </button>
              </form>
            )}

            {step === "email" && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">
                <button
                  type="button"
                  onClick={() => openForgotPasswordModal()}
                  className="w-full sm:w-auto btn-forgot px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide cursor-pointer"
                >
                  Forgot Password
                </button>
              </div>
            )}

            {step === "password" && (
              <div className="mt-3 flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setStep("email"); setSignInError(null); }}
                  className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Use a different email
                </button>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => openForgotPasswordModal()}
                    className="btn-forgot px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide cursor-pointer"
                  >
                    Forgot Password
                  </button>
                </div>
              </div>
            )}

            {(signInError || authError) && (
              <p className="text-xs text-rose-400 font-semibold mt-3">{signInError || authError}</p>
            )}

            <p className="text-[11px] text-neutral-600 mt-4">
              New to Cinemax?{" "}
              <button type="button" onClick={() => openAuthModal("signup")} className="text-[#39FF14] hover:underline font-bold cursor-pointer">
                Create an account
              </button>
            </p>
          </div>

          <p className="flex items-center gap-1.5 text-[11px] text-neutral-600 mt-5">
            <Shield className="h-3.5 w-3.5" />
            No credit card required. Cancel anytime.
          </p>
        </div>

        {/* Carousel dot indicators */}
        {heroMovies.length > 1 && (
          <div className="relative z-10 flex justify-center gap-1.5 pb-6">
            {heroMovies.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setHeroIndex(idx)}
                aria-label={`Show featured title ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  idx === heroIndex ? "w-6 bg-[#39FF14]" : "w-1.5 bg-white/25 hover:bg-white/50"
                }`}
              />
            ))}
          </div>
        )}

        <div className="relative z-10 flex justify-center pb-6">
          <ChevronDown className="h-5 w-5 text-neutral-600 animate-bounce" />
        </div>
      </section>

      {/* MORE REASONS TO JOIN */}
      <section className="relative z-10 px-6 sm:px-12 py-20 max-w-6xl mx-auto">
        <h2 className="font-sans text-2xl sm:text-3xl font-black mb-10">More Reasons to Join</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {REASONS.map((r) => {
            const Icon = r.icon;
            return (
              <div
                key={r.title}
                className={`relative rounded-3xl p-6 glass-card overflow-hidden group hover:-translate-y-1 transition-transform duration-300`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${r.accent} opacity-40 group-hover:opacity-60 transition-opacity`} />
                <div className="relative z-10">
                  <div className={`h-11 w-11 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center mb-6 ${r.accent.split(" ").pop()}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-sans font-bold text-lg text-white mb-2">{r.title}</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">{r.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 px-6 sm:px-12 pb-16 max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="font-sans text-2xl sm:text-3xl font-black text-white mb-2">
            Frequently Asked Questions
          </h2>
          <p className="text-xs text-neutral-400 max-w-xl mx-auto">
            Quick answers. Need more? <span className="text-[#39FF14]">Ask our AI assistant</span>.
          </p>
        </div>
        
        <div className="space-y-2">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div 
                key={idx} 
                className={`group rounded-xl overflow-hidden transition-all duration-300 ${
                  isOpen 
                    ? "bg-gradient-to-br from-[#39FF14]/10 to-transparent border-[#39FF14]/30 shadow-[0_0_20px_rgba(57,255,20,0.1)]" 
                    : "bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/8"
                } border`}
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-all duration-300 ${
                      isOpen 
                        ? "bg-[#39FF14] text-black" 
                        : "bg-white/10 text-neutral-400 group-hover:bg-white/15"
                    }`}>
                      <span className="font-bold text-xs">{idx + 1}</span>
                    </div>
                    <span className={`font-semibold text-xs sm:text-sm transition-colors ${
                      isOpen ? "text-[#39FF14]" : "text-white"
                    }`}>
                      {faq.q}
                    </span>
                  </div>
                  <ChevronDown 
                    className={`h-4 w-4 flex-shrink-0 transition-all duration-300 ${
                      isOpen 
                        ? "rotate-180 text-[#39FF14]" 
                        : "text-neutral-500 group-hover:text-neutral-300"
                    }`} 
                  />
                </button>
                <div
                  className="grid transition-all duration-300 ease-out"
                  style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <div className="px-4 pb-3 pt-1">
                      <p className="text-xs text-neutral-300 leading-relaxed pl-9">
                        {faq.a}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#39FF14]/10 to-transparent border border-[#39FF14]/30">
            <Shield className="h-4 w-4 text-[#39FF14]" />
            <span className="text-xs text-neutral-300">
              Still have questions? <span className="text-[#39FF14] font-semibold">Contact support</span>
            </span>
          </div>
        </div>
      </section>

      {/* Developer Credit */}
      <section className="relative z-10 px-4 sm:px-12 pb-24 max-w-4xl mx-auto">
        <div
          id="developer-credit-card"
          className="relative overflow-hidden rounded-[1.5rem] border border-[#39FF14]/25 bg-[#030806] p-4 shadow-2xl sm:rounded-[2rem] sm:p-6"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(57,255,20,0.18),transparent_34%),linear-gradient(90deg,rgba(255,255,255,0.04),transparent_40%,rgba(57,255,20,0.08))]" />
          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#39FF14]/80 to-transparent" />

          <div className="relative grid items-center gap-6 lg:grid-cols-[1fr_0.8fr]">
            <div className="mx-auto w-full max-w-sm">
              <div className="mb-6 flex justify-center">
                <div className="relative">
                  <svg
                    viewBox="0 0 900 600"
                    className="h-16 w-16 rounded-full border-2 border-[#39FF14]/40 shadow-[0_0_20px_rgba(57,255,20,0.22)]"
                    role="img"
                    aria-label="Flag of Rwanda"
                    style={{ clipPath: 'circle(50% at 50% 50%)' }}
                  >
                    <rect width="900" height="600" fill="#20603D" />
                    <rect width="900" height="400" fill="#00A1DE" />
                    <rect width="900" height="100" y="400" fill="#FAD201" />
                    <g transform="translate(700,150)">
                      <circle r="65" fill="#E5BE01" />
                      {Array.from({ length: 24 }).map((_, i: number) => (
                        <rect
                          key={i}
                          x="-4"
                          y="-115"
                          width="8"
                          height="45"
                          fill="#E5BE01"
                          transform={`rotate(${(i * 360) / 24})`}
                        />
                      ))}
                    </g>
                  </svg>
                </div>
              </div>

              <div className="mb-6 flex items-center justify-center gap-4 text-[#39FF14]">
                <span className="h-px w-16 bg-[#39FF14]/70" />
                <Code2 className="h-6 w-6 drop-shadow-[0_0_10px_rgba(57,255,20,0.75)]" />
                <span className="h-px w-16 bg-[#39FF14]/70" />
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-[3.5rem_1fr] items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#39FF14]/70 text-[#39FF14] shadow-[0_0_14px_rgba(57,255,20,0.16)]">
                    <UserRound className="h-6 w-6" />
                  </div>
                  <div className="border-b border-white/20 pb-3">
                    <p className="text-xs font-medium uppercase text-neutral-400">CEO</p>
                    <p className="text-2xl font-black text-[#39FF14] sm:text-3xl">SHEMA lucin</p>
                  </div>
                </div>

                <div className="grid grid-cols-[3.5rem_1fr] items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#39FF14]/70 text-[#39FF14] shadow-[0_0_14px_rgba(57,255,20,0.16)]">
                    <MapPin className="h-6 w-6" />
                  </div>
                  <div className="border-b border-white/20 pb-3">
                    <p className="text-xs font-medium uppercase text-neutral-400">Location</p>
                    <p className="text-2xl font-black text-[#39FF14] sm:text-3xl">Rwanda</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative mx-auto aspect-[3/4] w-full max-w-[72px] overflow-hidden rounded-lg border border-[#39FF14] bg-[#0a0a0a] shadow-[0_0_18px_rgba(57,255,20,0.22)] sm:max-w-[88px]">
              <img
                src="/branding/developer-profile.jpg"
                alt="shemalucin"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};


