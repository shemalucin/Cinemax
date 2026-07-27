import React, { useState, useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { Message, AssistantAction, Movie } from "../types";
import { getImageUrl } from "../utils/tmdb";
import { askAssistant } from "../utils/assistantClient";
import {
  Sparkles,
  Send,
  X,
  Zap,
  ShieldCheck,
  Loader2,
  Check,
  Bot,
  MessageCircle,
  HelpCircle,
  Mail,
  Search,
  ChevronDown,
  Clock,
} from "lucide-react";

const QUICK_PROMPTS = [
  "Recommend a mind-bending sci-fi movie",
  "How do I change my subtitle language?",
  "Turn off autoplay trailers for me",
  "What's trending in horror right now?",
];

const HELP_FAQS = [
  {
    category: "AI",
    q: "How does Voice Search work?",
    a: "Click microphone to speak commands. AI understands natural voice for searching.",
  },
  {
    category: "Downloads",
    q: "What gets downloaded?",
    a: "Saves metadata and images. Playback streams online.",
  },
  {
    category: "Playback",
    q: "Server not loading?",
    a: "Switch servers using toggle under player. Instant and safe.",
  },
  {
    category: "Playback",
    q: "Why is player sandboxed?",
    a: "Blocks ads and redirects while allowing normal playback.",
  },
  {
    category: "Account",
    q: "Change display name or email?",
    a: "Settings → Profile, update details, Save.",
  },
  {
    category: "Account",
    q: "Change my avatar?",
    a: "Settings → Profile, select from avatar grids.",
  },
  {
    category: "Account",
    q: "Delete my account?",
    a: "Settings → Danger Zone. Deletion is permanent.",
  },
  {
    category: "Features",
    q: "What is Voice Search?",
    a: "Speak commands to search hands-free. AI understands context.",
  },
  {
    category: "Features",
    q: "Can AI change my settings?",
    a: "Yes. Ask to change settings like autoplay. Requires confirmation.",
  },
];

const FAQ_CATEGORIES = ["All", ...Array.from(new Set(HELP_FAQS.map((f) => f.category)))];

type HelpTab = "chat" | "faq" | "contact";

/** Parses a trailing ```action {...}``` fenced block out of an assistant reply. */
function extractAction(text: string): { cleanText: string; action: AssistantAction | null } {
  const match = text.match(/```action\s*([\s\S]*?)```/);
  if (!match) return { cleanText: text.trim(), action: null };
  try {
    const parsed = JSON.parse(match[1].trim());
    if (parsed && parsed.type && parsed.label) {
      return { cleanText: text.replace(match[0], "").trim(), action: parsed as AssistantAction };
    }
  } catch {
    // fall through — malformed action block, just strip it
  }
  return { cleanText: text.replace(match[0], "").trim(), action: null };
}


export const HelpDeskPage: React.FC = () => {
  const { user, applyAssistantAction } = useApp();

  const [helpTab, setHelpTab] = useState<HelpTab>("chat");

  // FAQ tab state
  const [faqSearch, setFaqSearch] = useState("");
  const [faqCategory, setFaqCategory] = useState("All");
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);

  // Contact tab state
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactSent, setContactSent] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactBusy, setContactBusy] = useState(false);

  const filteredFaqs = HELP_FAQS.filter((f) => {
    const matchesCategory = faqCategory === "All" || f.category === faqCategory;
    const matchesSearch =
      !faqSearch.trim() ||
      f.q.toLowerCase().includes(faqSearch.toLowerCase()) ||
      f.a.toLowerCase().includes(faqSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleSendContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactSubject.trim() || !contactMessage.trim()) return;
    setContactError(null);
    setContactBusy(true);
    try {
      const res = await fetch("/api/support/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          subject: contactSubject.trim(),
          message: contactMessage.trim(),
          name: user ? undefined : contactName.trim(),
          email: user ? undefined : contactEmail.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not send your message.");
      setContactSent(true);
      setContactSubject("");
      setContactMessage("");
      setContactName("");
      setContactEmail("");
      setTimeout(() => setContactSent(false), 2000);
    } catch (err: any) {
      setContactError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setContactBusy(false);
    }
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "model",
      text: `Hi${user ? `, ${user.name}` : ""}! I'm **All Kiki's**, your Cinemax AI Help Desk — trained on every feature of this site.${user?.role === "admin" ? " I recognize you as an **administrator** and can guide you through the Admin Panel, content management, and site settings." : ""}\n\nAsk about movies, account settings, or use Voice Search by clicking the microphone. I can help you find content and navigate the site hands-free.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState<Record<number, string>>({});

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);


  const handleSend = async (textOverride?: string) => {
    const prompt = (textOverride ?? input).trim();
    if (!prompt) return;

    const userMsg: Message = {
      role: "user",
      text: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const { text } = await askAssistant({
        message: prompt,
        history: messages.map((m) => ({ role: m.role, text: m.text })),
      });
      const { cleanText, action } = extractAction(text || "");
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: cleanText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          proposedAction: action,
        },
      ]);
    } catch (err: any) {
      console.error("Help desk error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: err?.message ? `I couldn't complete that: ${err.message}` : "Sorry — please try again in a moment.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = (index: number, action: AssistantAction) => {
    const result = applyAssistantAction(action);
    setActionStatus((prev) => ({ ...prev, [index]: result }));
  };

  return (
    <div id="help-desk-page" className="max-w-4xl mx-auto px-4 sm:px-6 py-10 pb-24 text-white">
      <div className="flex items-center gap-4 mb-6">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#22c55e] to-emerald-700 flex items-center justify-center">
          <Bot className="h-6 w-6 text-black" />
        </div>
        <div>
          <h1 className="font-sans text-2xl font-black tracking-tight flex items-center gap-2">
            All Kiki's AI Help Desk
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/20 px-2 py-1 rounded-full">
              <Zap className="h-3 w-3" /> Live
            </span>
          </h1>
          <p className="text-xs text-neutral-500">Movie support, account actions, and AI-powered voice search — all in one place.</p>
        </div>
      </div>

      {/* Help Center tab navigation */}
      <div className="flex items-center gap-1.5 mb-6 p-1.5 rounded-2xl bg-white/5 border border-white/10 w-fit">
        {([
          { id: "chat", label: "AI Chat", icon: MessageCircle },
          { id: "faq", label: "FAQ", icon: HelpCircle },
          { id: "contact", label: "Contact", icon: Mail },
        ] as const).map((t) => {
          const Icon = t.icon;
          const active = helpTab === t.id;
          return (
            <button
              key={t.id}
              id={`help-tab-${t.id}`}
              onClick={() => setHelpTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                active ? "accent-active" : "text-neutral-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB: AI CHAT */}
      {helpTab === "chat" && (
        <>
      {/* Chat window */}
      <div className="glass-card rounded-3xl flex flex-col h-[65vh] overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-2`}>
                {msg.text && (
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user" ? "bg-[#39FF14] text-black font-medium rounded-br-sm" : "bg-white/5 border border-white/10 text-neutral-200 rounded-bl-sm"
                    }`}
                  >
                    {msg.text}
                  </div>
                )}

                {msg.proposedAction && (
                  <div className="w-full rounded-2xl border border-[#39FF14]/30 bg-[#39FF14]/5 p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-neutral-200">
                      <ShieldCheck className="h-4 w-4 text-[#39FF14] flex-shrink-0" />
                      <span>{msg.proposedAction.label}</span>
                    </div>
                    {actionStatus[idx] ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-[#39FF14]">
                        <Check className="h-3.5 w-3.5" /> Done
                      </span>
                    ) : (
                      <button
                        onClick={() => handleConfirmAction(idx, msg.proposedAction!)}
                        className="neon-btn text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg whitespace-nowrap cursor-pointer"
                      >
                        Confirm
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#39FF14]" />
                <span className="text-xs text-neutral-400">All Kiki's is thinking...</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick prompts */}
        {messages.length <= 1 && (
          <div className="px-5 pb-2 flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => handleSend(p)}
                className="text-[11px] font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Composer */}
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask All Kiki's anything..."
              className="flex-1 bg-white/5 border border-white/10 focus:border-[#39FF14]/50 focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 transition-colors"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="flex-shrink-0 h-11 w-11 rounded-xl bg-[#39FF14] hover:brightness-110 disabled:opacity-40 flex items-center justify-center text-black transition-all cursor-pointer"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 text-[11px] text-neutral-600">
        <Sparkles className="h-3.5 w-3.5" />
        All Kiki's can update your settings when you ask — every change is shown to you for confirmation first.
      </div>
        </>
      )}

      {/* TAB: FAQ */}
      {helpTab === "faq" && (
        <div className="space-y-5">
          {/* Search + category filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                placeholder="Search help articles..."
                className="w-full bg-white/5 border border-white/10 focus:border-[#39FF14]/50 focus:outline-none rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-neutral-600 transition-colors"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto sm:overflow-visible">
              {FAQ_CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setFaqCategory(c)}
                  className={`flex-shrink-0 text-xs font-bold px-4 py-2.5 rounded-xl border transition-all cursor-pointer ${
                    faqCategory === c ? "bg-[#39FF14] text-black border-[#39FF14]" : "bg-white/5 text-neutral-400 border-white/10 hover:text-white hover:border-white/30"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* FAQ list */}
          <div className="space-y-1.5">
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((faq, idx) => {
                const isOpen = openFaqIdx === idx;
                return (
                  <div key={idx} className="glass-card rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
                      aria-expanded={isOpen}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex-shrink-0 text-[8px] font-black uppercase tracking-widest text-[#39FF14] bg-[#39FF14]/10 border border-[#39FF14]/20 px-1.5 py-0.5 rounded-full">
                          {faq.category}
                        </span>
                        <span className="font-semibold text-xs text-white truncate">{faq.q}</span>
                      </div>
                      <ChevronDown className={`h-3.5 w-3.5 text-neutral-500 flex-shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180 text-[#39FF14]" : ""}`} />
                    </button>
                    <div className="grid transition-all duration-300 ease-out" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}>
                      <div className="overflow-hidden">
                        <p className="px-4 pb-3 text-[11px] text-neutral-400 leading-relaxed">{faq.a}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-16 text-neutral-500">
                <HelpCircle className="h-10 w-10 text-neutral-700 mx-auto mb-3" />
                <p className="text-sm">No help articles match your search.</p>
              </div>
            )}
          </div>

          <div className="text-center pt-4">
            <p className="text-xs text-neutral-500 mb-3">Can't find what you're looking for?</p>
            <button
              onClick={() => setHelpTab("chat")}
              className="neon-btn inline-flex items-center gap-2 font-bold px-6 py-3 rounded-xl text-xs uppercase tracking-wide transition-all cursor-pointer"
            >
              <Bot className="h-4 w-4" />
              Ask All Kiki's AI
            </button>
          </div>
        </div>
      )}

      {/* TAB: CONTACT */}
      {helpTab === "contact" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">
          <div className="glass-card rounded-3xl p-6 sm:p-8">
            <h2 className="font-sans font-bold text-lg text-white mb-1.5">Contact Support</h2>
            <p className="text-xs text-neutral-500 mb-6">
              For anything the AI Help Desk or FAQ can't resolve, send our support team a message directly.
            </p>

            {contactSent ? (
              <div className="rounded-2xl accent-chip p-6 text-center">
                <Check className="h-8 w-8 text-[#22c55e] mx-auto mb-3" />
                <p className="text-sm font-bold text-white">Message sent!</p>
                <p className="text-xs text-neutral-400 mt-1">Our team will review it in the Admin Panel. We typically reply within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSendContact} className="space-y-4">
                {user ? (
                  <div className="flex items-center gap-2 text-xs text-neutral-500 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
                    <Mail className="h-3.5 w-3.5" />
                    Replying as <span className="text-white font-semibold">{user.email}</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Your Name</label>
                      <input
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Jane Doe"
                        required
                        className="w-full bg-white/5 border border-white/10 focus:border-[#22c55e]/50 focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Email</label>
                      <input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="w-full bg-white/5 border border-white/10 focus:border-[#22c55e]/50 focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 transition-colors"
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Subject</label>
                  <input
                    value={contactSubject}
                    onChange={(e) => setContactSubject(e.target.value)}
                    placeholder="What's this about?"
                    required
                    className="w-full bg-white/5 border border-white/10 focus:border-[#39FF14]/50 focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Message</label>
                  <textarea
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    placeholder="Describe your issue or question in detail..."
                    required
                    rows={6}
                    className="w-full bg-white/5 border border-white/10 focus:border-[#39FF14]/50 focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 transition-colors resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={contactBusy}
                  className="neon-btn w-full flex items-center justify-center gap-2 font-extrabold py-3.5 rounded-xl text-xs uppercase tracking-wide transition-all cursor-pointer disabled:opacity-60"
                >
                  {contactBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {contactBusy ? "Sending..." : "Send Message"}
                </button>
                {contactError && <p className="text-xs text-rose-400 font-semibold">{contactError}</p>}
              </form>
            )}
          </div>

          {/* Support info sidebar */}
          <div className="space-y-4">
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-2 text-[#39FF14] mb-2">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Response Time</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">Support tickets are typically answered within 24 hours. For instant answers, try the AI Help Desk.</p>
            </div>
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-2 text-[#39FF14] mb-2">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Playback Issues?</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">Try switching servers on the player first — most playback issues are resolved instantly that way.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
