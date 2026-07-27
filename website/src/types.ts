export interface Movie {
  id: number;
  title?: string;
  name?: string; // TV shows use name instead of title
  overview: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string; // TV shows use first_air_date
  genre_ids?: number[];
  genres?: Array<{ id: number; name: string }>;
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  // Present only on admin-authored "custom content" (CMS) entries — these
  // have a negative id and play their trailer directly, or their own
  // uploaded video file when one has been set (see videoUrl below).
  isCustom?: boolean;
  tmdb_id?: number; // TMDB ID if imported from TMDB (for custom content)
  trailerYoutubeKey?: string;
  /** Relative path to an admin-uploaded video file this site owns the rights
   *  to, served by our own backend (e.g. "/uploads/videos/xyz.mp4"). When
   *  absent, only the official trailer is available for this title. */
  videoUrl?: string | null;
  media_type?: "movie" | "tv";
  /** Optional direct download URL for fullmovie files (if available). */
  download_url?: string | null;
  /** External movie URL (e.g., https://example.com/movie/avatar) - for third-party
   *  streaming sites or external video sources. Preserved exactly as entered by admin. */
  fullMovieUrl?: string | null;
  featured?: boolean;
  vote_count?: number;
  popularity?: number;
  // TV Show specific fields for custom content
  seasons?: any[];
  episodes?: any[];
  status?: string;
  cast?: any[];
  crew?: any[];
  original_language?: string;
  original_title?: string;
  video?: boolean;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface Review {
  id: string;
  author: string;
  content: string;
  created_at: string;
}

export interface UserPreferences {
  autoplayNext: boolean;
  autoplayTrailers: boolean;
  defaultQuality: "Auto" | "4K" | "1080p" | "720p";
  subtitleLanguage: string;
  audioLanguage: string;
  notifyNewReleases: boolean;
  notifyRecommendations: boolean;
  matureContentLock: boolean;
  appLanguage: string;
  reducedMotion: boolean;
  dataSaver: boolean;
  showProfileOnline: boolean;
  emailDigest: boolean;
  compactLayout: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  autoplayNext: true,
  autoplayTrailers: true,
  defaultQuality: "Auto",
  subtitleLanguage: "Off",
  audioLanguage: "English",
  notifyNewReleases: true,
  notifyRecommendations: false,
  matureContentLock: false,
  appLanguage: "English",
  reducedMotion: false,
  dataSaver: false,
  showProfileOnline: true,
  emailDigest: false,
  compactLayout: false,
};

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  banner: string;
  subscription: "Free" | "Premium";
  badges: string[];
  role?: "user" | "admin";
  favorites: number[]; // TMDB movie/tv IDs
  myList: number[]; // manually saved for later
  watchlist: number[]; // continue-watching IDs (from history)
  listStorageUsed?: number;
  listStorageLimit?: number;
  downloadStorageUsed?: number;
  downloadStorageLimit?: number;
  downloads?: DownloadItem[];
  onboarding?: {
    age: string;
    favoriteGenres: string[];
    completedAt?: string;
  };
  watchHistory: Array<{
    id: number;
    title: string;
    poster: string;
    type: "movie" | "tv";
    watchedAt: string;
    progress: number; // percentage (0-100)
    duration: number; // minutes
    season?: number;
    episode?: number;
  }>;
  // Security: passwords are hashed and stored server-side only — never sent
  // to or kept on the client.
  preferences: UserPreferences;
}

export interface Message {
  role: "user" | "model";
  text: string;
  timestamp: string;
  /** Optional data URL of an image the user attached (visual search) */
  imageUrl?: string;
  /** URL of AI-generated image */
  generatedImageUrl?: string;
  /** Structured action the assistant is proposing, awaiting user confirmation */
  proposedAction?: AssistantAction | null;
  /** Movies returned by a visual search, rendered as a result grid */
  visualMatches?: Movie[];
  /** Persisted context for follow-up questions about a visual search */
  visualContext?: {
    description: string;
    analysis: Record<string, unknown>;
    matches: Array<{ id: number; title: string; overview?: string; rating?: number }>;
  };
}

export type AssistantActionType =
  | "update_name"
  | "toggle_autoplay_next"
  | "toggle_autoplay_trailers"
  | "set_subtitle_language"
  | "set_default_quality"
  | "toggle_mature_lock"
  | "clear_watch_history"
  | "navigate";

export interface AssistantAction {
  type: AssistantActionType;
  value?: string;
  label: string; // human-readable summary shown in the confirmation card
}

export type NotificationType = "new_release" | "watchlist" | "recommendation" | "account" | "system" | "announcement";

export interface DownloadItem {
  movie_id: number;
  title: string;
  poster: string | null;
  size_bytes: number;
  added_at: string;
  media_type?: "movie" | "tv";
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  movieId?: number;
  poster?: string;
}

// ---------------------------------------------------------------------------
// LIVE CHAT
// ---------------------------------------------------------------------------

export interface ChatMessage {
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
}

export interface DirectMessage {
  id: string;
  fromUserId: string;
  toUserId: string;
  text: string;
  likeCount: number;
  likedByMe: boolean;
  read: boolean;
  createdAt: string;
  mediaUrl?: string | null;
  mediaType?: "image" | "audio" | null;
}

export interface ChatConversation {
  userId: string;
  userName: string;
  userAvatar: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface ChatDirectoryPerson {
  id: string;
  name: string;
  avatar: string;
}

export interface SocialMediaLink {
  id: string;
  platform: string;
  url: string;
  icon: string;
  label: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}
