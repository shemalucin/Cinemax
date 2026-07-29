import fs from "fs";
import path from "path";
import mongoose from "mongoose";

/**
 * Persistence layer for the whole Cinemax state.
 *
 * The rest of the codebase treats `db.data` as an in-memory object and calls
 * `db.save()` after every mutation. Historically that was persisted to a
 * JSON file on disk. On a hosted platform like Render the local filesystem
 * is ephemeral (wiped on every restart / redeploy), so we now persist the
 * exact same shape to MongoDB Atlas as a single document in the
 * `app_state` collection.
 *
 * When `MONGO_URI` is missing (local dev without Atlas), we fall back to
 * the old file-backed behavior so `npm run dev` still "just works".
 */

export interface DbUser {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  avatar: string;
  banner: string;
  subscription: string;
  role: "user" | "admin";
  status: "active" | "suspended" | "banned";
  preferences: string;
  google_id?: string; // Google OAuth user ID (sub field from Google)
  onboarding?: {
    age: string;
    favoriteGenres: string[];
    completedAt: string;
    birthYear?: number; // Store birth year for accurate age calculation
  };
  created_at: string;
  updated_at: string;
}

export interface DbWatchlistItem {
  user_id: string;
  movie_id: number;
  added_at: string;
}

export interface DbMyListItem {
  user_id: string;
  movie_id: number;
  added_at: string;
  estimated_bytes: number;
}

export interface DbDownloadItem {
  user_id: string;
  movie_id: number;
  title: string;
  poster: string | null;
  size_bytes: number;
  added_at: string;
  media_type?: "movie" | "tv";
}

export interface DbFavoriteItem {
  user_id: string;
  movie_id: number;
  added_at: string;
}

export interface DbWatchHistoryItem {
  user_id: string;
  movie_id: number;
  title: string | null;
  poster: string | null;
  media_type: string | null;
  progress: number;
  duration: number;
  season: number | null;
  episode: number | null;
  watched_at: string;
}

export interface DbNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: number;
  created_at: string;
}

