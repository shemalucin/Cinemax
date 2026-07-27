import React, { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { AvatarRenderer } from "./AnimatedAvatar";
import { Movie } from "../types";
import { getImageUrl } from "../utils/tmdb";
import {
  MessageCircle,
  Send,
  Heart,
  Reply,
  X,
  Users,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Search,
  Bell,
  TrendingUp,
  Flame,
  Star,
  Play,
  Plus,
  UserPlus,
  Settings,
  Globe,
  Mic,
  ImagePlus,
  Smile,
  MoreVertical,
  Check,
  CheckCheck,
  Clock,
  Zap,
  Crown,
  Shield,
  Flag,
  Pin,
  Edit,
  Trash2,
  Share2,
  Gift,
  Trophy,
  Award,
  Sparkles,
  Bot,
  Film,
  Tv,
  Popcorn,
} from "lucide-react";

interface PremiumLiveChatProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  content: string;
  timestamp: Date;
  reactions?: { emoji: string; count: number; users: string[] }[];
  movie?: Movie;
  isPinned?: boolean;
  isEdited?: boolean;
  seenBy?: string[];
  replyTo?: string;
}

interface LiveActivity {
  id: string;
  type: "watching" | "rated" | "watchlist" | "party" | "badge" | "new_movie";
  user: string;
  avatar: string;
  target: string;
  timestamp: Date;
}

interface ChatRoom {
  id: string;
  name: string;
  icon: string;
  members: number;
  isActive: boolean;
}

