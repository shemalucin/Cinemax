import React, { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { AvatarRenderer } from "./AnimatedAvatar";
import { Movie } from "../types";
import { getImageUrl, tmdb } from "../utils/tmdb";
import * as chatApi from "../utils/chatApi";
import {
  X,
  Users,
  Maximize2,
  Minimize2,
  Search,
  Star,
  Play,
  Plus,
  Globe,
  Film,
  MessageSquare,
  Trash2,
  Sparkles,
  Quote,
  Heart,
  Menu,
} from "lucide-react";

const NEON_GREEN = "#39FF14";

interface Message {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  parentId: string | null;
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
  mediaUrl?: string | null;
  mediaType?: "image" | "audio" | null;
  editedAt?: string | null;
  roomId?: string | null;
  quoteMessageId?: string | null;
  sharedMovie?: Movie | null;
  reactions?: Record<string, string[]>;
}

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
}

interface MovieRoom {
  id: string;
  name: string;
  movie: Movie;
  participants: number;
  watching: boolean;
}

interface PremiumChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function PremiumChatPanel({ isOpen: externalIsOpen, onClose }: PremiumChatPanelProps) {
  const { user } = useApp();
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState("global" as "global" | "friends" | "ai" | "rooms");
  const [messages, setMessages] = useState([] as Message[]);
  const [inputText, setInputText] = useState("");
  const [replyTo, setReplyTo] = useState(null as Message | null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null as OnlineUser | null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [nowWatchingCount, setNowWatchingCount] = useState(0);
  const [activityFeed, setActivityFeed] = useState([] as ActivityItem[]);
  const [trendingMovies, setTrendingMovies] = useState([] as Movie[]);
  const [onlineUsers, setOnlineUsers] = useState([] as OnlineUser[]);
  const [movieRooms, setMovieRooms] = useState([] as MovieRoom[]);
  const [detectedMovie, setDetectedMovie] = useState(null as Movie | null);
  const [aiMood, setAiMood] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarSection, setSidebarSection] = useState("trending" as "trending" | "online" | "rooms");
  