export interface DbComment {
  id: string;
  movie_id: number;
  movie_title: string | null;
  user_id: string;
  user_name: string;
  text: string;
  rating: number | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface DbAd {
  id: string;
  title: string;
  image_url: string;
  target_url: string;
  placement: "homepage_top" | "homepage_mid" | "sidebar" | "player_pre_roll";
  active: boolean;
  created_at: string;
}

export interface DbActivityLog {
  id: string;
  user_id?: string; // Foreign Key linking to the user (optional for system actions)
  actor_email: string;
  action: string;
  target: string;
  meta: string;
  ip_address?: string; // For security tracking
  created_at: string;
}

export interface DbCategoryOverride {
  genre_id: number;
  label: string | null;
  hidden: boolean;
}

export interface DbSiteSettings {
  siteName: string;
  maintenanceMode: boolean;
  heroTagline: string;
  featuredMovieIds: number[];
  trendingOverrideIds: number[];
  hiddenMovieIds: number[];
  aiModel: string;
  aiPrimaryModel: string;
  aiSystemPromptExtra: string;
  aiEnabled: boolean;
  apkUrl: string;
  homepageSections: Array<{ id: string; label: string; visible: boolean }>;
  apiKeys: {
    tmdb: string;
    gemini: string;
    groq: string;
    openai: string;
    grok: string;
  };
  contentPages: Record<string, { enabled: boolean; label: string }>;
  socialMediaLinks: Array<{
    id: string;
    platform: string;
    name: string;
    url: string;
    icon: string;
    enabled: boolean;
  }>;
}

export interface DbAiChatHistoryItem {
  id: string;
  user_id: string | null;
  user_name: string | null;
  role: "user" | "assistant";
  message: string;
  engine: "openai" | "grok" | "gemini" | "groq" | "system" | "fallback";
  tokens_estimate: number;
  created_at: string;
}

export interface DbAiMemoryItem {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
  source: "admin" | "feedback" | "system";
  created_at: string;
  updated_at: string;
}

export interface DbSharedMovieCard {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  media_type: "movie" | "tv";
  genres?: string[];
  overview?: string;
}

export interface DbChatMessage {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string;
  text: string;
  parent_id: string | null;
  liked_by: string[];
  created_at: string;
  media_url: string | null;
  media_type: "image" | "audio" | null;
  edited_at?: string | null;
  room_id?: string | null;
  quote_message_id?: string | null;
  shared_movie?: DbSharedMovieCard | null;
  reactions?: Record<string, string[]>;
}

export interface DbDirectMessage {
  id: string;
  from_user_id: string;
  to_user_id: string;
  text: string;
  liked_by: string[];
  read: boolean;
  created_at: string;
  media_url: string | null;
  media_type: "image" | "audio" | null;
  edited_at?: string | null;
  delivered_at?: string | null;
  seen_at?: string | null;
  quote_message_id?: string | null;
  shared_movie?: DbSharedMovieCard | null;
  reactions?: Record<string, string[]>;
}

export interface DbSeason {
  season_number: number;
  name: string;
  overview: string;
  poster_path: string | null;
  air_date: string | null;
  episode_count: number;
}

export interface DbEpisode {
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date: string | null;
  runtime: number | null;
}

export interface DbCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface DbCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface DbCustomContent {
  id: string;
  numeric_id: number;
  tmdb_id: number | null; // TMDB ID if imported from TMDB
  title: string;
  overview: string;
  poster_url: string;
  backdrop_url: string;
  trailer_youtube_key: string;
  media_type: "movie" | "tv";
  genre_names: string[];
  genre_ids: number[];
  release_date: string | null;
  rating: number;
  featured: boolean;
  // TV Show specific fields
  seasons?: DbSeason[];
  episodes?: DbEpisode[];
  first_air_date?: string | null;
  last_air_date?: string | null;
  status?: string | null; // "Returning Series", "Ended", etc.
  number_of_seasons?: number;
  number_of_episodes?: number;
  // Cast and crew
  cast?: DbCastMember[];
  crew?: DbCrewMember[];
  // Additional metadata
  original_language?: string;
  original_title?: string;
  popularity?: number;
  vote_count?: number;
  video?: boolean;
  // Path (served from this backend, e.g. /uploads/videos/xyz.mp4) to a video
  // file the admin has uploaded themselves. Only set for content the site
  // owns the rights to — never a third-party embed or scraped stream.
  video_url?: string | null;
  // External movie URL (e.g., https://example.com/movie/avatar) - for third-party
  // streaming sites or external video sources. Preserved exactly as entered by admin.
  full_movie_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbSupportInquiry {
  id: string;
  user_id: string | null;
  user_name: string;
  user_email: string;
  subject: string;
  message: string;
  status: "open" | "replied" | "closed";
  admin_reply: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbGensAccessItem {
  user_id: string;
  user_name: string;
  user_email: string;
  first_accessed_at: string;
  last_accessed_at: string;
  access_count: number;
}

interface DbSchema {
  users: DbUser[];
  watchlist: DbWatchlistItem[];
  my_list: DbMyListItem[];
  downloads: DbDownloadItem[];
  favorites: DbFavoriteItem[];
  watch_history: DbWatchHistoryItem[];
  notifications: DbNotification[];
  comments: DbComment[];
  ads: DbAd[];
  activity_logs: DbActivityLog[];
  category_overrides: DbCategoryOverride[];
  site_settings: DbSiteSettings;
  chat_messages: DbChatMessage[];
  direct_messages: DbDirectMessage[];
  custom_content: DbCustomContent[];
  custom_content_seq: number;
  support_inquiries: DbSupportInquiry[];
  gens_access: DbGensAccessItem[];
  ai_chat_history: DbAiChatHistoryItem[];
  ai_memory: DbAiMemoryItem[];
}

function defaultSiteSettings(): DbSiteSettings {
  return {
    siteName: "Cinemax",
    maintenanceMode: false,
    heroTagline: "Welcome to Cinemax! Enjoy new trend movies and TV shows.",
    featuredMovieIds: [],
    trendingOverrideIds: [],
    hiddenMovieIds: [],
    aiModel: "llama-3.3-70b-versatile",
    aiPrimaryModel: "gemini-2.5-flash",
    aiSystemPromptExtra: "",
    aiEnabled: true,
    apkUrl: process.env.APK_URL || "",
    homepageSections: [
      { id: "trending", label: "Trending Now", visible: true },
      { id: "tv", label: "Popular TV Broadcast Series", visible: true },
      { id: "popular", label: "Popular Movies", visible: true },
      { id: "top_rated", label: "Top Rated Cinema Hits", visible: true },
      { id: "upcoming", label: "Upcoming Blockbusters", visible: true },
      { id: "now_playing", label: "Now Playing in Theaters", visible: true },
    ],
    apiKeys: {
      tmdb: process.env.TMDB_API_KEY || "",
      gemini: process.env.GEMINI_API_KEY || "",
      groq: process.env.GROQ_API_KEY || "",
      openai: process.env.OPENAI_API_KEY || "",
      grok: process.env.GROK_API_KEY || "",
    },
    contentPages: {
      home: { enabled: true, label: "Home" },
      movies: { enabled: true, label: "Movies" },
      tv: { enabled: true, label: "TV Shows" },
      shorts: { enabled: true, label: "Shorts" },
      mylist: { enabled: true, label: "My List" },
      watchlist: { enabled: true, label: "Watchlist" },
      history: { enabled: true, label: "History" },
      favorites: { enabled: true, label: "Favorites" },
      downloads: { enabled: true, label: "Downloads" },
      profile: { enabled: true, label: "Profile" },
      help: { enabled: true, label: "Help Desk" },
      about: { enabled: true, label: "About Cinemax" },
      gens: { enabled: true, label: "Gens" },
    },
    socialMediaLinks: [
      {
        id: "instagram",
        platform: "instagram",
        name: "Instagram",
        url: "https://www.instagram.com/cinemaxmov01/?hl=en",
        icon: "Instagram",
        enabled: true,
      },
      {
        id: "youtube",
        platform: "youtube",
        name: "YouTube",
        url: "https://www.youtube.com/@Cinemaxmov",
        icon: "Youtube",
        enabled: true,
      },
      {
        id: "whatsapp",
        platform: "whatsapp",
        name: "WhatsApp",
        url: "https://wa.me/738664438",
        icon: "MessageCircle",
        enabled: true,
      },
    ],
  };
}

function emptySchema(): DbSchema {
  return {
    users: [],
    watchlist: [],
    my_list: [],
    downloads: [],
    favorites: [],
    watch_history: [],
    notifications: [],
    comments: [],
    ads: [],
    activity_logs: [],
    category_overrides: [],
    site_settings: defaultSiteSettings(),
    chat_messages: [],
    direct_messages: [],
    custom_content: [],
    custom_content_seq: 0,
    support_inquiries: [],
    gens_access: [],
    ai_chat_history: [],
    ai_memory: [],
  };
}

function mergeSchema(parsed: any): DbSchema {
  const merged: DbSchema = { ...emptySchema(), ...(parsed || {}) };
  merged.site_settings = { ...defaultSiteSettings(), ...(parsed?.site_settings || {}) };
  if (!merged.support_inquiries) merged.support_inquiries = [];
  if (!merged.gens_access) merged.gens_access = [];
  if (!merged.ai_chat_history) merged.ai_chat_history = [];
  if (!merged.ai_memory) merged.ai_memory = [];
  if (!merged.my_list) merged.my_list = [];
  if (!merged.downloads) merged.downloads = [];
  if (merged.watchlist?.length && merged.my_list.length === 0) {
    for (const w of merged.watchlist) {
      if (!merged.my_list.some((m) => m.user_id === w.user_id && m.movie_id === w.movie_id)) {
        merged.my_list.push({
          user_id: w.user_id,
          movie_id: w.movie_id,
          added_at: w.added_at,
          estimated_bytes: 150 * 1024 * 1024,
        });
      }
    }
  }
  merged.users = (merged.users || []).map((u: DbUser) => ({
    ...u,
    role: u.role || "user",
    status: u.status || "active",
  }));
  return merged;
}

// ---------------------------------------------------------------------------
// FILE FALLBACK — used only when MONGO_URI isn't configured (local dev).
// ---------------------------------------------------------------------------
const dataDir = path.join(process.cwd(), "data");
const DB_PATH = path.join(dataDir, "cinemax.json");

function fileLoad(): DbSchema {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(DB_PATH)) {
      const fresh = emptySchema();
      fs.writeFileSync(DB_PATH, JSON.stringify(fresh, null, 2));
      return fresh;
    }
    return mergeSchema(JSON.parse(fs.readFileSync(DB_PATH, "utf-8")));
  } catch (err) {
    console.error(`[db] Failed to load ${DB_PATH} — starting empty.`, err);
    return emptySchema();
  }
}

function fileSave(current: DbSchema) {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(current, null, 2));
  } catch (err) {
    console.error("[db] file save failed:", err);
  }
}