export const PremiumLiveChat: React.FC<PremiumLiveChatProps> = ({ isOpen, onClose }) => {
  const { user, t, addToWatchlist, likeMovie } = useApp();
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"global" | "friends" | "ai" | "rooms">("global");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [activities, setActivities] = useState<LiveActivity[]>([]);
  const [onlineUsers, setOnlineUsers] = useState(127);
  const [nowWatching, setNowWatching] = useState(89);
  const [trendingMovie, setTrendingMovie] = useState<Movie | null>(null);
  const [serverStatus, setServerStatus] = useState<"online" | "degraded" | "offline">("online");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMovieCard, setShowMovieCard] = useState(false);
  const [detectedMovie, setDetectedMovie] = useState<Movie | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([
    { id: "action", name: "Action", icon: "🎬", members: 234, isActive: true },
    { id: "horror", name: "Horror", icon: "👻", members: 189, isActive: true },
    { id: "comedy", name: "Comedy", icon: "😂", members: 312, isActive: true },
    { id: "anime", name: "Anime", icon: "🎌", members: 456, isActive: true },
    { id: "marvel", name: "Marvel", icon: "🦸", members: 567, isActive: true },
    { id: "dc", name: "DC", icon: "⚡", members: 234, isActive: true },
    { id: "tv", name: "TV Shows", icon: "📺", members: 445, isActive: true },
    { id: "scifi", name: "Sci-Fi", icon: "🚀", members: 321, isActive: true },
    { id: "romance", name: "Romance", icon: "💕", members: 289, isActive: true },
    { id: "african", name: "African Movies", icon: "🌍", members: 156, isActive: true },
  ]);
  const [onlineFriends, setOnlineFriends] = useState([
    { id: "1", name: "Sarah", avatar: "cartoon:orion", status: "online" },
    { id: "2", name: "John", avatar: "cartoon:sparkles", status: "watching" },
    { id: "3", name: "Emma", avatar: "cartoon:star", status: "online" },
    { id: "4", name: "Mike", avatar: "cartoon:heart", status: "away" },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Simulated live activities
  useEffect(() => {
    const activityTypes: LiveActivity["type"][] = ["watching", "rated", "watchlist", "party", "badge", "new_movie"];
    const users = ["Sarah", "John", "Emma", "Mike", "Alex", "Lisa", "David", "Sophie"];
    const movies = ["Superman (2025)", "F1 Movie", "Avatar", "Mission: Impossible", "Dune 2", "Oppenheimer"];
    const avatars = ["cartoon:orion", "cartoon:sparkles", "cartoon:star", "cartoon:heart"];

    const interval = setInterval(() => {
      const randomActivity: LiveActivity = {
        id: Date.now().toString(),
        type: activityTypes[Math.floor(Math.random() * activityTypes.length)],
        user: users[Math.floor(Math.random() * users.length)],
        avatar: avatars[Math.floor(Math.random() * avatars.length)],
        target: movies[Math.floor(Math.random() * movies.length)],
        timestamp: new Date(),
      };
      setActivities((prev) => [randomActivity, ...prev].slice(0, 8));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Simulated trending movie
  useEffect(() => {
    setTrendingMovie({
      id: 1,
      title: "Superman (2025)",
      poster_path: "/poster.jpg",
      vote_average: 8.5,
      genres: [{ id: 28, name: "Action" }],
      release_date: "2025-07-25",
    } as Movie);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !user) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      userId: user.id,
      username: user.name || "User",
      avatar: user.avatar || "cartoon:orion",
      content: newMessage,
      timestamp: new Date(),
      reactions: [],
    };

    setMessages((prev) => [...prev, message]);
    setNewMessage("");
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleReaction = (messageId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId) {
          const existingReaction = msg.reactions?.find((r) => r.emoji === emoji);
          if (existingReaction) {
            return {
              ...msg,
              reactions: msg.reactions?.map((r) =>
                r.emoji === emoji
                  ? { ...r, count: r.count + 1, users: [...r.users, user?.id || ""] }
                  : r
              ),
            };
          } else {
            return {
              ...msg,
              reactions: [
                ...(msg.reactions || []),
                { emoji, count: 1, users: [user?.id || ""] },
              ],
            };
          }
        }
        return msg;
      })
    );
  };

  const formatActivityText = (activity: LiveActivity) => {
    switch (activity.type) {
      case "watching":
        return `started watching ${activity.target}`;
      case "rated":
        return `rated ${activity.target} ★★★★★`;
      case "watchlist":
        return `added ${activity.target} to Watchlist`;
      case "party":
        return `created a Watch Party`;
      case "badge":
        return `unlocked the "Movie Master" badge`;
      case "new_movie":
        return `A new movie was added: ${activity.target}`;
      default:
        return "did something";
    }
  };

  const getActivityIcon = (type: LiveActivity["type"]) => {
    switch (type) {
      case "watching":
        return <Play className="h-3 w-3 text-[#39FF14]" />;
      case "rated":
        return <Star className="h-3 w-3 text-amber-400" />;
      case "watchlist":
        return <Heart className="h-3 w-3 text-rose-400" />;
      case "party":
        return <Users className="h-3 w-3 text-blue-400" />;
      case "badge":
        return <Award className="h-3 w-3 text-purple-400" />;
      case "new_movie":
        return <Film className="h-3 w-3 text-[#39FF14]" />;
      default:
        return <Sparkles className="h-3 w-3 text-neutral-400" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 transition-all duration-300 ${
        isFullscreen ? "bg-black/90" : "bg-black/60 backdrop-blur-sm"
      }`}
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-6xl h-[85vh] rounded-3xl overflow-hidden transition-all duration-300 ${
          isMinimized ? "h-16" : "h-[85vh]"
        }`}
        style={{
          background: 'linear-gradient(135deg, rgba(18,18,24,0.95), rgba(10,10,14,0.98))',
          backdropFilter: 'blur(40px)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 25px 80px rgba(0,0,0,0.8), 0 0 60px rgba(57,255,20,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-none border-b border-white/10 bg-gradient-to-r from-[#39FF14]/5 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-[#39FF14]" />
                <h2 className="text-lg font-bold text-white">Live Chat</h2>
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#39FF14] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#39FF14]" />
                </div>
              </div>

              {/* Live Stats */}
              <div className="hidden md:flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 text-neutral-400">
                  <Users className="h-3.5 w-3.5 text-[#39FF14]" />
                  <span className="text-white font-semibold">{onlineUsers}</span>
                  <span>online</span>
                </div>
                <div className="flex items-center gap-1.5 text-neutral-400">
                  <Play className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-white font-semibold">{nowWatching}</span>
                  <span>watching</span>
                </div>
                <div className="flex items-center gap-1.5 text-neutral-400">
                  <Flame className="h-3.5 w-3.5 text-orange-400" />
                  <span className="text-white font-semibold truncate max-w-[150px]">
                    {trendingMovie?.title}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-neutral-400">
                  <div className={`h-2 w-2 rounded-full ${serverStatus === "online" ? "bg-green-500" : "bg-yellow-500"}`} />
                  <span className="text-white">{serverStatus}</span>
                </div>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-white/10 transition-colors text-neutral-400 hover:text-white">
                <Search className="h-4 w-4" />
              </button>
              <button className="p-2 rounded-lg hover:bg-white/10 transition-colors text-neutral-400 hover:text-white">
                <Bell className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors text-neutral-400 hover:text-white"
              >
                {isMinimized ? <ChevronUp className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors text-neutral-400 hover:text-white"
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors text-neutral-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {(["global", "friends", "ai", "rooms"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all capitalize ${
                  activeTab === tab
                    ? "bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {tab === "ai" ? (
                  <span className="flex items-center gap-1.5">
                    <Bot className="h-3.5 w-3.5" />
                    AI Assistant
                  </span>
                ) : tab === "rooms" ? (
                  <span className="flex items-center gap-1.5">
                    <Tv className="h-3.5 w-3.5" />
                    Movie Rooms
                  </span>
                ) : (
                  tab
                )}
              </button>
            ))}
          </div>
        </div>

        {!isMinimized && (
          <div className="flex flex-1 overflow-hidden">
            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Live Activity Feed */}
              <div className="flex-none border-b border-white/5 bg-black/20 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-3.5 w-3.5 text-[#39FF14]" />
                  <span className="text-xs font-bold text-white">Live Activity</span>
                </div>
                <div className="space-y-2 max-h-24 overflow-y-auto">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-2 text-xs">
                      <AvatarRenderer avatarKey={activity.avatar} size={20} />
                      <span className="text-neutral-400">{activity.user}</span>
                      <span className="text-neutral-500">{formatActivityText(activity)}</span>
                      {getActivityIcon(activity.type)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.userId === user?.id ? "flex-row-reverse" : ""}`}
                  >
                    <AvatarRenderer avatarKey={message.avatar} size={36} />
                    <div className={`flex-1 ${message.userId === user?.id ? "text-right" : ""}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-white">{message.username}</span>
                        <span className="text-[10px] text-neutral-500">
                          {timeAgo(message.timestamp)}
                        </span>
                        {message.isPinned && <Pin className="h-3 w-3 text-[#39FF14]" />}
                        {message.isEdited && <Edit className="h-3 w-3 text-neutral-500" />}
                      </div>
                      <div
                        className={`inline-block rounded-2xl px-4 py-2 max-w-md ${
                          message.userId === user?.id
                            ? "bg-[#39FF14]/10 border border-[#39FF14]/30"
                            : "bg-white/5 border border-white/10"
                        }`}
                      >
                        <p className="text-sm text-neutral-200">{message.content}</p>
                      </div>
                      {message.reactions && message.reactions.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {message.reactions.map((reaction, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleReaction(message.id, reaction.emoji)}
                              className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition-colors"
                            >
                              {reaction.emoji} {reaction.count}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="flex-none border-t border-white/10 p-4">
                <div className="flex items-center gap-2">
                  <button className="p-2 rounded-lg hover:bg-white/10 transition-colors text-neutral-400 hover:text-white">
                    <Smile className="h-5 w-5" />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-white/10 transition-colors text-neutral-400 hover:text-white">
                    <ImagePlus className="h-5 w-5" />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-white/10 transition-colors text-neutral-400 hover:text-white">
                    <Mic className="h-5 w-5" />
                  </button>
                  <input
                    ref={inputRef}
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message... (use @ to mention)"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#39FF14]/50 transition-colors"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    className="p-3 rounded-xl bg-gradient-to-r from-[#39FF14] to-[#31dd11] text-black font-semibold hover:shadow-[0_0_20px_rgba(57,255,20,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
                {/* Quick Reactions */}
                <div className="flex gap-2 mt-2">
                  {["❤️", "🔥", "😂", "😮", "👏", "🎉"].map((emoji) => (
                    <button
                      key={emoji}
                      className="text-lg hover:scale-125 transition-transform"
                      title={`React with ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="hidden lg:block w-72 border-l border-white/10 overflow-y-auto">
              {/* Trending Movies */}
              <div className="p-4 border-b border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-[#39FF14]" />
                  <span className="text-sm font-bold text-white">Trending Movies</span>
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-3 items-center">
                      <div className="w-12 h-16 rounded-lg bg-neutral-800 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">Movie Title {i}</p>
                        <p className="text-[10px] text-neutral-500">Action • 2024</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                          <span className="text-[10px] text-neutral-400">8.5</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Online Friends */}
              <div className="p-4 border-b border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-bold text-white">Online Friends</span>
                  <span className="text-xs text-[#39FF14]">{onlineFriends.length}</span>
                </div>
                <div className="space-y-2">
                  {onlineFriends.map((friend) => (
                    <div key={friend.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                      <div className="relative">
                        <AvatarRenderer avatarKey={friend.avatar} size={32} />
                        <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0a0a0e] ${
                          friend.status === "online" ? "bg-green-500" : 
                          friend.status === "watching" ? "bg-blue-500" : "bg-yellow-500"
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{friend.name}</p>
                        <p className="text-[10px] text-neutral-500 capitalize">{friend.status}</p>
                      </div>
                      <button className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-neutral-400 hover:text-white">
                        <UserPlus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Movie Rooms */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Tv className="h-4 w-4 text-purple-400" />
                  <span className="text-sm font-bold text-white">Movie Rooms</span>
                </div>
                <div className="space-y-2">
                  {rooms.map((room) => (
                    <button
                      key={room.id}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                    >
                      <span className="text-xl">{room.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{room.name}</p>
                        <p className="text-[10px] text-neutral-500">{room.members} members</p>
                      </div>
                      {room.isActive && <div className="h-2 w-2 rounded-full bg-[#39FF14]" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const sec = Math.max(1, Math.floor(diffMs / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
