import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { AvatarRenderer } from "./AnimatedAvatar";
import { getImageUrl, tmdb } from "../utils/tmdb";
import * as chatApi from "../utils/chatApi";
import type { ChatMessage } from "../utils/chatApi";
import { Movie } from "../types";
import { UserListSidebar } from "./UserListSidebar";
import {
  MessageCircle, Send, Heart, Reply, X, Users, Search,
  Play, Plus, Flame, Star, Mic, ImagePlus, Smile, MoreVertical,
  CheckCheck, Zap, Crown, Shield, Flag, Pin, Edit, Trash2,
  Share2, Gift, Trophy, Award, Sparkles, Bot, Film, Tv, Popcorn,
  ChevronRight, Volume2, VolumeX, ArrowLeft, Bell, Hash,
  ThumbsUp, MessageSquare, AlertCircle, Loader2, Globe,
  PictureInPicture, TrendingUp, Clock, Check,
} from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.max(1, Math.floor(diffMs / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

async function api(path: string, options?: RequestInit): Promise<any> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

// ─── constants ───────────────────────────────────────────────────────────────

const NEON = "#39FF14";

const MOVIE_ROOMS = [
  { id: "global",       name: "All Chat",       icon: "💬", color: "#39FF14" },
  { id: "action",       name: "Action",          icon: "🎬", color: "#ef4444" },
  { id: "horror",       name: "Horror",          icon: "👻", color: "#8b5cf6" },
  { id: "comedy",       name: "Comedy",          icon: "😂", color: "#f59e0b" },
  { id: "anime",        name: "Anime",           icon: "🎌", color: "#ec4899" },
  { id: "marvel",       name: "Marvel",          icon: "🦸", color: "#ef4444" },
  { id: "dc",           name: "DC",              icon: "⚡", color: "#3b82f6" },
  { id: "scifi",        name: "Sci-Fi",          icon: "🚀", color: "#06b6d4" },
  { id: "romance",      name: "Romance",         icon: "💕", color: "#f43f5e" },
  { id: "african",      name: "African Movies",  icon: "🌍", color: "#22c55e" },
  { id: "tv",           name: "TV Shows",        icon: "📺", color: "#a855f7" },
];

const QUICK_REACTIONS = ["❤️", "🔥", "😂", "😮", "👏", "🎉", "💯", "⭐"];

// Expanded, categorized emoji set for the chat emoji picker.
const EMOJI_CATEGORIES: { label: string; icon: string; emojis: string[] }[] = [
  {
    label: "Smileys",
    icon: "😀",
    emojis: [
      "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩",
      "😘","😗","😚","😙","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨",
      "😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕",
      "🤢","🤮","🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","😎","🤓","🧐","😕","😟","🙁",
      "😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞",
      "😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","🤡","👻","👽","🤖",
    ],
  },
  {
    label: "Gestures",
    icon: "👍",
    emojis: [
      "👍","👎","👊","✊","🤛","🤜","🤞","✌️","🤟","🤘","👌","🤏","👈","👉","👆","👇",
      "☝️","✋","🤚","🖐️","🖖","👋","🤙","💪","🦾","🙏","👏","🙌","🤝","🤲","👐","🤲",
    ],
  },
  {
    label: "Hearts",
    icon: "❤️",
    emojis: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖",
      "💘","💝","💟","♥️","💯","💢","💥","💫","💦","💨",
    ],
  },
  {
    label: "Movie Night",
    icon: "🎬",
    emojis: [
      "🎬","🍿","🎥","📽️","🎞️","🎭","🎫","🎪","🍫","🥤","🕹️","🎮","🎧","🎵","🎶","🎤",
      "🦸","🦹","👑","🏆","🥇","⭐","🌟","✨","🔥","💯","🚀","👾","🎯","🎨",
    ],
  },
  {
    label: "Animals",
    icon: "🐶",
    emojis: [
      "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈",
      "🙉","🙊","🐔","🐧","🐦","🦄","🐴","🦋","🐝","🐢","🐍","🐙","🦀","🐬","🐳","🦖",
    ],
  },
  {
    label: "Food",
    icon: "🍕",
    emojis: [
      "🍕","🍔","🌭","🍟","🌮","🌯","🥗","🍝","🍜","🍱","🍣","🍩","🍪","🍰","🎂","🍫",
      "🍬","🍭","🍿","🥤","🧋","☕","🍺","🍷","🥂","🍹",
    ],
  },
];

const ALL_EMOJIS = EMOJI_CATEGORIES.flatMap((c) => c.emojis);

const COMMUNITY_STATS = [
  { label: "Online Users",   value: "—", icon: "👥", key: "online"   },
  { label: "Messages Today", value: "—", icon: "💬", key: "messages" },
  { label: "Watch Parties",  value: "3", icon: "🎬", key: "parties"  },
  { label: "Reviews",        value: "47", icon: "⭐", key: "reviews" },
];

// ─── types ───────────────────────────────────────────────────────────────────

interface ActivityItem {
  id: string;
  icon: string;
  text: string;
  createdAt: string;
}

interface OnlineUser {
  id: string;
  name: string;
  avatar: string;
  status: "online" | "away";
  currentView?: string;
  currentMovieTitle?: string;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

// Activity ticker at top
const ActivityTicker: React.FC<{ items: ActivityItem[] }> = ({ items }) => {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (items.length === 0) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % Math.max(1, items.length)), 4000);
    return () => clearInterval(id);
  }, [items.length]);

  const defaultItems: ActivityItem[] = [
    { id: "d1", icon: "🎬", text: "Sarah started watching Superman (2025)", createdAt: new Date().toISOString() },
    { id: "d2", icon: "⭐", text: "John rated F1 Movie ★★★★★", createdAt: new Date().toISOString() },
    { id: "d3", icon: "❤️", text: "Emma added Avatar to her Watchlist", createdAt: new Date().toISOString() },
    { id: "d4", icon: "👥", text: "Mike created a Watch Party", createdAt: new Date().toISOString() },
    { id: "d5", icon: "🏆", text: "Alex unlocked the \"Movie Master\" badge", createdAt: new Date().toISOString() },
  ];

  const feed = items.length > 0 ? items : defaultItems;

  return (
    <div
      className="flex-none border-b border-white/5 bg-gradient-to-r from-black/60 via-[#0a0e0a]/80 to-black/60 px-4 py-2 overflow-hidden"
      style={{ backdropFilter: "blur(12px)" }}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 flex-none">
          <Zap className="h-3.5 w-3.5 text-[#39FF14]" />
          <span className="text-[11px] font-black uppercase tracking-widest text-[#39FF14]">Live Activity</span>
        </div>
        <div className="flex-1 flex gap-6 overflow-x-auto no-scrollbar">
          {feed.slice(0, 6).map((item, i) => (
            <div
              key={item.id}
              className="flex items-center gap-2 text-[11px] whitespace-nowrap flex-none"
              style={{ opacity: i === idx % feed.length ? 1 : 0.45, transition: "opacity 0.5s" }}
            >
              <span>{item.icon}</span>
              <span className="text-neutral-300">{item.text}</span>
              <span className="text-neutral-600">{timeAgo(item.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Smart movie card inside chat
const MovieChatCard: React.FC<{ movie: NonNullable<ChatMessage["sharedMovie"]>; onWatchNow?: () => void }> = ({ movie, onWatchNow }) => (
  <div
    className="mt-2 rounded-2xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-sm max-w-xs"
    style={{ boxShadow: "0 4px 24px rgba(57,255,20,0.08)" }}
  >
    <div className="flex gap-3 p-3">
      {movie.poster_path ? (
        <img
          src={getImageUrl(movie.poster_path, "w92")}
          alt={movie.title}
          className="w-14 h-20 object-cover rounded-xl flex-none"
        />
      ) : (
        <div className="w-14 h-20 bg-neutral-800 rounded-xl flex items-center justify-center flex-none">
          <Film className="h-6 w-6 text-neutral-600" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-white truncate">{movie.title}</p>
        <div className="flex items-center gap-1 mt-1">
          <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
          <span className="text-[10px] text-neutral-400">{movie.vote_average?.toFixed(1)}</span>
          {movie.genres && movie.genres.length > 0 && (
            <>
              <span className="text-neutral-600">·</span>
              <span className="text-[10px] text-neutral-400 truncate">{movie.genres[0]}</span>
            </>
          )}
        </div>
        {movie.overview && (
          <p className="text-[10px] text-neutral-500 mt-1 line-clamp-2">{movie.overview}</p>
        )}
        <div className="flex gap-1.5 mt-2">
          <button
            onClick={onWatchNow}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#39FF14] text-black text-[10px] font-bold hover:bg-[#31dd11] transition-colors"
          >
            <Play className="h-2.5 w-2.5" />
            Watch Now
          </button>
          <button className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 text-white text-[10px] font-semibold hover:bg-white/20 transition-colors">
            <Film className="h-2.5 w-2.5" />
            Trailer
          </button>
        </div>
      </div>
    </div>
  </div>
);

// Single message bubble
interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  onReply: (m: ChatMessage) => void;
  onLike: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
  onEdit: (m: ChatMessage) => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
  myId?: string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message, isOwn, onReply, onLike, onReact, onEdit, onDelete, onPin, myId,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const canEdit = isOwn;
  const canDelete = isOwn;

  const reactions = message.reactions || {};
  const hasReactions = Object.keys(reactions).length > 0;

  return (
    <div
      className={`group flex gap-3 mb-3 ${isOwn ? "flex-row-reverse" : ""}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowReactions(false); }}
    >
      {/* Avatar */}
      <div className="flex-none relative">
        <div className="rounded-full overflow-hidden border border-white/10" style={{ width: 36, height: 36 }}>
          <AvatarRenderer value={message.userAvatar} size={36} initials={message.userName?.[0]?.toUpperCase() || "?"} />
        </div>
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0a0a0e] bg-[#39FF14]"
          style={{ boxShadow: "0 0 6px #39FF14" }}
        />
      </div>

      <div className={`flex-1 min-w-0 ${isOwn ? "flex flex-col items-end" : ""}`}>
        {/* Name + time */}
        <div className={`flex items-center gap-2 mb-1 ${isOwn ? "flex-row-reverse" : ""}`}>
          <span className="text-[11px] font-bold text-white">{message.userName}</span>
          <span className="text-[10px] text-neutral-600">{timeAgo(message.createdAt)}</span>
          {message.editedAt && <span className="text-[9px] text-neutral-600 italic">(edited)</span>}
        </div>

        {/* Bubble */}
        <div
          className={`relative inline-block rounded-2xl px-4 py-2.5 max-w-sm transition-all ${
            isOwn
              ? "bg-gradient-to-br from-[#39FF14]/15 to-[#39FF14]/5 border border-[#39FF14]/30 rounded-tr-sm"
              : "bg-white/5 border border-white/10 rounded-tl-sm"
          }`}
          style={isOwn ? { boxShadow: "0 0 20px rgba(57,255,20,0.06)" } : {}}
        >
          {/* Quote / Reply */}
          {message.quoteMessageId && (
            <div className="mb-2 px-2 py-1 rounded-lg bg-white/5 border-l-2 border-[#39FF14]/50 text-[10px] text-neutral-400 italic">
              Replying to a message
            </div>
          )}

          {/* Image */}
          {message.mediaUrl && message.mediaType === "image" && (
            <img
              src={message.mediaUrl}
              alt="Attachment"
              className="rounded-xl max-w-[200px] mb-2 block cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setLightboxImage(message.mediaUrl)}
            />
          )}

          {/* Audio */}
          {message.mediaUrl && message.mediaType === "audio" && (
            <div className="flex items-center gap-3 mb-2 p-3 rounded-2xl border border-white/10 relative overflow-hidden group transition-all duration-300 hover:border-[#39FF14]/30 hover:shadow-lg hover:shadow-[#39FF14]/10"
              style={{ 
                background: "linear-gradient(135deg, rgba(20,20,25,0.95) 0%, rgba(10,10,15,0.98) 100%)",
                width: "fit-content",
                minWidth: "200px"
              }}
            >
              {/* Shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shine" />
              
              <div className="relative flex items-center gap-3 z-10">
                {/* Play button */}
                <div className="relative">
                  <div className="absolute inset-0 bg-[#39FF14]/20 blur-xl rounded-full opacity-50 group-hover:opacity-75 transition-opacity" />
                  <button 
                    className="relative p-2.5 rounded-full bg-gradient-to-br from-[#39FF14] to-[#31dd11] text-black shadow-lg shadow-[#39FF14]/30 hover:shadow-[#39FF14]/50 transition-all duration-300 hover:scale-105"
                  >
                    <Play className="h-4 w-4 fill-current" />
                  </button>
                </div>
                
                {/* Audio player */}
                <audio 
                  src={message.mediaUrl} 
                  controls 
                  className="h-8 w-32 rounded-lg"
                  style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                />
              </div>
            </div>
          )}

          {/* Text */}
          {message.text && (
            <p className="text-sm text-neutral-200 leading-relaxed">{message.text}</p>
          )}

          {/* Shared movie card */}
          {message.sharedMovie && (
            <MovieChatCard movie={message.sharedMovie} />
          )}
        </div>

        {/* Reactions */}
        {hasReactions && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? "justify-end" : ""}`}>
            {Object.entries(reactions).map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => onReact(message.id, emoji)}
                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] border transition-colors ${
                  users.includes(myId || "")
                    ? "bg-[#39FF14]/10 border-[#39FF14]/40 text-[#39FF14]"
                    : "bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10"
                }`}
              >
                {emoji} {users.length}
              </button>
            ))}
          </div>
        )}

        {/* Like count */}
        {message.likeCount > 0 && (
          <button
            onClick={() => onLike(message.id)}
            className={`flex items-center gap-1 mt-1 text-[10px] transition-colors ${
              message.likedByMe ? "text-rose-400" : "text-neutral-600 hover:text-neutral-400"
            }`}
          >
            <Heart className={`h-3 w-3 ${message.likedByMe ? "fill-rose-400" : ""}`} />
            {message.likeCount}
          </button>
        )}

        {/* Action buttons (hover) */}
        {showActions && (
          <div
            className={`flex items-center gap-0.5 mt-1 ${isOwn ? "flex-row-reverse" : ""}`}
            style={{ animation: "fadeIn 0.15s ease" }}
          >
            <button
              onClick={() => onLike(message.id)}
              title="Like"
              className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${message.likedByMe ? "text-rose-400" : "text-neutral-500 hover:text-neutral-300"}`}
            >
              <Heart className={`h-3.5 w-3.5 ${message.likedByMe ? "fill-rose-400" : ""}`} />
            </button>
            <button
              onClick={() => onReply(message)}
              title="Reply"
              className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setShowReactions((v) => !v)}
              title="React"
              className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              <Smile className="h-3.5 w-3.5" />
            </button>
            {canEdit && (
              <button
                onClick={() => onEdit(message)}
                title="Edit"
                className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                <Edit className="h-3.5 w-3.5" />
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete(message.id)}
                title="Delete"
                className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-500 hover:text-rose-400 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => onPin(message.id)}
              title="Pin"
              className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              <Pin className="h-3.5 w-3.5" />
            </button>

            {/* Reaction picker */}
            {showReactions && (
              <div
                className={`absolute z-20 flex gap-1 p-2 rounded-2xl border border-white/10 bg-[#111] shadow-2xl ${
                  isOwn ? "right-0" : "left-0"
                }`}
                style={{ bottom: "calc(100% + 4px)" }}
              >
                {QUICK_REACTIONS.map((e) => (
                  <button
                    key={e}
                    onClick={() => { onReact(message.id, e); setShowReactions(false); }}
                    className="text-lg hover:scale-125 transition-transform"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// AI Assistant panel
const AIAssistantPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("Looking for a SCARY movie for your mood? Try **Hereditary (2018)** — a masterclass in dread. Or **Talk to Me (2023)** for something recent and terrifying.");
  const [loading, setLoading] = useState(false);
  const [mood, setMood] = useState<string | null>(null);

  const moods = [
    { label: "😊 Happy",    value: "happy" },
    { label: "😢 Sad",      value: "sad" },
    { label: "👻 Scary",    value: "scary" },
    { label: "❤️ Romantic", value: "romantic" },
  ];

  const handleAsk = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    try {
      const data = await api("/api/assistant", {
        method: "POST",
        body: JSON.stringify({ message: mood ? `I'm feeling ${mood}. ${q}` : q }),
      });
      setResponse(data.text || "I'm here to help you find the perfect movie!");
    } catch {
      setResponse("The AI assistant is momentarily unavailable. Please try again.");
    } finally {
      setLoading(false);
      setQuery("");
    }
  };

  const handleMoodRecommend = async (m: string) => {
    setMood(m);
    setLoading(true);
    try {
      const data = await api("/api/assistant", {
        method: "POST",
        body: JSON.stringify({ message: `Recommend me a great ${m} movie to watch right now. Keep it concise.` }),
      });
      setResponse(data.text || "Here's a recommendation for you!");
    } catch {
      setResponse("Could not load AI recommendation right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="absolute bottom-20 right-4 z-30 w-80 rounded-2xl border border-white/10 overflow-hidden shadow-2xl"
      style={{ background: "linear-gradient(135deg,rgba(18,18,24,0.98),rgba(10,14,10,0.98))", backdropFilter: "blur(40px)", boxShadow: "0 20px 60px rgba(0,0,0,0.8),0 0 40px rgba(57,255,20,0.08)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#39FF14]/10">
            <Bot className="h-4 w-4 text-[#39FF14]" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">Smart AI Assistant</p>
            <p className="text-[9px] text-[#39FF14]">MOVIEMASTER AI</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Response */}
      <div className="p-3">
        {loading ? (
          <div className="flex items-center gap-2 text-neutral-400">
            <Loader2 className="h-4 w-4 animate-spin text-[#39FF14]" />
            <span className="text-xs">Thinking...</span>
          </div>
        ) : (
          <p className="text-xs text-neutral-300 leading-relaxed">{response}</p>
        )}
      </div>

      {/* Mood buttons */}
      <div className="px-3 pb-2">
        <p className="text-[10px] text-neutral-500 mb-1.5">Recommend by mood:</p>
        <div className="flex flex-wrap gap-1">
          {moods.map((m) => (
            <button
              key={m.value}
              onClick={() => handleMoodRecommend(m.value)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-colors border ${
                mood === m.value
                  ? "bg-[#39FF14]/15 border-[#39FF14]/40 text-[#39FF14]"
                  : "bg-white/5 border-white/10 text-neutral-300 hover:border-white/20"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="p-3 pt-0 border-t border-white/5">
        <div className="flex gap-2 mt-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAsk(); }}
            placeholder="Ask the AI anything..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-[#39FF14]/40"
          />
          <button
            onClick={handleAsk}
            disabled={!query.trim() || loading}
            className="p-2 rounded-xl bg-[#39FF14] text-black hover:bg-[#31dd11] transition-colors disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Emoji Picker (redesigned: categorized, searchable, mobile bottom-sheet) ──
const EmojiPicker: React.FC<{ onPick: (emoji: string) => void; onClose: () => void }> = ({ onPick, onClose }) => {
  const [activeCategory, setActiveCategory] = useState(0);
  const [emojiSearch, setEmojiSearch] = useState("");

  const visibleEmojis = emojiSearch.trim()
    ? ALL_EMOJIS.filter((e) => e.includes(emojiSearch.trim()))
    : EMOJI_CATEGORIES[activeCategory].emojis;

  return (
    <>
      {/* Mobile backdrop — tap to close */}
      <div
        className="fixed inset-0 z-40 bg-black/50 sm:hidden"
        onClick={onClose}
      />

      <div
        className="
          fixed left-0 right-0 bottom-0 z-50 rounded-t-2xl border-t border-white/10
          sm:absolute sm:bottom-full sm:left-0 sm:right-auto sm:top-auto sm:mb-2 sm:rounded-2xl sm:border
          w-full sm:w-80 max-h-[60vh] sm:max-h-96 flex flex-col overflow-hidden shadow-2xl
        "
        style={{ background: "#121418" }}
      >
        {/* Header: search + close (close only really needed on mobile sheet) */}
        <div className="flex-none flex items-center gap-2 p-3 border-b border-white/5">
          <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            <Search className="h-3.5 w-3.5 text-neutral-500 flex-none" />
            <input
              autoFocus={false}
              value={emojiSearch}
              onChange={(e) => setEmojiSearch(e.target.value)}
              placeholder="Search emoji..."
              className="flex-1 min-w-0 bg-transparent text-xs text-white placeholder-neutral-600 focus:outline-none"
            />
          </div>
          <button
            onClick={onClose}
            className="sm:hidden p-2 rounded-xl hover:bg-white/10 text-neutral-400 hover:text-white flex-none"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Category tabs */}
        {!emojiSearch.trim() && (
          <div className="flex-none flex gap-1 px-2 py-2 overflow-x-auto no-scrollbar border-b border-white/5">
            {EMOJI_CATEGORIES.map((cat, i) => (
              <button
                key={cat.label}
                onClick={() => setActiveCategory(i)}
                title={cat.label}
                className={`flex-none h-9 w-9 rounded-xl text-lg flex items-center justify-center transition-colors ${
                  activeCategory === i ? "bg-[#39FF14]/20 border border-[#39FF14]/40" : "hover:bg-white/10"
                }`}
              >
                {cat.icon}
              </button>
            ))}
          </div>
        )}

        {/* Emoji grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {visibleEmojis.length === 0 ? (
            <p className="text-xs text-neutral-500 text-center py-8">No emoji found</p>
          ) : (
            <div className="grid grid-cols-7 sm:grid-cols-8 gap-1">
              {visibleEmojis.map((emoji, i) => (
                <button
                  key={`${emoji}-${i}`}
                  onClick={() => onPick(emoji)}
                  className="text-2xl sm:text-xl leading-none hover:scale-125 hover:bg-white/5 transition-transform rounded-lg p-1.5 sm:p-1 flex items-center justify-center"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ─── Main LiveChatPage ───────────────────────────────────────────────────────

interface LiveChatPageProps {
  sidebarCollapsed?: boolean;
}

export const LiveChatPage: React.FC<LiveChatPageProps> = ({ sidebarCollapsed = false }) => {
  const { user, isGuest, requireSignInPrompt, setCurrentView } = useApp();
  const isSignedIn = !!user && !isGuest;
  const myId = user?.id;

  // ── state ──
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [activeRoom, setActiveRoom] = useState("global");
  const [onlineCount, setOnlineCount] = useState(0);
  const [nowWatching, setNowWatching] = useState(0);
  const [trendingMovie, setTrendingMovie] = useState<{ title: string; poster_path: string; vote_average: number } | null>(null);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [recentChats, setRecentChats] = useState<Array<{ id: string; name: string; avatar: string; lastMessage?: string; timestamp?: string }>>([]);
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [detectedMovie, setDetectedMovie] = useState<Movie | null>(null);
  const [showAI, setShowAI] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [selectedDirectUser, setSelectedDirectUser] = useState<{ id: string; name: string; avatar: string } | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [pinnedMessages, setPinnedMessages] = useState<string[]>([]);
  const [movieSearchQuery, setMovieSearchQuery] = useState("");
  const [scrollingMovies, setScrollingMovies] = useState<Movie[]>([]);
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const scrollAnimationRef = useRef<NodeJS.Timeout | null>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Mobile panel states
  const [mobileLeftPanelOpen, setMobileLeftPanelOpen] = useState(false);
  const [mobileRightPanelOpen, setMobileRightPanelOpen] = useState(false);
  const [mobileAIPanelOpen, setMobileAIPanelOpen] = useState(false);

  // Filter scrolling movies based on search
  const filteredScrollingMovies = useMemo(() => {
    if (!movieSearchQuery.trim()) return scrollingMovies;
    const q = movieSearchQuery.toLowerCase();
    return scrollingMovies.filter(m => 
      (m.title || (m as any).name || "").toLowerCase().includes(q)
    );
  }, [scrollingMovies, movieSearchQuery]);

  // TMDB search handler with debounce
  const handleMovieSearch = async (query: string) => {
    setMovieSearchQuery(query);
    
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await tmdb.searchMulti(query);
        setSearchResults(results);
      } catch (error) {
        console.error("TMDB search error:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  };

  // Initialize scrolling movies from trending
  useEffect(() => {
    if (trendingMovies.length > 0) {
      setScrollingMovies(trendingMovies);
    }
  }, [trendingMovies]);

  // Elevator scroll animation - smooth continuous upward scrolling
  useEffect(() => {
    const scrollContainer = document.querySelector('.movie-scroll-container') as HTMLElement;
    if (!scrollContainer) return;

    let scrollPos = 0;
    const scrollSpeed = 0.5; // pixels per frame
    let animationFrameId: number;

    const animate = () => {
      scrollPos += scrollSpeed;
      
      // Reset when scrolled past the first card
      const firstCard = scrollContainer.querySelector('.movie-card') as HTMLElement;
      if (firstCard && scrollPos >= firstCard.offsetHeight + 12) { // 12 is gap-3
        scrollPos = 0;
        // Move first card to end
        setScrollingMovies(prev => {
          if (prev.length === 0) return prev;
          const [first, ...rest] = prev;
          return [...rest, first];
        });
      }
      
      scrollContainer.scrollTop = scrollPos;
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Handle movie card click
  const handleMovieClick = (movie: Movie) => {
    console.log("Play movie:", movie.title);
    // TODO: Implement movie/trailer playback
  };

  // Calculate member friends based on message exchange count (5+ messages)
  const memberFriends = useMemo(() => {
    if (!isSignedIn) return [];
    
    // Count messages between current user and each other user
    const messageCounts: Record<string, number> = {};
    
    messages.forEach(msg => {
      if (msg.userId !== user?.id) {
        messageCounts[msg.userId] = (messageCounts[msg.userId] || 0) + 1;
      }
    });
    
    // Filter users with 5+ message exchanges
    return onlineUsers
      .filter(user => (messageCounts[user.id] || 0) >= 5)
      .map(user => ({
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        messageCount: messageCounts[user.id] || 0
      }));
  }, [messages, onlineUsers, isSignedIn, user]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const clientIdRef = useRef(`client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isNearBottomRef = useRef(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── load initial data ──
  useEffect(() => {
    const load = async () => {
      try {
        const [msgData, meta] = await Promise.all([
          chatApi.getGlobalChatMessages(activeRoom === "global" ? undefined : activeRoom),
          chatApi.getChatMeta(),
        ]);
        setMessages(msgData.messages || []);
        setOnlineCount(meta.onlineCount || 0);
        setNowWatching(meta.nowWatchingCount || 0);
        if (meta.trendingMovie) setTrendingMovie(meta.trendingMovie);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }

      // Load trending movies for sidebar
      try {
        const trending = await tmdb.getTrendingMovies();
        setTrendingMovies(trending.slice(0, 5));
      } catch { /* silent */ }

      // Load online users
      try {
        const dir = await chatApi.getChatDirectory();
        setOnlineUsers(
          (dir.people || []).slice(0, 12).map((p: any) => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar || "",
            status: "online" as const,
          }))
        );
      } catch { /* silent */ }
    };

    setLoading(true);
    load();
  }, [activeRoom]);

  // ── SSE ──
  useEffect(() => {
    const es = chatApi.connectToChatStream(
      clientIdRef.current,
      (event, data) => {
        if (event === "presence") {
          const entries: any[] = data?.payload?.entries || [];
          const unique = new Set<string>();
          entries.forEach((e: any) => {
            if (e.userId) unique.add(e.userId);
            else if (e.guestId) unique.add(e.guestId);
          });
          setOnlineCount(unique.size);
          setOnlineUsers(
            entries.slice(0, 12).map((e: any) => ({
              id: e.userId || e.guestId || e.clientId,
              name: e.name,
              avatar: e.avatar || "",
              status: e.status as "online" | "away",
              currentMovieTitle: e.currentMovieTitle,
            }))
          );
        } else if (event === "global_message_created") {
          const msg: ChatMessage = data?.payload?.message || data?.message;
          if (!msg) return;
          const msgRoom = msg.roomId || "global";
          if (msgRoom !== activeRoom && !(activeRoom === "global" && !msg.roomId)) return;
          setMessages((prev) => [...prev.filter((m) => m.id !== msg.id), msg]);
        } else if (event === "global_message_updated") {
          const msg: ChatMessage = data?.payload?.message || data?.message;
          if (msg) setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
        } else if (event === "global_message_deleted") {
          const mid = data?.payload?.messageId || data?.messageId;
          if (mid) setMessages((prev) => prev.filter((m) => m.id !== mid));
        } else if (event === "typing") {
          const entries: any[] = data?.payload?.entries || [];
          setTypingUsers(
            entries
              .filter((e: any) => e.scope === "global" && (e.roomId === activeRoom || (!e.roomId && activeRoom === "global")) && e.userId !== myId)
              .map((e: any) => e.name)
              .slice(0, 3)
          );
        } else if (event === "activity") {
          const items: ActivityItem[] = data?.payload?.items || [];
          if (items.length > 0) setActivityItems(items);
        } else if (event === "chat_meta_updated") {
          const meta = data?.payload || {};
          if (meta.onlineCount != null) setOnlineCount(meta.onlineCount);
          if (meta.nowWatchingCount != null) setNowWatching(meta.nowWatchingCount);
          if (meta.trendingMovie) setTrendingMovie(meta.trendingMovie);
        }
      }
    );

    // Update presence
    chatApi.updatePresence({
      clientId: clientIdRef.current,
      status: "online",
      currentView: "live-chat",
      panelOpen: true,
      ...(user ? { name: user.name, avatar: user.avatar } : { name: "Guest" }),
    } as any).catch(() => {});

    return () => {
      es.close();
      chatApi.updatePresence({ clientId: clientIdRef.current, status: "away", panelOpen: false } as any).catch(() => {});
    };
  }, [activeRoom, myId]);

  // ── auto scroll ──
  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  // ── movie detection ──
  const detectMovie = useCallback(async (text: string) => {
    const m = text.match(/@\[([^\]]+)\]/);
    if (!m) { setDetectedMovie(null); return; }
    try {
      const res = await tmdb.searchMulti(m[1]);
      const movie = res.results.find((r: any) => r.media_type === "movie" || r.media_type === "tv");
      setDetectedMovie(movie as Movie || null);
    } catch { setDetectedMovie(null); }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);
    detectMovie(val);

    // typing indicator
    if (!isSignedIn) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    chatApi.setTypingIndicator({
      clientId: clientIdRef.current,
      isTyping: true,
      scope: "global",
      roomId: activeRoom === "global" ? undefined : activeRoom,
    }).catch(() => {});
    typingTimerRef.current = setTimeout(() => {
      chatApi.setTypingIndicator({
        clientId: clientIdRef.current,
        isTyping: false,
        scope: "global",
      }).catch(() => {});
    }, 3000);
  };

  // ── send ──
  const handleSend = async () => {
    if (!isSignedIn) { requireSignInPrompt(); return; }
    const trimmed = inputText.trim();
    if (!trimmed && !pendingImage && !recordedAudio) return;
    setSending(true);
    setError("");
    try {
      await chatApi.sendGlobalChatMessage({
        text: trimmed,
        parentId: replyTo?.id || null,
        quoteMessageId: replyTo?.id || null,
        roomId: activeRoom === "global" ? undefined : activeRoom,
        mediaUrl: pendingImage || recordedAudio || undefined,
        mediaType: recordedAudio ? "audio" : (pendingImage ? "image" : undefined),
        sharedMovie: detectedMovie ? {
          id: detectedMovie.id,
          title: detectedMovie.title || (detectedMovie as any).name || "",
          poster_path: detectedMovie.poster_path || null,
          backdrop_path: detectedMovie.backdrop_path || null,
          vote_average: detectedMovie.vote_average || 0,
          media_type: (detectedMovie as any).media_type || "movie",
        } : undefined,
      });
      setInputText("");
      setPendingImage(null);
      setRecordedAudio(null);
      setReplyTo(null);
      setDetectedMovie(null);
      isNearBottomRef.current = true;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  // ── like/react ──
  const handleLike = async (id: string) => {
    if (!isSignedIn) { requireSignInPrompt(); return; }
    setMessages((prev) =>
      prev.map((m) => m.id === id ? { ...m, likedByMe: !m.likedByMe, likeCount: m.likeCount + (m.likedByMe ? -1 : 1) } : m)
    );
    try {
      const data = await chatApi.likeGlobalMessage(id);
      setMessages((prev) => prev.map((m) => m.id === id ? data.message : m));
    } catch { /* revert on next poll */ }
  };

  const handleReact = async (id: string, emoji: string) => {
    if (!isSignedIn) { requireSignInPrompt(); return; }
    try {
      const data = await chatApi.reactToGlobalMessage(id, emoji);
      setMessages((prev) => prev.map((m) => m.id === id ? data.message : m));
    } catch { /* silent */ }
  };

  // ── edit ──
  const handleEdit = (m: ChatMessage) => { setEditingId(m.id); setEditText(m.text); };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      const data = await chatApi.editGlobalMessage(editingId, editText);
      setMessages((prev) => prev.map((m) => m.id === editingId ? data.message : m));
    } catch { /* silent */ }
    setEditingId(null);
    setEditText("");
  };

  // ── delete ──
  const handleDelete = async (id: string) => {
    try {
      await chatApi.deleteGlobalMessage(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch { /* silent */ }
  };

  // ── pin ──
  const handlePin = (id: string) => {
    setPinnedMessages((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [id, ...prev]);
  };

  // ── image pick ──
  const handlePickImage = () => {
    if (!isSignedIn) { requireSignInPrompt(); return; }
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPendingImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ── AI Assistant ──
  const handleAiAsk = async () => {
    const q = aiQuery.trim();
    if (!q) return;
    setAiLoading(true);
    try {
      const data = await api("/api/assistant", {
        method: "POST",
        body: JSON.stringify({ message: q }),
      });
      setAiResponse(data.text || "I'm here to help you find the perfect movie!");
    } catch {
      setAiResponse("The AI assistant is momentarily unavailable. Please try again.");
    } finally {
      setAiLoading(false);
      setAiQuery("");
    }
  };

  // ── Emoji Picker ──
  const handleEmojiClick = (emoji: string) => {
    setInputText((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  // ── Voice Recording ──
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      setRecordingDuration(0);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudio(audioUrl);
        stream.getTracks().forEach(track => track.stop());
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      
      // Start duration timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Could not access microphone. Please allow microphone access.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordedAudio(null);
      setRecordingDuration(0);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ── filter ──
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter((m) =>
      m.text?.toLowerCase().includes(q) || m.userName?.toLowerCase().includes(q)
    );
  }, [messages, searchQuery]);

  const topLevel = filteredMessages.filter((m) => !m.parentId);

  const currentRoom = MOVIE_ROOMS.find((r) => r.id === activeRoom) || MOVIE_ROOMS[0];

  // ── online count label ──
  const onlineLabel = onlineCount > 0 ? onlineCount.toLocaleString() : "—";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col"
      style={{
        height: "100vh",
        background: "linear-gradient(180deg,#050507 0%,#08090d 60%,#050507 100%)",
        fontFamily: "'Inter',sans-serif",
      }}
    >
      {/* ── HEADER ── */}
      <header
        className="flex-none flex items-center gap-3 px-4 py-3 border-b border-white/5"
        style={{ background: "rgba(8,9,13,0.95)", backdropFilter: "blur(20px)" }}
      >
        {/* Back button */}
        <button
          onClick={() => setCurrentView("home")}
          className="p-2 rounded-xl hover:bg-white/10 text-neutral-400 hover:text-white transition-colors flex-none"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2 flex-none">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#39FF14] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#39FF14]" />
          </div>
          <MessageCircle className="h-5 w-5 text-[#39FF14]" />
          <h1 className="text-base font-black text-white">Live Chat</h1>
        </div>

        {/* Live stats */}
        <div className="hidden md:flex items-center gap-5 ml-2">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-[#39FF14]" />
            <span className="text-xs font-bold text-white">{onlineLabel}</span>
            <span className="text-xs text-neutral-500">online</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Play className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-xs font-bold text-white">{nowWatching > 0 ? nowWatching.toLocaleString() : "—"}</span>
            <span className="text-xs text-neutral-500">watching</span>
          </div>
          {trendingMovie && (
            <div className="flex items-center gap-1.5 max-w-[180px]">
              <Flame className="h-3.5 w-3.5 text-orange-400 flex-none" />
              <span className="text-xs text-white truncate font-semibold">{trendingMovie.title}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#39FF14]" />
            <span className="text-xs text-neutral-300 font-semibold">Premium</span>
          </div>
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 w-48">
          <Search className="h-3.5 w-3.5 text-neutral-500 flex-none" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            className="flex-1 bg-transparent text-xs text-white placeholder-neutral-600 focus:outline-none min-w-0"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-neutral-500 hover:text-white">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* AI button */}
        <button
          onClick={() => setShowAI((v) => !v)}
          className={`p-2 rounded-xl border transition-all ${showAI ? "bg-[#39FF14]/10 border-[#39FF14]/40 text-[#39FF14]" : "border-white/10 bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10"}`}
        >
          <Bot className="h-4 w-4" />
        </button>

        {/* Mobile toggle buttons */}
        <button
          onClick={() => setMobileLeftPanelOpen(true)}
          className="xl:hidden p-2 rounded-xl border border-white/10 bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10"
        >
          <Users className="h-4 w-4" />
        </button>
        <button
          onClick={() => setMobileRightPanelOpen(true)}
          className="xl:hidden p-2 rounded-xl border border-white/10 bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10"
        >
          <Film className="h-4 w-4" />
        </button>
      </header>

      {/* ── ACTIVITY TICKER ── */}
      <ActivityTicker items={activityItems} />

      {/* ── BODY ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT SIDEBAR: User List ── */}
        <UserListSidebar
          onlineUsers={onlineUsers}
          recentChats={recentChats}
          onUserClick={(userId, userName, userAvatar) => {
            setSelectedDirectUser({ id: userId, name: userName, avatar: userAvatar });
            console.log("Start chat with user:", userId, userName);
          }}
          onSearchUser={(query) => {
            console.log("Search users:", query);
          }}
          onAddUser={() => {
            console.log("Add new user");
          }}
          sidebarCollapsed={sidebarCollapsed}
        />

        {/* ── LEFT SIDEBAR EXTENSION: Friends ── */}
        <aside
          className="hidden xl:flex flex-col w-56 flex-none border-l border-white/5 overflow-y-auto"
          style={{ background: "rgba(6,7,10,0.9)", scrollbarWidth: "thin", scrollbarColor: "#111 transparent" }}
        >
          <div className="p-4">
            <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-3">Friends</p>
            <div>
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="h-4 w-4 text-pink-400" />
                  <span className="text-sm font-bold text-white">Member Friends</span>
                  <span className="text-[10px] text-pink-400 ml-auto font-bold">{memberFriends.length}</span>
                </div>
                <div className="space-y-2">
                  {memberFriends.length === 0 ? (
                    <div className="text-center py-4">
                      <Heart className="h-6 w-6 text-neutral-700 mx-auto mb-2" />
                      <p className="text-xs text-neutral-500">Exchange 5+ messages with users to become friends</p>
                    </div>
                  ) : (
                    memberFriends.map((friend) => (
                      <div
                        key={friend.id}
                        onClick={() => setSelectedDirectUser({ id: friend.id, name: friend.name, avatar: friend.avatar })}
                        className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
                      >
                        <div className="relative flex-none">
                          <div className="rounded-full overflow-hidden" style={{ width: 32, height: 32 }}>
                            <AvatarRenderer value={friend.avatar} size={32} initials={friend.name?.[0]?.toUpperCase() || "?"} />
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#06070a] bg-pink-400 shadow-[0_0_6px_#ec4899]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{friend.name}</p>
                          <p className="text-[9px] text-pink-400 truncate">{friend.messageCount} messages exchanged</p>
                        </div>
                        <MessageSquare className="h-3.5 w-3.5 text-neutral-600 group-hover:text-pink-400 transition-colors" />
                      </div>
                    ))
                  )}
                </div>
              </div>
          </div>
        </aside>

        {/* ── MAIN CHAT ── */}
        <main className="flex flex-1 flex-col min-w-0 relative">
          {/* Room header */}
          <div
            className="flex-none flex items-center gap-3 px-4 py-2.5 border-b border-white/5"
            style={{ background: "rgba(8,9,13,0.8)" }}
          >
            {selectedDirectUser ? (
              <>
                <div className="relative">
                  <AvatarRenderer value={selectedDirectUser.avatar} size={32} initials={selectedDirectUser.name[0]?.toUpperCase() || "?"} />
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-[#39FF14] rounded-full border-2 border-[#08090d]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{selectedDirectUser.name}</p>
                  <p className="text-[10px] text-[#39FF14]">Direct Message</p>
                </div>
              </>
            ) : (
              <>
                <span className="text-lg">{currentRoom.icon}</span>
                <div>
                  <p className="text-sm font-bold text-white">{currentRoom.name}</p>
                  <p className="text-[10px] text-neutral-500">
                    {topLevel.length} messages
                    {typingUsers.length > 0 && (
                      <span className="text-[#39FF14] ml-2">
                        {typingUsers.slice(0, 2).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
                      </span>
                    )}
                  </p>
                </div>
              </>
            )}
            {selectedDirectUser && (
              <button
                onClick={() => setSelectedDirectUser(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <div className="flex-1" />
            {/* mobile AI button */}
            <button
              onClick={() => setShowAI((v) => !v)}
              className="sm:hidden p-2 rounded-xl border border-white/10 bg-white/5 text-neutral-400 hover:text-white"
            >
              <Bot className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-4"
            style={{ scrollbarWidth: "thin", scrollbarColor: "#1a1a1a transparent" }}
          >
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-[#39FF14]" />
                  <p className="text-sm text-neutral-500">Loading chat...</p>
                </div>
              </div>
            ) : topLevel.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div
                  className="p-5 rounded-2xl border border-white/5"
                  style={{ background: "rgba(57,255,20,0.03)" }}
                >
                  <MessageCircle className="h-12 w-12 text-neutral-700 mx-auto" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-neutral-400">No messages yet</p>
                  <p className="text-xs text-neutral-600 mt-1">Be the first to say something!</p>
                </div>
              </div>
            ) : (
              <div>
                {topLevel.map((msg) => (
                  <div key={msg.id}>
                    {/* Edit mode */}
                    {editingId === msg.id ? (
                      <div className="mb-3 p-3 rounded-2xl border border-[#39FF14]/30 bg-[#39FF14]/5">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full bg-transparent text-sm text-white focus:outline-none resize-none"
                          rows={2}
                          autoFocus
                        />
                        <div className="flex gap-2 mt-2">
                          <button onClick={handleSaveEdit} className="px-3 py-1 rounded-lg bg-[#39FF14] text-black text-xs font-bold">Save</button>
                          <button onClick={() => { setEditingId(null); setEditText(""); }} className="px-3 py-1 rounded-lg bg-white/10 text-white text-xs">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <MessageBubble
                        message={msg}
                        isOwn={msg.userId === myId}
                        onReply={setReplyTo}
                        onLike={handleLike}
                        onReact={handleReact}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onPin={handlePin}
                        myId={myId}
                      />
                    )}

                    {/* Replies */}
                    {filteredMessages
                      .filter((r) => r.parentId === msg.id)
                      .map((reply) => (
                        <div key={reply.id} className="ml-12 border-l-2 border-white/5 pl-3">
                          <MessageBubble
                            message={reply}
                            isOwn={reply.userId === myId}
                            onReply={setReplyTo}
                            onLike={handleLike}
                            onReact={handleReact}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onPin={handlePin}
                            myId={myId}
                          />
                        </div>
                      ))}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Detected movie preview */}
          {detectedMovie && (
            <div className="flex-none px-4 pb-2">
              <div className="flex items-center gap-2 p-2 rounded-xl border border-[#39FF14]/20 bg-[#39FF14]/5 text-xs">
                <Film className="h-4 w-4 text-[#39FF14] flex-none" />
                <span className="text-neutral-300">Sharing <strong className="text-white">{detectedMovie.title || (detectedMovie as any).name}</strong></span>
                <button onClick={() => setDetectedMovie(null)} className="ml-auto text-neutral-500 hover:text-white"><X className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          )}

          {/* Pending image */}
          {pendingImage && (
            <div className="flex-none px-4 pb-2">
              <div className="flex items-center gap-2 p-2 rounded-xl border border-white/10 bg-white/5">
                <img src={pendingImage} alt="" className="h-10 w-10 rounded-lg object-cover" />
                <span className="text-[11px] text-neutral-400 flex-1">Image ready to send</span>
                <button onClick={() => setPendingImage(null)} className="text-neutral-500 hover:text-white"><X className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          )}

          {/* Reply preview */}
          {replyTo && (
            <div className="flex-none px-4 pb-2">
              <div className="flex items-center gap-2 p-2 rounded-xl border-l-2 border-[#39FF14]/60 bg-[#39FF14]/5 text-xs">
                <Reply className="h-3.5 w-3.5 text-[#39FF14] flex-none" />
                <span className="text-neutral-400">Replying to <span className="text-white font-semibold">{replyTo.userName}</span></span>
                <span className="text-neutral-500 truncate flex-1">{replyTo.text}</span>
                <button onClick={() => setReplyTo(null)} className="text-neutral-500 hover:text-white flex-none"><X className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex-none px-4 pb-2">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                <AlertCircle className="h-3.5 w-3.5 flex-none" />
                {error}
                <button onClick={() => setError("")} className="ml-auto"><X className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          )}

          {/* ── INPUT ── */}
          <div
            className="flex-none border-t border-white/5 px-4 py-3"
            style={{ background: "rgba(8,9,13,0.9)" }}
          >
            {/* Quick emoji bar */}
            <div className="flex gap-2 mb-2 overflow-x-auto no-scrollbar">
              {QUICK_REACTIONS.map((e) => (
                <button key={e} className="text-base hover:scale-125 transition-transform flex-none" title={e}>
                  {e}
                </button>
              ))}
            </div>

            {/* Voice Recording Preview */}
            {recordedAudio && (
              <div className="flex items-center gap-3 mb-3 p-3 rounded-2xl border border-white/10 relative overflow-hidden group transition-all duration-300 hover:border-[#39FF14]/30 hover:shadow-lg hover:shadow-[#39FF14]/10"
                style={{ 
                  background: "linear-gradient(135deg, rgba(20,20,25,0.95) 0%, rgba(10,10,15,0.98) 100%)",
                  width: "fit-content",
                  minWidth: "200px"
                }}
              >
                {/* Shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shine" />
                
                <div className="relative flex items-center gap-3 z-10">
                  {/* Play button */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-[#39FF14]/20 blur-xl rounded-full opacity-50 group-hover:opacity-75 transition-opacity" />
                    <button 
                      className="relative p-2.5 rounded-full bg-gradient-to-br from-[#39FF14] to-[#31dd11] text-black shadow-lg shadow-[#39FF14]/30 hover:shadow-[#39FF14]/50 transition-all duration-300 hover:scale-105"
                    >
                      <Play className="h-4 w-4 fill-current" />
                    </button>
                  </div>
                  
                  {/* Audio player */}
                  <audio 
                    src={recordedAudio} 
                    controls 
                    className="h-8 w-32 rounded-lg"
                    style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                  />
                  
                  {/* Duration */}
                  <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10">
                    <span className="text-xs font-mono font-bold text-[#39FF14]">{formatDuration(recordingDuration)}</span>
                  </div>
                  
                  {/* Delete button */}
                  <button 
                    onClick={() => setRecordedAudio(null)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-red-400 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Image Preview */}
            {pendingImage && (
              <div className="mb-2 relative inline-block">
                <img src={pendingImage} alt="Preview" className="max-h-32 rounded-xl border border-white/10" />
                <button
                  onClick={() => setPendingImage(null)}
                  className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            <div className="flex items-end gap-2">
              {/* Media buttons */}
              <div className="flex gap-1 flex-none pb-1 relative">
                <button onClick={handlePickImage} title="Attach image" className="p-2 rounded-xl hover:bg-white/10 text-neutral-400 hover:text-white transition-colors">
                  <ImagePlus className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
                
                <button 
                  onClick={isRecording ? stopRecording : startRecording}
                  title={isRecording ? "Stop recording" : "Voice message"} 
                  className={`p-2 rounded-xl transition-colors ${isRecording ? "bg-red-500/20 text-red-400" : "hover:bg-white/10 text-neutral-400 hover:text-white"}`}
                >
                  <Mic className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
                </button>
                
                <button 
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  title="Emoji" 
                  className={`p-2 rounded-xl transition-colors ${showEmojiPicker ? "bg-[#39FF14]/20 text-[#39FF14]" : "hover:bg-white/10 text-neutral-400 hover:text-white"}`}
                >
                  <Smile className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
                </button>

                {/* Emoji Picker — categorized, searchable, mobile bottom-sheet */}
                {showEmojiPicker && (
                  <EmojiPicker
                    onPick={(emoji) => handleEmojiClick(emoji)}
                    onClose={() => setShowEmojiPicker(false)}
                  />
                )}
              </div>

              {/* Text input */}
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  isSignedIn
                    ? `Message ${currentRoom.name}... (use @[Movie Name] to share a movie)`
                    : "Sign in to join the conversation"
                }
                disabled={!isSignedIn}
                rows={1}
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#39FF14]/40 transition-colors resize-none leading-snug"
                style={{ maxHeight: 100, scrollbarWidth: "none" }}
              />

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={(!inputText.trim() && !pendingImage) || sending}
                className="p-3 rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-none"
                style={{
                  background: (inputText.trim() || pendingImage) && !sending
                    ? "linear-gradient(135deg,#39FF14,#31dd11)"
                    : "rgba(57,255,20,0.1)",
                  color: (inputText.trim() || pendingImage) && !sending ? "#000" : "#39FF14",
                  boxShadow: (inputText.trim() || pendingImage) && !sending ? "0 0 20px rgba(57,255,20,0.3)" : "none",
                }}
              >
                {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </div>

            {!isSignedIn && (
              <p className="text-center text-[11px] text-neutral-500 mt-2">
                <button onClick={requireSignInPrompt} className="text-[#39FF14] hover:underline">Sign in</button>{" "}
                to join the conversation
              </p>
            )}
          </div>
        </main>

        {/* ── RIGHT SIDEBAR: Movie Cards ── */}
        <aside
          className="hidden xl:flex flex-col w-72 flex-none border-l border-white/5 overflow-hidden"
          style={{ background: "rgba(6,7,10,0.9)" }}
        >
          <div className="p-4 flex-none">
            <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-3">Trending Movies</p>
            
            {/* Movie Search */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
              <Search className="h-3.5 w-3.5 text-neutral-500" />
              <input
                value={movieSearchQuery}
                onChange={(e) => handleMovieSearch(e.target.value)}
                placeholder="Search movies..."
                className="flex-1 bg-transparent text-xs text-white placeholder-neutral-600 focus:outline-none min-w-0"
              />
              {movieSearchQuery && (
                <button onClick={() => handleMovieSearch("")} className="text-neutral-500 hover:text-white">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Scrolling Movie Cards */}
          <div className="flex-1 overflow-hidden relative">
            <div className="absolute inset-0 overflow-y-auto no-scrollbar movie-scroll-container">
              <div className="p-4 space-y-3">
                {isSearching ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-6 w-6 text-neutral-500 mx-auto mb-2 animate-spin" />
                    <p className="text-xs text-neutral-500">Searching...</p>
                  </div>
                ) : movieSearchQuery.trim() && searchResults.length > 0 ? (
                  // Show TMDB search results
                  searchResults.map((movie, index) => (
                    <div
                      key={movie.id || index}
                      onClick={() => handleMovieClick(movie)}
                      className="movie-card group relative rounded-lg overflow-hidden cursor-pointer transition-all duration-500 hover:scale-[1.05] hover:shadow-lg hover:shadow-[#39FF14]/10"
                      style={{
                        animation: `fadeInUp 0.3s ease-out ${index * 0.05}s both`
                      }}
                    >
                      <div className="aspect-[2/3] relative">
                        <img
                          src={getImageUrl(movie.poster_path, "w500")}
                          alt={movie.title || (movie as any).name || ""}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <p className="text-[10px] font-bold text-white truncate mb-0.5">
                            {movie.title || (movie as any).name || ""}
                          </p>
                          <div className="flex items-center gap-1">
                            <Star className="h-2 w-2 text-yellow-400 fill-yellow-400" />
                            <span className="text-[8px] text-neutral-300">
                              {movie.vote_average?.toFixed(1) || "N/A"}
                            </span>
                          </div>
                        </div>
                        <div className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="h-3 w-3 text-white" />
                        </div>
                      </div>
                    </div>
                  ))
                ) : movieSearchQuery.trim() && searchResults.length === 0 ? (
                  <div className="text-center py-8">
                    <Film className="h-8 w-8 text-neutral-700 mx-auto mb-2" />
                    <p className="text-xs text-neutral-500">No movies found</p>
                  </div>
                ) : filteredScrollingMovies.length === 0 ? (
                  <div className="text-center py-8">
                    <Film className="h-8 w-8 text-neutral-700 mx-auto mb-2" />
                    <p className="text-xs text-neutral-500">No movies available</p>
                  </div>
                ) : (
                  // Show scrolling trending movies
                  filteredScrollingMovies.map((movie, index) => (
                    <div
                      key={movie.id || index}
                      onClick={() => handleMovieClick(movie)}
                      className="movie-card group relative rounded-lg overflow-hidden cursor-pointer transition-all duration-500 hover:scale-[1.05] hover:shadow-lg hover:shadow-[#39FF14]/10"
                      style={{
                        animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`
                      }}
                    >
                      <div className="aspect-[2/3] relative">
                        <img
                          src={getImageUrl(movie.poster_path, "w500")}
                          alt={movie.title || (movie as any).name || ""}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <p className="text-[10px] font-bold text-white truncate mb-0.5">
                            {movie.title || (movie as any).name || ""}
                          </p>
                          <div className="flex items-center gap-1">
                            <Star className="h-2 w-2 text-yellow-400 fill-yellow-400" />
                            <span className="text-[8px] text-neutral-300">
                              {movie.vote_average?.toFixed(1) || "N/A"}
                            </span>
                          </div>
                        </div>
                        <div className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="h-3 w-3 text-white" />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile Left Panel (User List + Friends) */}
      <div
        className={`fixed inset-0 z-40 xl:hidden transition-opacity duration-300 ${
          mobileLeftPanelOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileLeftPanelOpen(false)}
        />
        <div
          className={`absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-[#06070a] border-r border-white/10 transition-transform duration-300 ${
            mobileLeftPanelOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <p className="text-sm font-bold text-white">Users & Friends</p>
            <button
              onClick={() => setMobileLeftPanelOpen(false)}
              className="p-2 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="overflow-y-auto h-full">
            <UserListSidebar
              onlineUsers={onlineUsers}
              recentChats={recentChats}
              onUserClick={(userId, userName, userAvatar) => {
                setSelectedDirectUser({ id: userId, name: userName, avatar: userAvatar });
                setMobileLeftPanelOpen(false);
              }}
              onSearchUser={(query) => {
                console.log("Search users:", query);
              }}
              onAddUser={() => {
                console.log("Add new user");
              }}
              sidebarCollapsed={false}
            />
            <div className="p-4 border-t border-white/10">
              <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-3">Friends</p>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="h-4 w-4 text-pink-400" />
                  <span className="text-sm font-bold text-white">Member Friends</span>
                  <span className="text-[10px] text-pink-400 ml-auto font-bold">{memberFriends.length}</span>
                </div>
                <div className="space-y-2">
                  {memberFriends.length === 0 ? (
                    <div className="text-center py-4">
                      <Heart className="h-6 w-6 text-neutral-700 mx-auto mb-2" />
                      <p className="text-xs text-neutral-500">Exchange 5+ messages with users to become friends</p>
                    </div>
                  ) : (
                    memberFriends.map((friend) => (
                      <div
                        key={friend.id}
                        onClick={() => {
                          setSelectedDirectUser({ id: friend.id, name: friend.name, avatar: friend.avatar });
                          setMobileLeftPanelOpen(false);
                        }}
                        className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
                      >
                        <div className="relative flex-none">
                          <div className="rounded-full overflow-hidden" style={{ width: 32, height: 32 }}>
                            <AvatarRenderer value={friend.avatar} size={32} initials={friend.name?.[0]?.toUpperCase() || "?"} />
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#06070a] bg-pink-400 shadow-[0_0_6px_#ec4899]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{friend.name}</p>
                          <p className="text-[9px] text-pink-400 truncate">{friend.messageCount} messages exchanged</p>
                        </div>
                        <MessageSquare className="h-3.5 w-3.5 text-neutral-600 group-hover:text-pink-400 transition-colors" />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Right Panel (Movie Cards) */}
      <div
        className={`fixed inset-0 z-40 xl:hidden transition-opacity duration-300 ${
          mobileRightPanelOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileRightPanelOpen(false)}
        />
        <div
          className={`absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-[#06070a] border-l border-white/10 transition-transform duration-300 ${
            mobileRightPanelOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <p className="text-sm font-bold text-white">Movies</p>
            <button
              onClick={() => setMobileRightPanelOpen(false)}
              className="p-2 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 mb-4">
              <Search className="h-3.5 w-3.5 text-neutral-500" />
              <input
                value={movieSearchQuery}
                onChange={(e) => handleMovieSearch(e.target.value)}
                placeholder="Search movies..."
                className="flex-1 bg-transparent text-xs text-white placeholder-neutral-600 focus:outline-none min-w-0"
              />
              {movieSearchQuery && (
                <button onClick={() => handleMovieSearch("")} className="text-neutral-500 hover:text-white">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
              {isSearching ? (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 text-neutral-500 mx-auto mb-2 animate-spin" />
                  <p className="text-xs text-neutral-500">Searching...</p>
                </div>
              ) : movieSearchQuery.trim() && searchResults.length > 0 ? (
                searchResults.map((movie, index) => (
                  <div
                    key={movie.id || index}
                    onClick={() => {
                      handleMovieClick(movie);
                      setMobileRightPanelOpen(false);
                    }}
                    className="movie-card group relative rounded-lg overflow-hidden cursor-pointer transition-all duration-500 hover:scale-[1.05]"
                  >
                    <div className="aspect-[2/3] relative">
                      <img
                        src={getImageUrl(movie.poster_path, "w500")}
                        alt={movie.title || (movie as any).name || ""}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className="text-[10px] font-bold text-white truncate mb-0.5">
                          {movie.title || (movie as any).name || ""}
                        </p>
                        <div className="flex items-center gap-1">
                          <Star className="h-2 w-2 text-yellow-400 fill-yellow-400" />
                          <span className="text-[8px] text-neutral-300">
                            {movie.vote_average?.toFixed(1) || "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : movieSearchQuery.trim() && searchResults.length === 0 ? (
                <div className="text-center py-8">
                  <Film className="h-8 w-8 text-neutral-700 mx-auto mb-2" />
                  <p className="text-xs text-neutral-500">No movies found</p>
                </div>
              ) : filteredScrollingMovies.length === 0 ? (
                <div className="text-center py-8">
                  <Film className="h-8 w-8 text-neutral-700 mx-auto mb-2" />
                  <p className="text-xs text-neutral-500">No movies available</p>
                </div>
              ) : (
                filteredScrollingMovies.map((movie, index) => (
                  <div
                    key={movie.id || index}
                    onClick={() => {
                      handleMovieClick(movie);
                      setMobileRightPanelOpen(false);
                    }}
                    className="movie-card group relative rounded-lg overflow-hidden cursor-pointer transition-all duration-500 hover:scale-[1.05]"
                  >
                    <div className="aspect-[2/3] relative">
                      <img
                        src={getImageUrl(movie.poster_path, "w500")}
                        alt={movie.title || (movie as any).name || ""}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className="text-[10px] font-bold text-white truncate mb-0.5">
                          {movie.title || (movie as any).name || ""}
                        </p>
                        <div className="flex items-center gap-1">
                          <Star className="h-2 w-2 text-yellow-400 fill-yellow-400" />
                          <span className="text-[8px] text-neutral-300">
                            {movie.vote_average?.toFixed(1) || "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img 
              src={lightboxImage} 
              alt="Full preview" 
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-12 right-0 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-md"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}


      {/* fadeIn keyframe */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default LiveChatPage;