// ---------------------------------------------------------------------------
// MONGO PERSISTENCE — a single document holds the whole schema. Same shape
// as the JSON file, so no route code has to change.
// ---------------------------------------------------------------------------
const AppStateSchema = new mongoose.Schema(
  { _id: { type: String, default: "singleton" }, state: mongoose.Schema.Types.Mixed },
  { minimize: false, versionKey: false, strict: false },
);
const AppStateModel = mongoose.models.AppState || mongoose.model("AppState", AppStateSchema, "app_state");

let usingMongo = false;
let data: DbSchema = emptySchema();
let ready = false;

// Coalesce concurrent saves so we don't hammer Mongo with the whole doc on
// every field mutation — one write in flight, one queued at most.
let saveInFlight: Promise<void> | null = null;
let savePending = false;

async function mongoWriteNow(): Promise<void> {
  try {
    await AppStateModel.updateOne(
      { _id: "singleton" },
      { $set: { state: data } },
      { upsert: true },
    );
  } catch (err) {
    console.error("[db] Mongo save failed:", err);
  }
}

function scheduleMongoSave() {
  if (saveInFlight) {
    savePending = true;
    return;
  }
  saveInFlight = (async () => {
    try {
      await mongoWriteNow();
      while (savePending) {
        savePending = false;
        await mongoWriteNow();
      }
    } finally {
      saveInFlight = null;
    }
  })();
}

