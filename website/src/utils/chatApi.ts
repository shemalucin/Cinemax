/**
 * Chat API integration layer
 * Connects the PremiumChatPanel to the backend chat endpoints
 */

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
  editedAt?: string | null;
  roomId?: string | null;
  quoteMessageId?: string | null;
  sharedMovie?: {
    id: number;
    title: string;
    poster_path: string | null;
    backdrop_path: string | null;
    vote_average: number;
    media_type: "movie" | "tv";
    genres?: string[];
    overview?: string;
  } | null;
  reactions?: Record<string, string[]>;
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
  editedAt?: string | null;
  deliveredAt?: string | null;
  seenAt?: string | null;
  quoteMessageId?: string | null;
  sharedMovie?: {
    id: number;
    title: string;
    poster_path: string | null;
    backdrop_path: string | null;
    vote_average: number;
    media_type: "movie" | "tv";
    genres?: string[];
    overview?: string;
  } | null;
  reactions?: Record<string, string[]>;
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

export interface ChatPresenceEntry {
  clientId: string;
  userId?: string;
  guestId?: string;
  name: string;
  avatar?: string;
  status: "online" | "away";
  currentView?: string;
  currentMovieTitle?: string;
  lastActiveAt: string;
  panelOpen: boolean;
  language?: string;
}

export interface ChatTypingEntry {
  key: string;
  scope: "global" | "dm";
  userId?: string;
  guestId?: string;
  name: string;
  roomId?: string;
  targetUserId?: string;
}

export interface ChatMeta {
  onlineCount: number;
  nowWatchingCount: number;
  trendingMovie?: {
    id: number;
    title: string;
    poster_path: string;
    vote_average: number;
  };
}

export interface ActivityFeedItem {
  id: string;
  icon: string;
  text: string;
  createdAt: string;
}

async function api(path: string, options?: RequestInit): Promise<any> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

// Global Chat
export async function getGlobalChatMessages(roomId?: string): Promise<{ messages: ChatMessage[] }> {
  const params = roomId ? `?roomId=${encodeURIComponent(roomId)}` : "";
  return api(`/api/chat/global${params}`);
}

export async function sendGlobalChatMessage(data: {
  text: string;
  parentId?: string | null;
  mediaUrl?: string;
  mediaType?: "image" | "audio";
  roomId?: string;
  quoteMessageId?: string;
  sharedMovie?: any;
}): Promise<{ message: ChatMessage }> {
  return api("/api/chat/global", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function likeGlobalMessage(messageId: string): Promise<{ message: ChatMessage }> {
  return api(`/api/chat/global/${messageId}/like`, { method: "POST" });
}

export async function reactToGlobalMessage(messageId: string, emoji: string): Promise<{ message: ChatMessage }> {
  return api(`/api/chat/global/${messageId}/react`, {
    method: "POST",
    body: JSON.stringify({ emoji }),
  });
}

export async function editGlobalMessage(messageId: string, text: string): Promise<{ message: ChatMessage }> {
  return api(`/api/chat/global/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify({ text }),
  });
}

export async function deleteGlobalMessage(messageId: string): Promise<{ ok: boolean }> {
  return api(`/api/chat/global/${messageId}`, { method: "DELETE" });
}

// Direct Messages
export async function getChatConversations(): Promise<{ conversations: ChatConversation[] }> {
  return api("/api/chat/conversations");
}

export async function getChatDirectory(): Promise<{ people: ChatDirectoryPerson[] }> {
  return api("/api/chat/directory");
}

export async function getDirectMessages(partnerId: string): Promise<{ messages: DirectMessage[] }> {
  return api(`/api/chat/conversations/${partnerId}`);
}

export async function sendDirectMessage(partnerId: string, data: {
  text: string;
  mediaUrl?: string;
  mediaType?: "image" | "audio";
}): Promise<{ message: DirectMessage }> {
  return api(`/api/chat/conversations/${partnerId}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function likeDirectMessage(messageId: string): Promise<{ message: DirectMessage }> {
  return api(`/api/chat/dm/${messageId}/like`, { method: "POST" });
}

export async function reactToDirectMessage(messageId: string, emoji: string): Promise<{ message: DirectMessage }> {
  return api(`/api/chat/dm/${messageId}/react`, {
    method: "POST",
    body: JSON.stringify({ emoji }),
  });
}

export async function editDirectMessage(messageId: string, text: string): Promise<{ message: DirectMessage }> {
  return api(`/api/chat/dm/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify({ text }),
  });
}

export async function deleteDirectMessage(messageId: string): Promise<{ ok: boolean }> {
  return api(`/api/chat/dm/${messageId}`, { method: "DELETE" });
}

// Presence & Typing
export async function updatePresence(data: {
  clientId: string;
  status?: "online" | "away";
  currentView?: string;
  currentMovieTitle?: string;
  panelOpen?: boolean;
  language?: string;
}): Promise<{ ok: boolean; meta: ChatMeta }> {
  return api("/api/chat/presence", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function setTypingIndicator(data: {
  clientId: string;
  isTyping: boolean;
  scope: "global" | "dm";
  roomId?: string;
  targetUserId?: string;
}): Promise<{ ok: boolean }> {
  return api("/api/chat/typing", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getChatMeta(): Promise<ChatMeta> {
  return api("/api/chat/meta");
}

// Real-time Stream
export function connectToChatStream(
  clientId: string,
  onEvent: (event: string, data: any) => void,
  onError?: (error: Event) => void
): EventSource {
  const eventSource = new EventSource(`/api/chat/stream?clientId=${encodeURIComponent(clientId)}`);

  // A malformed/partial payload from the server should never be able to take
  // down the live chat UI (or, since onEvent ultimately feeds React state
  // setters, the rest of the app). Parse defensively and just drop the event
  // if it isn't valid JSON.
  const safeOn = (eventName: string) => {
    eventSource.addEventListener(eventName, (e: MessageEvent) => {
      try {
        onEvent(eventName, JSON.parse(e.data));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[chat] Failed to parse "${eventName}" event`, err);
      }
    });
  };

  [
    "presence",
    "typing",
    "global_message_created",
    "global_message_updated",
    "global_message_deleted",
    "direct_message_created",
    "direct_message_updated",
    "direct_message_deleted",
    "message_reaction_updated",
    "chat_meta_updated",
    "activity",
  ].forEach(safeOn);

  if (onError) {
    eventSource.onerror = onError;
  }

  return eventSource;
}
