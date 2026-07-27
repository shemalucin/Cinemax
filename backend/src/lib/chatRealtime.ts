import type { Response } from "express";

type ChatStreamEventName =
  | "presence"
  | "typing"
  | "global_message_created"
  | "global_message_updated"
  | "global_message_deleted"
  | "direct_message_created"
  | "direct_message_updated"
  | "direct_message_deleted"
  | "message_reaction_updated"
  | "chat_meta_updated"
  | "activity";

export interface ChatStreamEnvelope<T = unknown> {
  event: ChatStreamEventName;
  payload: T;
  createdAt: string;
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
  expiresAt: number;
}

type ChatClient = {
  id: string;
  res: Response;
};

const sseClients = new Map<string, ChatClient>();
const presenceEntries = new Map<string, ChatPresenceEntry>();
const typingEntries = new Map<string, ChatTypingEntry>();
const activityFeed: Array<{ id: string; icon: string; text: string; createdAt: string }> = [];

function nowIso() {
  return new Date().toISOString();
}

function writeSse<T>(res: Response, event: ChatStreamEventName, payload: T) {
  const envelope: ChatStreamEnvelope<T> = {
    event,
    payload,
    createdAt: nowIso(),
  };
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(envelope)}\n\n`);
}

export function registerChatClient(id: string, res: Response) {
  sseClients.set(id, { id, res });
}

export function unregisterChatClient(id: string) {
  sseClients.delete(id);
  if (presenceEntries.has(id)) {
    presenceEntries.delete(id);
    broadcastChatEvent("presence", { entries: getPresenceEntries() });
  }
}

export function broadcastChatEvent<T>(event: ChatStreamEventName, payload: T) {
  for (const client of sseClients.values()) {
    writeSse(client.res, event, payload);
  }
}

export function upsertPresence(entry: ChatPresenceEntry) {
  presenceEntries.set(entry.clientId, entry);
  broadcastChatEvent("presence", { entries: getPresenceEntries() });
}

export function clearPresence(clientId: string) {
  if (presenceEntries.delete(clientId)) {
    broadcastChatEvent("presence", { entries: getPresenceEntries() });
  }
}

export function getPresenceEntries() {
  const cutoff = Date.now() - 60_000;
  for (const [clientId, value] of presenceEntries.entries()) {
    if (new Date(value.lastActiveAt).getTime() < cutoff) {
      presenceEntries.delete(clientId);
    }
  }
  return Array.from(presenceEntries.values()).sort((a, b) => (a.lastActiveAt < b.lastActiveAt ? 1 : -1));
}

function cleanupTyping() {
  const now = Date.now();
  let changed = false;
  for (const [key, value] of typingEntries.entries()) {
    if (value.expiresAt <= now) {
      typingEntries.delete(key);
      changed = true;
    }
  }
  if (changed) {
    broadcastChatEvent("typing", { entries: getTypingEntries() });
  }
}

export function setTyping(entry: Omit<ChatTypingEntry, "key" | "expiresAt">, ttlMs = 3500) {
  cleanupTyping();
  const key = `${entry.scope}:${entry.userId || entry.guestId || entry.name}:${entry.roomId || entry.targetUserId || "global"}`;
  typingEntries.set(key, {
    ...entry,
    key,
    expiresAt: Date.now() + ttlMs,
  });
  broadcastChatEvent("typing", { entries: getTypingEntries() });
}

export function clearTypingForActor(actorId: string) {
  let changed = false;
  for (const [key, value] of typingEntries.entries()) {
    if (value.userId === actorId || value.guestId === actorId) {
      typingEntries.delete(key);
      changed = true;
    }
  }
  if (changed) {
    broadcastChatEvent("typing", { entries: getTypingEntries() });
  }
}

export function getTypingEntries() {
  cleanupTyping();
  return Array.from(typingEntries.values()).map(({ expiresAt, ...rest }) => rest);
}

export function pushChatActivity(icon: string, text: string) {
  activityFeed.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    icon,
    text,
    createdAt: nowIso(),
  });
  if (activityFeed.length > 40) activityFeed.length = 40;
  broadcastChatEvent("activity", { items: getActivityFeed() });
}

export function getActivityFeed() {
  return activityFeed.slice(0, 12);
}

setInterval(() => {
  cleanupTyping();
  broadcastChatEvent("presence", { entries: getPresenceEntries() });
}, 15_000).unref();