/** Called once at boot from server.ts, after connectDB(). */
export async function initDb(): Promise<void> {
  if (ready) return;
  usingMongo = mongoose.connection.readyState === 1;

  if (usingMongo) {
    try {
      const doc = (await (AppStateModel as any).findOne({ _id: "singleton" }).lean()) as { state?: any } | null;
      data = mergeSchema(doc?.state);
      // Persist the merged/defaulted shape back so future readers see it.
      await AppStateModel.updateOne(
        { _id: "singleton" },
        { $set: { state: data } },
        { upsert: true },
      );
      console.log("[db] Loaded state from MongoDB Atlas.");
    } catch (err) {
      console.error("[db] Mongo load failed — using empty in-memory state.", err);
      data = emptySchema();
    }
  } else {
    data = fileLoad();
    console.warn("[db] MONGO_URI not configured — using file-backed JSON store.");
  }
  ready = true;
}

function save() {
  if (usingMongo) {
    scheduleMongoSave();
  } else {
    fileSave(data);
  }
}

/** Flush any pending Mongo write — useful on graceful shutdown. */
export async function flushDb(): Promise<void> {
  if (saveInFlight) await saveInFlight;
}

const db = {
  get data(): DbSchema {
    return data;
  },
  save,
  nextCustomContentId(): number {
    data.custom_content_seq += 1;
    return -data.custom_content_seq;
  },
};

export default db;