  const messagesEndRef = useRef(null as HTMLDivElement | null);
  const inputRef = useRef(null as HTMLTextAreaElement | null);
  const fileInputRef = useRef(null as HTMLInputElement | null);
  const clientIdRef = useRef(`client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (externalIsOpen && !isMinimized) {
      loadInitialData();
      connectToRealtime();
    }
  }, [externalIsOpen, isMinimized]);

  const loadInitialData = async () => {
    try {
      const [messagesData, meta] = await Promise.all([
        chatApi.getGlobalChatMessages(),
        chatApi.getChatMeta(),
      ]);
      setMessages(messagesData.messages || []);
      setOnlineCount(meta.onlineCount);
      setNowWatchingCount(meta.nowWatchingCount);

      const trending = await tmdb.getTrendingMovies();
      setTrendingMovies(trending.slice(0, 10));

      const directory = await chatApi.getChatDirectory();
      setOnlineUsers(directory.people.map((p: any) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        status: "online" as const,
      })));

      const conversations = await chatApi.getChatConversations();
      setActivityFeed(conversations.conversations.map((c: any) => ({
        id: c.userId,
        icon: "MessageSquare",
        text: `${c.userName} is online`,
        createdAt: c.lastMessageAt,
      })));
    } catch (error) {
      console.error("Error loading initial data:", error);
    }
  };

  const connectToRealtime = () => {
    const eventSource = chatApi.connectToChatStream(
      clientIdRef.current,
      (event, data) => {
        switch (event) {
          case "presence":
            setOnlineCount(data.onlineCount || onlineCount);
            break;
          case "global_message_created":
            setMessages(prev => [...prev, data.message]);
            break;
          case "global_message_updated":
            setMessages(prev => prev.map(m => m.id === data.message.id ? data.message : m));
            break;
          case "global_message_deleted":
            setMessages(prev => prev.filter(m => m.id !== data.messageId));
            break;
          case "activity":
            setActivityFeed(prev => [data, ...prev].slice(0, 20));
            break;
        }
      },
      (error) => console.error("SSE error:", error)
    );

    return () => eventSource.close();
  };

  const detectMovieInText = async (text: string) => {
    const movieMatch = text.match(/@\[(.*?)\]/);
    if (movieMatch) {
      const movieName = movieMatch[1];
      try {
        const searchResults = await tmdb.searchMulti(movieName);
        const movie = searchResults.results.find(r => r.media_type === "movie");
        if (movie) {
          setDetectedMovie(movie as Movie);
        }
      } catch (error) {
        console.error("Error detecting movie:", error);
      }
    } else {
      setDetectedMovie(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setInputText(text);
    detectMovieInText(text);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    try {
      const messageData: any = {
        text: inputText,
        parentId: replyTo?.id || null,
        quoteMessageId: replyTo?.id || null,
      };

      if (detectedMovie) {
        messageData.sharedMovie = detectedMovie;
      }

      const result = await chatApi.sendGlobalChatMessage(messageData);
      setMessages(prev => [...prev, result.message]);
      setInputText("");
      setReplyTo(null);
      setDetectedMovie(null);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleLikeMessage = async (messageId: string) => {
    try {
      const result = await chatApi.likeGlobalMessage(messageId);
      setMessages(prev => prev.map(m => m.id === messageId ? result.message : m));
    } catch (error) {
      console.error("Error liking message:", error);
    }
  };

  const handleReactToMessage = async (messageId: string, emoji: string) => {
    try {
      const result = await chatApi.reactToGlobalMessage(messageId, emoji);
      setMessages(prev => prev.map(m => m.id === messageId ? result.message : m));
    } catch (error) {
      console.error("Error reacting to message:", error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await chatApi.deleteGlobalMessage(messageId);
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getAiMoodSuggestion = () => {
    const moods = [
      "Feeling adventurous? Try an action movie!",
      "In the mood for romance? Check out these love stories.",
      "Want to laugh? Comedy movies await!",
      "Need a thrill? Horror movies for you!",
      "Feeling thoughtful? Dramas to inspire.",
    ];
    return moods[Math.floor(Math.random() * moods.length)];
  };

  if (!externalIsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`relative w-full max-w-6xl h-[85vh] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden flex flex-col transition-all duration-300 ${isMinimized ? "h-16" : ""}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-black/40 border-b border-gray-700 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-3 h-3 rounded-full bg-[#39FF14] animate-pulse" />
              <div className="absolute inset-0 w-3 h-3 rounded-full bg-[#39FF14] animate-ping opacity-75" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Live Chat</h2>
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {onlineCount} online
                </span>
                <span className="flex items-center gap-1">
                  <Play className="w-4 h-4" />
                  {nowWatchingCount} watching
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#39FF14] w-64"
              />
            </div>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5 text-gray-300" />
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              {isMinimized ? <Maximize2 className="w-5 h-5 text-gray-300" /> : <Minimize2 className="w-5 h-5 text-gray-300" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-red-400" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Tabs */}
            <div className="flex items-center gap-1 px-6 py-3 bg-black/30 border-b border-gray-700">
              {[
                { id: "global", label: "Global", icon: Globe },
                { id: "friends", label: "Friends", icon: Users },
                { id: "ai", label: "AI Assistant", icon: Sparkles },
                { id: "rooms", label: "Rooms", icon: Film },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    activeTab === tab.id
                      ? "bg-[#39FF14]/20 text-[#39FF14]"
                      : "text-gray-400 hover:bg-gray-700/50 hover:text-white"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* Messages Area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className="group relative p-4 bg-gray-800/40 rounded-xl border border-gray-700/50 hover:border-[#39FF14]/30 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <AvatarRenderer
                          avatarData={message.userAvatar}
                          size={40}
                          className="rounded-full"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-white">{message.userName}</span>
                            <span className="text-xs text-gray-500">
                              {new Date(message.createdAt).toLocaleTimeString()}
                            </span>
                            {message.editedAt && (
                              <span className="text-xs text-gray-500">(edited)</span>
                            )}
                          </div>
                          {message.quoteMessageId && (
                            <div className="mb-2 pl-3 border-l-2 border-gray-600 text-sm text-gray-400">
                              <Quote className="w-3 h-3 inline mr-1" />
                              Replying to message
                            </div>
                          )}
                          <p className="text-gray-200 break-words">{message.text}</p>
                          {message.sharedMovie && (
                            <div className="mt-3 p-3 bg-gray-700/50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <img
                                  src={getImageUrl(message.sharedMovie.poster_path, "w500")}
                                  alt={message.sharedMovie.title}
                                  className="w-16 h-24 object-cover rounded"
                                />
                                <div>
                                  <h4 className="font-semibold text-white">{message.sharedMovie.title}</h4>
                                  <div className="flex items-center gap-1 mt-1">
                                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                                    <span className="text-sm text-gray-300">{message.sharedMovie.vote_average.toFixed(1)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleLikeMessage(message.id)}
                              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                                message.likedByMe ? "text-red-400" : "text-gray-400 hover:text-red-400"
                              }`}
                            >
                              <Heart className={`w-4 h-4 ${message.likedByMe ? "fill-red-400" : ""}`} />
                              {message.likeCount}
                            </button>
                            <button
                              onClick={() => setReplyTo(message)}
                              className="p-1 text-gray-400 hover:text-[#39FF14] transition-colors"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteMessage(message.id)}
                              className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-black/40 border-t border-gray-700">
                  {replyTo && (
                    <div className="flex items-center justify-between mb-2 p-2 bg-gray-800/50 rounded-lg">
                      <span className="text-sm text-gray-400">
                        Replying to <span className="text-white font-semibold">{replyTo.userName}</span>
                      </span>
                      <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {detectedMovie && (
                    <div className="mb-2 p-2 bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-lg flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#39FF14]" />
                      <span className="text-sm text-[#39FF14]">Movie detected: {detectedMovie.title}</span>
                    </div>
                  )}
                  <div className="flex items-end gap-3">
                    <div className="flex-1 relative">
                      <textarea
                        ref={inputRef}
                        value={inputText}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message... Use @[movie name] to share a movie"
                        rows={1}
                        className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#39FF14] resize-none"
                      />
                    </div>
                    <button
                      onClick={handleSendMessage}
                      disabled={!inputText.trim()}
                      className="px-6 py-3 bg-[#39FF14] text-black font-semibold rounded-xl hover:bg-[#39FF14]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Play className="w-5 h-5" />
                      Send
                    </button>
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              {sidebarOpen && (
                <div className="w-80 bg-black/40 border-l border-gray-700 flex flex-col">
                  <div className="flex border-b border-gray-700">
                    {[
                      { id: "trending", label: "Trending", icon: Star },
                      { id: "online", label: "Online", icon: Users },
                      { id: "rooms", label: "Rooms", icon: Film },
                    ].map((section) => (
                      <button
                        key={section.id}
                        onClick={() => setSidebarSection(section.id as any)}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 transition-colors ${
                          sidebarSection === section.id
                            ? "text-[#39FF14] border-b-2 border-[#39FF14]"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <section.icon className="w-4 h-4" />
                        {section.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 overflow-y-auto p-4">
                    {sidebarSection === "trending" && (
                      <div className="space-y-3">
                        {trendingMovies.map((movie) => (
                          <div
                            key={movie.id}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700/50 cursor-pointer transition-colors"
                          >
                            <img
                              src={getImageUrl(movie.poster_path, "w500")}
                              alt={movie.title}
                              className="w-12 h-18 object-cover rounded"
                            />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-white text-sm truncate">{movie.title}</h4>
                              <div className="flex items-center gap-1 mt-1">
                                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                                <span className="text-xs text-gray-400">{movie.vote_average.toFixed(1)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {sidebarSection === "online" && (
                      <div className="space-y-2">
                        {onlineUsers.map((u) => (
                          <div
                            key={u.id}
                            onClick={() => { setSelectedUser(u); setShowProfile(true); }}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700/50 cursor-pointer transition-colors"
                          >
                            <div className="relative">
                              <AvatarRenderer avatarData={u.avatar} size={32} className="rounded-full" />
                              <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-gray-800 ${
                                u.status === "online" ? "bg-[#39FF14]" : "bg-yellow-400"
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-white text-sm truncate">{u.name}</h4>
                              <p className="text-xs text-gray-400">{u.status}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {sidebarSection === "rooms" && (
                      <div className="space-y-2">
                        <button className="w-full flex items-center justify-center gap-2 p-3 bg-[#39FF14]/20 border border-[#39FF14]/30 rounded-lg text-[#39FF14] hover:bg-[#39FF14]/30 transition-colors">
                          <Plus className="w-4 h-4" />
                          Create Room
                        </button>
                        {movieRooms.map((room) => (
                          <div
                            key={room.id}
                            className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-[#39FF14]/30 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Film className="w-4 h-4 text-[#39FF14]" />
                              <h4 className="font-medium text-white">{room.name}</h4>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <Users className="w-3 h-3" />
                              {room.participants} watching
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Activity Feed */}
                  <div className="border-t border-gray-700 p-4">
                    <h3 className="text-sm font-semibold text-gray-400 mb-3">Live Activity</h3>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {activityFeed.slice(0, 5).map((activity) => (
                        <div key={activity.id} className="flex items-center gap-2 text-sm">
                          <Sparkles className="w-3 h-3 text-[#39FF14]" />
                          <span className="text-gray-300 truncate">{activity.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Profile Modal */}
      {showProfile && selectedUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative w-96 bg-gray-900 rounded-2xl border border-gray-700 p-6">
            <button
              onClick={() => setShowProfile(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex flex-col items-center">
              <AvatarRenderer
                avatarData={selectedUser.avatar}
                size={80}
                className="rounded-full mb-4"
              />
              <h3 className="text-xl font-bold text-white mb-1">{selectedUser.name}</h3>
              <div className={`px-3 py-1 rounded-full text-sm mb-4 ${
                selectedUser.status === "online" ? "bg-[#39FF14]/20 text-[#39FF14]" : "bg-yellow-400/20 text-yellow-400"
              }`}>
                {selectedUser.status}
              </div>
              <div className="flex gap-2 w-full">
                <button className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#39FF14]/80 transition-colors">
                  <MessageSquare className="w-4 h-4" />
                  Message
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors">
                  <Users className="w-4 h-4" />
                  Follow
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PremiumChatPanel;
