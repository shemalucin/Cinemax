// src/server.ts
import "dotenv/config";
import dotenv from "dotenv";
import path3 from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

// src/routes/website.ts
import { Router } from "express";
import crypto3 from "crypto";
import { Readable } from "stream";

// src/lib/db.ts
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
function defaultSiteSettings() {
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
      { id: "now_playing", label: "Now Playing in Theaters", visible: true }
    ],
    apiKeys: {
      tmdb: process.env.TMDB_API_KEY || "",
      gemini: process.env.GEMINI_API_KEY || "",
      groq: process.env.GROQ_API_KEY || "",
      openai: process.env.OPENAI_API_KEY || "",
      grok: process.env.GROK_API_KEY || ""
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
      gens: { enabled: true, label: "Gens" }
    },
    socialMediaLinks: [
      {
        id: "instagram",
        platform: "instagram",
        name: "Instagram",
        url: "https://www.instagram.com/cinemaxmov01/?hl=en",
        icon: "Instagram",
        enabled: true
      },
      {
        id: "youtube",
        platform: "youtube",
        name: "YouTube",
        url: "https://www.youtube.com/@Cinemaxmov",
        icon: "Youtube",
        enabled: true
      },
      {
        id: "whatsapp",
        platform: "whatsapp",
        name: "WhatsApp",
        url: "https://wa.me/738664438",
        icon: "MessageCircle",
        enabled: true
      }
    ]
  };
}
function emptySchema() {
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
    ai_memory: []
  };
}
function mergeSchema(parsed) {
  const merged = { ...emptySchema(), ...parsed || {} };
  merged.site_settings = { ...defaultSiteSettings(), ...parsed?.site_settings || {} };
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
          estimated_bytes: 150 * 1024 * 1024
        });
      }
    }
  }
  merged.users = (merged.users || []).map((u) => ({
    ...u,
    role: u.role || "user",
    status: u.status || "active"
  }));
  return merged;
}
var dataDir = path.join(process.cwd(), "data");
var DB_PATH = path.join(dataDir, "cinemax.json");
function fileLoad() {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(DB_PATH)) {
      const fresh = emptySchema();
      fs.writeFileSync(DB_PATH, JSON.stringify(fresh, null, 2));
      return fresh;
    }
    return mergeSchema(JSON.parse(fs.readFileSync(DB_PATH, "utf-8")));
  } catch (err) {
    console.error(`[db] Failed to load ${DB_PATH} \u2014 starting empty.`, err);
    return emptySchema();
  }
}
function fileSave(current) {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(current, null, 2));
  } catch (err) {
    console.error("[db] file save failed:", err);
  }
}
var AppStateSchema = new mongoose.Schema(
  { _id: { type: String, default: "singleton" }, state: mongoose.Schema.Types.Mixed },
  { minimize: false, versionKey: false, strict: false }
);
var AppStateModel = mongoose.models.AppState || mongoose.model("AppState", AppStateSchema, "app_state");
var usingMongo = false;
var data = emptySchema();
var ready = false;
var saveInFlight = null;
var savePending = false;
async function mongoWriteNow() {
  try {
    await AppStateModel.updateOne(
      { _id: "singleton" },
      { $set: { state: data } },
      { upsert: true }
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
async function initDb() {
  if (ready) return;
  usingMongo = mongoose.connection.readyState === 1;
  if (usingMongo) {
    try {
      const doc = await AppStateModel.findOne({ _id: "singleton" }).lean();
      data = mergeSchema(doc?.state);
      await AppStateModel.updateOne(
        { _id: "singleton" },
        { $set: { state: data } },
        { upsert: true }
      );
      console.log("[db] Loaded state from MongoDB Atlas.");
    } catch (err) {
      console.error("[db] Mongo load failed \u2014 using empty in-memory state.", err);
      data = emptySchema();
    }
  } else {
    data = fileLoad();
    console.warn("[db] MONGO_URI not configured \u2014 using file-backed JSON store.");
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
async function flushDb() {
  if (saveInFlight) await saveInFlight;
}
var db = {
  get data() {
    return data;
  },
  save,
  nextCustomContentId() {
    data.custom_content_seq += 1;
    return -data.custom_content_seq;
  }
};
var db_default = db;

// src/lib/auth.ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto2 from "crypto";
var COOKIE_NAME = "cinemax_session";
var TOKEN_EXPIRY = "7d";
var TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1e3;
var JWT_SECRET = process.env.JWT_SECRET || (() => {
  return crypto2.randomBytes(32).toString("hex");
})();
var DEFAULT_PREFERENCES = {
  autoplayNext: true,
  autoplayTrailers: true,
  defaultQuality: "Auto",
  subtitleLanguage: "Off",
  audioLanguage: "English",
  notifyNewReleases: true,
  notifyRecommendations: false,
  matureContentLock: false,
  appLanguage: "English"
};
function publicUser(u) {
  let preferences = DEFAULT_PREFERENCES;
  try {
    preferences = { ...DEFAULT_PREFERENCES, ...JSON.parse(u.preferences || "{}") };
  } catch {
  }
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatar: u.avatar,
    banner: u.banner,
    subscription: u.subscription,
    role: u.role,
    status: u.status,
    preferences,
    onboarding: u.onboarding ? { age: u.onboarding.age, favoriteGenres: u.onboarding.favoriteGenres } : null,
    createdAt: u.created_at
  };
}
function isValidEmail(email) {
  const normalized = email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(normalized)) return false;
  if (normalized.length > 254) return false;
  const [local, domain] = normalized.split("@");
  if (!local || !domain || local.length > 64) return false;
  if (domain.includes("..") || local.startsWith(".") || local.endsWith(".")) return false;
  return isRealEmailDomain(domain);
}
var DISPOSABLE_DOMAINS = /* @__PURE__ */ new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "10minutemail.com",
  "throwaway.email",
  "yopmail.com",
  "fakeinbox.com",
  "trashmail.com",
  "getnada.com",
  "dispostable.com",
  "maildrop.cc",
  "sharklasers.com",
  "example.com",
  "test.com",
  "localhost.com"
]);
function isRealEmailDomain(domain) {
  if (DISPOSABLE_DOMAINS.has(domain)) return false;
  const parts = domain.split(".");
  if (parts.length < 2) return false;
  const tld = parts[parts.length - 1];
  if (tld.length < 2) return false;
  return true;
}
function isStrongPassword(password) {
  return typeof password === "string" && password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
}
function getUserByEmail(email) {
  const normalized = email.toLowerCase().trim();
  return db_default.data.users.find((u) => u.email === normalized);
}
function getUserById(id) {
  return db_default.data.users.find((u) => u.id === id);
}
function createUser(email, password, name, passwordHashOverride, googleId, googleAvatar) {
  const normalized = email.toLowerCase().trim();
  const existingUser = getUserByEmail(normalized);
  if (existingUser) {
    throw new Error("Email already registered");
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const user = {
    id: crypto2.randomUUID(),
    email: normalized,
    password_hash: passwordHashOverride || bcrypt.hashSync(password, 12),
    name: name.trim(),
    avatar: googleAvatar || "anim:aurora",
    banner: "",
    subscription: "Free",
    role: "user",
    status: "active",
    preferences: JSON.stringify(DEFAULT_PREFERENCES),
    google_id: googleId,
    created_at: now,
    updated_at: now
  };
  db_default.data.users.push(user);
  db_default.save();
  return user;
}
function seedAdminUser() {
  const email = (process.env.ADMIN_EMAIL || "allkikisweb@gmail.com").toLowerCase().trim();
  const password = (process.env.ADMIN_PASSWORD || "kiki@321").trim();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const existingByEmail = getUserByEmail(email);
  const existingAdmin = db_default.data.users.find((u) => u.role === "admin");
  if (existingByEmail || existingAdmin) {
    const target = existingByEmail || existingAdmin;
    target.email = email;
    target.name = "Cinemax Admin";
    target.role = "admin";
    target.status = "active";
    target.password_hash = bcrypt.hashSync(password, 12);
    target.updated_at = now;
    db_default.save();
    console.warn(`[startup] Admin account ready for email/password sign-in (${email}).`);
    return;
  }
  const admin = {
    id: crypto2.randomUUID(),
    email,
    password_hash: bcrypt.hashSync(password, 12),
    name: "Cinemax Admin",
    avatar: "cartoon:orion",
    banner: "",
    subscription: "Premium",
    role: "admin",
    status: "active",
    preferences: JSON.stringify(DEFAULT_PREFERENCES),
    created_at: now,
    updated_at: now
  };
  db_default.data.users.push(admin);
  db_default.save();
  console.warn(`[startup] Seeded admin account for email/password sign-in (${email}).`);
}
function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.password_hash);
}
var OTP_TTL_MS = 10 * 60 * 1e3;
var OTP_RESEND_COOLDOWN_MS = 60 * 1e3;
var OTP_MAX_ATTEMPTS = 5;
var otpStore = /* @__PURE__ */ new Map();
var signupVerifyStore = /* @__PURE__ */ new Map();
var passwordResetStore = /* @__PURE__ */ new Map();
function isAdminEmail(email) {
  const normalized = email.toLowerCase().trim();
  const user = getUserByEmail(normalized);
  return !!user && user.role === "admin";
}
function getAdminLoginMethod(email) {
  if (!isAdminEmail(email)) return "password";
  return "otp";
}
function canSendOtp(email) {
  const record = otpStore.get(email.toLowerCase().trim());
  if (!record) return { status: "ready" };
  const elapsed = Date.now() - record.lastSentAt;
  if (elapsed < OTP_RESEND_COOLDOWN_MS) {
    return { status: "cooldown", retryAfterMs: OTP_RESEND_COOLDOWN_MS - elapsed };
  }
  return { status: "ready" };
}
function issueOtp(email) {
  const normalized = email.toLowerCase().trim();
  const otp = crypto2.randomInt(0, 1e6).toString().padStart(6, "0");
  otpStore.set(normalized, {
    hash: bcrypt.hashSync(otp, 10),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: Date.now()
  });
  return otp;
}
function verifyOtp(email, code) {
  const normalized = email.toLowerCase().trim();
  const record = otpStore.get(normalized);
  if (!record) return "not_found";
  if (Date.now() > record.expiresAt) {
    otpStore.delete(normalized);
    return "expired";
  }
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    otpStore.delete(normalized);
    return "too_many_attempts";
  }
  record.attempts += 1;
  if (!bcrypt.compareSync(String(code || ""), record.hash)) {
    return "invalid";
  }
  otpStore.delete(normalized);
  return "ok";
}
function issueSignupVerification(email, name, password) {
  const normalized = email.toLowerCase().trim();
  const otp = crypto2.randomInt(0, 1e6).toString().padStart(6, "0");
  signupVerifyStore.set(normalized, {
    hash: bcrypt.hashSync(otp, 10),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: Date.now(),
    name: name.trim(),
    passwordHash: bcrypt.hashSync(password, 12)
  });
  return otp;
}
function verifySignupCode(email, code) {
  const normalized = email.toLowerCase().trim();
  const record = signupVerifyStore.get(normalized);
  if (!record) return { status: "not_found" };
  if (Date.now() > record.expiresAt) {
    signupVerifyStore.delete(normalized);
    return { status: "expired" };
  }
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    signupVerifyStore.delete(normalized);
    return { status: "too_many_attempts" };
  }
  record.attempts += 1;
  if (!bcrypt.compareSync(String(code || ""), record.hash)) {
    return { status: "invalid" };
  }
  signupVerifyStore.delete(normalized);
  return { status: "ok", name: record.name, passwordHash: record.passwordHash };
}
function issuePasswordReset(email) {
  const normalized = email.toLowerCase().trim();
  const otp = crypto2.randomInt(0, 1e6).toString().padStart(6, "0");
  passwordResetStore.set(normalized, {
    hash: bcrypt.hashSync(otp, 10),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: Date.now()
  });
  return otp;
}
function canSendPasswordReset(email) {
  const record = passwordResetStore.get(email.toLowerCase().trim());
  if (!record) return { status: "ready" };
  const elapsed = Date.now() - record.lastSentAt;
  if (elapsed < OTP_RESEND_COOLDOWN_MS) {
    return { status: "cooldown", retryAfterMs: OTP_RESEND_COOLDOWN_MS - elapsed };
  }
  return { status: "ready" };
}
var rateBuckets = /* @__PURE__ */ new Map();
function checkRateLimit(key, maxAttempts, windowMs) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.windowStart > windowMs) {
    rateBuckets.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= maxAttempts) return false;
  bucket.count += 1;
  return true;
}
function rateLimit(opts) {
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const email = String(req.body && req.body.email || "").toLowerCase().trim();
    const ipKey = `${opts.name}:ip:${ip}`;
    const emailKey = email ? `${opts.name}:email:${email}` : null;
    const ipOk = checkRateLimit(ipKey, opts.max * 3, opts.windowMs);
    const emailOk = emailKey ? checkRateLimit(emailKey, opts.max, opts.windowMs) : true;
    if (!ipOk || !emailOk) {
      res.status(429).json({ error: "Too many attempts. Please wait a few minutes and try again." });
      return;
    }
    next();
  };
}
function verifyPasswordResetToken(email, token) {
  const normalized = email.toLowerCase().trim();
  const record = passwordResetStore.get(normalized);
  if (!record) return "not_found";
  if (Date.now() > record.expiresAt) {
    passwordResetStore.delete(normalized);
    return "expired";
  }
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    passwordResetStore.delete(normalized);
    return "too_many_attempts";
  }
  record.attempts += 1;
  if (!bcrypt.compareSync(String(token || ""), record.hash)) return "invalid";
  return "ok";
}
function consumePasswordReset(email) {
  passwordResetStore.delete(email.toLowerCase().trim());
}
function updatePasswordHash(userId, newPassword) {
  const user = getUserById(userId);
  if (!user) return;
  user.password_hash = bcrypt.hashSync(newPassword, 10);
  user.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  db_default.save();
}
function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}
function signPortalToken(userId) {
  return jwt.sign({ sub: userId, purpose: "admin_portal" }, JWT_SECRET, { expiresIn: "15m" });
}
function verifyPortalToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.purpose !== "admin_portal" || !payload.sub) return null;
    const user = getUserById(payload.sub);
    if (!user || user.role !== "admin" || user.status !== "active") return null;
    return payload.sub;
  } catch {
    return null;
  }
}
function setSessionCookie(res, token) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    maxAge: TOKEN_EXPIRY_MS,
    path: "/"
  });
}
function clearSessionCookie(res) {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie(COOKIE_NAME, {
    path: "/",
    sameSite: isProd ? "none" : "lax",
    secure: isProd
  });
}
var ACTIVE_WINDOW_MS = 5 * 60 * 1e3;
var lastSeenAt = /* @__PURE__ */ new Map();
function markSeen(userId) {
  lastSeenAt.set(userId, Date.now());
}
function getActiveSessionCount() {
  const cutoff = Date.now() - ACTIVE_WINDOW_MS;
  let count = 0;
  for (const ts of lastSeenAt.values()) {
    if (ts >= cutoff) count += 1;
  }
  return count;
}
function extractToken(req) {
  const cookieToken = req.cookies?.[COOKIE_NAME];
  if (cookieToken) return cookieToken;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice("Bearer ".length).trim();
  return void 0;
}
function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Please sign in to continue." });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = getUserById(payload.sub);
    if (!user) {
      res.status(401).json({ error: "Your session is no longer valid. Please sign in again." });
      return;
    }
    if (user.status === "banned") {
      clearSessionCookie(res);
      res.status(403).json({ error: "This account has been banned. Contact support if you believe this is a mistake." });
      return;
    }
    if (user.status === "suspended") {
      clearSessionCookie(res);
      res.status(403).json({ error: "This account is currently suspended." });
      return;
    }
    req.user = user;
    markSeen(user.id);
    next();
  } catch {
    res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
}
function getOptionalUserId(req) {
  const token = extractToken(req);
  if (!token) return void 0;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = getUserById(payload.sub);
    return user && user.status === "active" ? user.id : void 0;
  } catch {
    return void 0;
  }
}
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "Administrator access required." });
    return;
  }
  next();
}
function logActivity(actorEmail, action, target, meta = {}, userId, ipAddress) {
  db_default.data.activity_logs.push({
    id: crypto2.randomUUID(),
    user_id: userId,
    actor_email: actorEmail,
    action,
    target,
    meta: JSON.stringify(meta),
    ip_address: ipAddress,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  if (db_default.data.activity_logs.length > 500) {
    db_default.data.activity_logs = db_default.data.activity_logs.slice(-500);
  }
  db_default.save();
}

// src/lib/mailer.ts
var BREVO_API_KEY = (process.env.BREVO_API_KEY || "").trim();
var FROM_EMAIL = "cinemaxmov01@gmail.com";
var configured = false;
if (BREVO_API_KEY) {
  configured = true;
  console.log("[mailer] Brevo API configured");
} else {
  console.log("[mailer] Brevo API not configured - BREVO_API_KEY missing");
}
function isMailerConfigured() {
  return configured;
}
function getMailerStatus() {
  return {
    configured,
    user: FROM_EMAIL
  };
}
async function sendOtpEmail(toEmail, otp) {
  await sendEmail(
    toEmail,
    `Your Cinemax admin login code: ${otp}`,
    `Your one-time login code is ${otp}. It expires in 10 minutes.`,
    buildCodeEmailHtml("Your admin login code", "Enter this code to finish signing in to the Cinemax admin panel.", otp)
  );
}
async function sendSignupVerificationEmail(toEmail, otp) {
  await sendEmail(
    toEmail,
    `Verify your Cinemax account: ${otp}`,
    `Your verification code is ${otp}. It expires in 10 minutes.`,
    buildCodeEmailHtml("Verify your email", "Enter this code to complete your Cinemax sign-up.", otp)
  );
}
async function sendPasswordResetEmail(toEmail, otp) {
  await sendEmail(
    toEmail,
    `Your Cinemax password reset code: ${otp}`,
    `Your password reset code is ${otp}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
    buildCodeEmailHtml("Reset your password", "Enter this code in Cinemax to choose a new password.", otp)
  );
}
function buildCodeEmailHtml(title, subtitle, otp) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
      <h2 style="color: #333; text-align: center;">Cinemax Verification</h2>
      <p>Please use the following One-Time Password (OTP) to complete your request. This code is valid for 10 minutes:</p>
      <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #e50914; margin: 20px 0; border-radius: 4px;">
        ${otp}
      </div>
      <p style="font-size: 12px; color: #777; text-align: center;">If you did not request this code, please ignore this email.</p>
    </div>
  `;
}
async function sendEmail(toEmail, subject, text, html) {
  if (!configured) {
    console.error("[mailer] Brevo API not configured");
    throw new Error("Email delivery is not configured on the server.");
  }
  try {
    console.log("[mailer] Sending via Brevo to:", toEmail);
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sender: { name: "Cinemax", email: FROM_EMAIL },
        to: [{ email: toEmail }],
        subject,
        htmlContent: html,
        textContent: text
      })
    });
    const data2 = await response.json();
    console.log("[mailer] Brevo response:", data2);
    if (response.ok) {
      console.log("[mailer] Brevo email sent successfully:", data2);
    } else {
      console.error("[mailer] Brevo API rejected the key/payload:", data2);
      throw new Error(`Brevo API error: ${response.status} - ${JSON.stringify(data2)}`);
    }
    console.log("[mailer] Email sent successfully via Brevo to:", toEmail);
  } catch (error) {
    console.error("[mailer] Brevo error:", error);
    throw new Error("Failed to send email via Brevo: " + (error?.message || "Unknown error"));
  }
}

// src/routes/website.ts
var LIST_STORAGE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;
var DOWNLOAD_STORAGE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;
var DEFAULT_ITEM_BYTES = 150 * 1024 * 1024;
var authRouter = Router();
function getUserExtras(userId) {
  const myList = (db_default.data.my_list || []).filter((w) => w.user_id === userId).sort((a, b) => a.added_at < b.added_at ? 1 : -1).map((w) => w.movie_id);
  const favorites = db_default.data.favorites.filter((f) => f.user_id === userId).sort((a, b) => a.added_at < b.added_at ? 1 : -1).map((f) => f.movie_id);
  const watchHistory = db_default.data.watch_history.filter((h) => h.user_id === userId).sort((a, b) => a.watched_at < b.watched_at ? 1 : -1).slice(0, 50);
  const watchlist = watchHistory.filter((h) => h.progress > 0 && h.progress < 100).map((h) => h.movie_id);
  const downloads = (db_default.data.downloads || []).filter((d) => d.user_id === userId).sort((a, b) => a.added_at < b.added_at ? 1 : -1);
  const listStorageUsed = computeListStorageUsed(userId);
  const downloadStorageUsed = downloads.reduce((sum, d) => sum + (d.size_bytes || 0), 0);
  return { myList, watchlist, favorites, watchHistory, downloads, listStorageUsed, listStorageLimit: LIST_STORAGE_LIMIT_BYTES, downloadStorageUsed, downloadStorageLimit: DOWNLOAD_STORAGE_LIMIT_BYTES };
}
function computeListStorageUsed(userId) {
  let total = 0;
  for (const item of (db_default.data.my_list || []).filter((m) => m.user_id === userId)) {
    total += item.estimated_bytes || DEFAULT_ITEM_BYTES;
  }
  for (const item of db_default.data.favorites.filter((f) => f.user_id === userId)) {
    total += DEFAULT_ITEM_BYTES;
  }
  for (const item of db_default.data.watch_history.filter((h) => h.user_id === userId && h.progress > 0)) {
    total += DEFAULT_ITEM_BYTES;
  }
  return total;
}
function userWithExtras(u) {
  return { ...publicUser(u), ...getUserExtras(u.id) };
}
authRouter.post("/api/auth/signup/request", rateLimit({ name: "signup-request", max: 5, windowMs: 15 * 60 * 1e3 }), async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !isValidEmail(email)) {
    res.status(400).json({ error: "Please enter a valid, real email address." });
    return;
  }
  if (!isStrongPassword(password || "")) {
    res.status(400).json({ error: "Password must be at least 8 characters with uppercase, lowercase, and a number." });
    return;
  }
  if (getUserByEmail(email)) {
    res.status(409).json({ error: "An account with this email already exists. Try signing in instead." });
    return;
  }
  if (!isMailerConfigured()) {
    res.status(503).json({ error: "Email delivery isn't configured on this server yet, so verification codes can't be sent. Please contact support." });
    return;
  }
  const displayName = name && String(name).trim() || email.split("@")[0];
  const otp = issueSignupVerification(email, displayName, password);
  try {
    await sendSignupVerificationEmail(email.toLowerCase().trim(), otp);
  } catch (err) {
    console.error("[auth] Failed to send signup verification:", err);
    res.status(502).json({ error: "Couldn't send the verification code right now. Please try again in a moment." });
    return;
  }
  res.status(200).json({ ok: true, message: "A 6-digit verification code has been sent to your email." });
});
authRouter.post("/api/auth/signup/verify", rateLimit({ name: "signup-verify", max: 8, windowMs: 15 * 60 * 1e3 }), (req, res) => {
  const { email, otp } = req.body || {};
  if (!email || !isValidEmail(email) || !otp) {
    res.status(400).json({ error: "Email and verification code are required." });
    return;
  }
  const result = verifySignupCode(email, String(otp));
  if (result.status === "not_found") {
    res.status(400).json({ error: "Request a new verification code first." });
    return;
  }
  if (result.status === "expired") {
    res.status(400).json({ error: "That code has expired. Please request a new one." });
    return;
  }
  if (result.status === "too_many_attempts") {
    res.status(429).json({ error: "Too many incorrect attempts. Request a new code." });
    return;
  }
  if (result.status === "invalid") {
    res.status(401).json({ error: "Incorrect verification code." });
    return;
  }
  if (result.status !== "ok") {
    res.status(400).json({ error: "Verification failed." });
    return;
  }
  const existing = getUserByEmail(email);
  if (existing) {
    res.status(409).json({
      error: "An account with this email already exists. Please sign in or use the 'Forgot Password' option if you've forgotten your password.",
      alreadyExists: true
    });
    return;
  }
  const user = createUser(email, "", result.name, result.passwordHash);
  db_default.data.notifications.push({
    id: crypto3.randomUUID(),
    user_id: user.id,
    type: "account",
    title: "Welcome to Cinemax",
    message: "Your account is verified and ready. Sign in to explore trending titles and build your lists.",
    read: 0,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  db_default.save();
  logActivity(user.email, "account_created", "user_account", { name: result.name }, user.id, req.ip);
  res.status(201).json({ ok: true, message: "Account created. You can now sign in." });
});
authRouter.post("/api/auth/signup", (req, res) => {
  res.status(400).json({ error: "Please verify your email first. Use signup/request then signup/verify." });
});
authRouter.post(
  "/api/auth/forgot-password/check-email",
  rateLimit({ name: "check-email", max: 10, windowMs: 10 * 60 * 1e3 }),
  (req, res) => {
    const { email } = req.body || {};
    if (!email || !isValidEmail(email)) {
      res.status(400).json({ error: "Please enter a valid email address." });
      return;
    }
    const normalized = email.toLowerCase().trim();
    const user = getUserByEmail(normalized);
    if (!user) {
      res.json({ found: false });
      return;
    }
    res.json({ found: true });
  }
);
authRouter.post(
  "/api/auth/forgot-password",
  rateLimit({ name: "forgot-password", max: 5, windowMs: 15 * 60 * 1e3 }),
  async (req, res) => {
    const { email } = req.body || {};
    if (!email || !isValidEmail(email)) {
      res.status(400).json({ error: "Please enter a valid email address." });
      return;
    }
    const normalized = email.toLowerCase().trim();
    const user = getUserByEmail(normalized);
    const genericResponse = () => res.json({
      ok: true,
      message: "If this email is registered with Cinemax, a 6-digit code has been sent to it."
    });
    if (!user) {
      genericResponse();
      return;
    }
    const cooldown = canSendPasswordReset(normalized);
    if (cooldown.status === "cooldown") {
      genericResponse();
      return;
    }
    if (!isMailerConfigured()) {
      res.status(503).json({ error: "Email delivery isn't configured on this server yet, so password reset codes can't be sent. Please contact support." });
      return;
    }
    const otp = issuePasswordReset(normalized);
    try {
      await sendPasswordResetEmail(normalized, otp);
    } catch (err) {
      console.error("[auth] Failed to send password reset email:", err);
      res.status(502).json({ error: "Couldn't send the reset code right now. Please try again in a moment." });
      return;
    }
    genericResponse();
  }
);
authRouter.post(
  "/api/auth/reset-password",
  rateLimit({ name: "reset-password", max: 8, windowMs: 15 * 60 * 1e3 }),
  (req, res) => {
    const { email, otp, newPassword } = req.body || {};
    if (!email || !isValidEmail(email) || !otp) {
      res.status(400).json({ error: "Email and the code sent to it are required." });
      return;
    }
    if (!isStrongPassword(newPassword || "")) {
      res.status(400).json({ error: "Password must be at least 8 characters with uppercase, lowercase, and a number." });
      return;
    }
    const result = verifyPasswordResetToken(email, String(otp));
    if (result === "not_found") {
      res.status(400).json({ error: "Request a new code first." });
      return;
    }
    if (result === "expired") {
      res.status(400).json({ error: "That code has expired. Please request a new one." });
      return;
    }
    if (result === "too_many_attempts") {
      res.status(429).json({ error: "Too many incorrect attempts. Please request a new code." });
      return;
    }
    if (result === "invalid") {
      res.status(401).json({ error: "Incorrect code. Please try again." });
      return;
    }
    const user = getUserByEmail(email);
    if (!user) {
      res.status(404).json({ error: "Account not found." });
      return;
    }
    updatePasswordHash(user.id, newPassword);
    consumePasswordReset(email);
    res.json({ ok: true, message: "Password updated. You can sign in now." });
  }
);
authRouter.post("/api/auth/login", rateLimit({ name: "login", max: 8, windowMs: 15 * 60 * 1e3 }), (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }
  const user = getUserByEmail(email);
  if (!user || !verifyPassword(user, password)) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }
  if (user.status === "banned") {
    res.status(403).json({ error: "This account has been banned. Contact support if you believe this is a mistake." });
    return;
  }
  if (user.status === "suspended") {
    res.status(403).json({ error: "This account is currently suspended." });
    return;
  }
  const token = signToken(user.id);
  setSessionCookie(res, token);
  logActivity(user.email, "login", "session", {}, user.id, req.ip);
  res.json({ user: userWithExtras(user), token });
});
authRouter.post("/api/auth/login/method", (req, res) => {
  const { email } = req.body || {};
  if (!email || !isValidEmail(email)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }
  res.json({ method: getAdminLoginMethod(email) });
});
authRouter.post("/api/auth/otp/request", rateLimit({ name: "otp-request", max: 5, windowMs: 15 * 60 * 1e3 }), async (req, res) => {
  const { email } = req.body || {};
  if (!email || !isValidEmail(email)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }
  const normalized = String(email).toLowerCase().trim();
  if (!isAdminEmail(normalized)) {
    res.status(403).json({ error: "OTP sign-in isn't available for this account." });
    return;
  }
  const user = getUserByEmail(normalized);
  if (!user) {
    res.status(403).json({ error: "OTP sign-in isn't available for this account." });
    return;
  }
  if (user.status === "banned") {
    res.status(403).json({ error: "This account has been banned. Contact support if you believe this is a mistake." });
    return;
  }
  if (user.status === "suspended") {
    res.status(403).json({ error: "This account is currently suspended." });
    return;
  }
  const cooldown = canSendOtp(normalized);
  if (cooldown.status === "cooldown") {
    res.status(429).json({ error: `Please wait ${Math.ceil(cooldown.retryAfterMs / 1e3)}s before requesting another code.` });
    return;
  }
  if (!isMailerConfigured()) {
    res.status(503).json({ error: "Email delivery isn't configured. Please sign in with your password instead.", code: "mailer_unavailable" });
    return;
  }
  const otp = issueOtp(normalized);
  try {
    await sendOtpEmail(normalized, otp);
  } catch (err) {
    console.error("[auth] Failed to send admin OTP email:", err);
    res.status(502).json({ error: "Couldn't send the code right now. Please try again in a moment." });
    return;
  }
  res.json({ ok: true, message: "A one-time code has been sent to your email." });
});
authRouter.post("/api/auth/otp/verify", rateLimit({ name: "otp-verify", max: 8, windowMs: 15 * 60 * 1e3 }), (req, res) => {
  const { email, otp } = req.body || {};
  if (!email || !isValidEmail(email) || !otp) {
    res.status(400).json({ error: "Email and code are required." });
    return;
  }
  const normalized = String(email).toLowerCase().trim();
  if (!isAdminEmail(normalized)) {
    res.status(403).json({ error: "OTP sign-in isn't available for this account." });
    return;
  }
  const result = verifyOtp(normalized, String(otp));
  if (result === "not_found") {
    res.status(400).json({ error: "Request a new code first." });
    return;
  }
  if (result === "expired") {
    res.status(400).json({ error: "That code has expired. Please request a new one." });
    return;
  }
  if (result === "too_many_attempts") {
    res.status(429).json({ error: "Too many incorrect attempts. Please request a new code." });
    return;
  }
  if (result === "invalid") {
    res.status(401).json({ error: "Incorrect code. Please try again." });
    return;
  }
  const user = getUserByEmail(normalized);
  if (!user) {
    res.status(403).json({ error: "OTP sign-in isn't available for this account." });
    return;
  }
  if (user.status === "banned") {
    res.status(403).json({ error: "This account has been banned. Contact support if you believe this is a mistake." });
    return;
  }
  if (user.status === "suspended") {
    res.status(403).json({ error: "This account is currently suspended." });
    return;
  }
  const token = signToken(user.id);
  setSessionCookie(res, token);
  res.json({ user: userWithExtras(user), token });
});
authRouter.post("/api/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});
authRouter.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: userWithExtras(req.user) });
});
authRouter.get("/api/auth/admin-portal-url", requireAuth, (req, res) => {
  if (req.user.role !== "admin") {
    res.status(403).json({ error: "Admin access only." });
    return;
  }
  const portalToken = signPortalToken(req.user.id);
  const base = (process.env.ADMIN_PANEL_URL || process.env.VITE_ADMIN_PANEL_URL || "http://localhost:5174").replace(/\/$/, "");
  res.json({ url: `${base}?token=${encodeURIComponent(portalToken)}` });
});
authRouter.post("/api/auth/portal/exchange", (req, res) => {
  const { token } = req.body || {};
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Secure link token is required." });
    return;
  }
  const userId = verifyPortalToken(token);
  if (!userId) {
    res.status(401).json({ error: "This secure link is invalid or has expired. Sign in from the website or use your admin credentials." });
    return;
  }
  const user = getUserById(userId);
  const sessionToken = signToken(user.id);
  res.json({ user: userWithExtras(user), token: sessionToken });
});
authRouter.post("/api/support/inquiries", (req, res) => {
  const subject = String(req.body?.subject || "").trim();
  const message = String(req.body?.message || "").trim();
  const guestName = String(req.body?.name || "").trim();
  const guestEmail = String(req.body?.email || "").trim();
  if (!subject || subject.length < 3) {
    res.status(400).json({ error: "Please enter a subject (at least 3 characters)." });
    return;
  }
  if (!message || message.length < 10) {
    res.status(400).json({ error: "Please describe your issue in at least 10 characters." });
    return;
  }
  if (subject.length > 200 || message.length > 5e3) {
    res.status(400).json({ error: "Subject or message is too long." });
    return;
  }
  const authedUserId = getOptionalUserId(req);
  let userName = guestName || "Guest";
  let userEmail = guestEmail;
  if (authedUserId) {
    const authed = getUserById(authedUserId);
    if (authed) {
      userName = authed.name;
      userEmail = authed.email;
    }
  } else {
    if (!isValidEmail(userEmail)) {
      res.status(400).json({ error: "Please sign in or provide a valid email address." });
      return;
    }
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const inquiry = {
    id: crypto3.randomUUID(),
    user_id: authedUserId,
    user_name: userName,
    user_email: userEmail,
    subject,
    message,
    status: "open",
    admin_reply: null,
    created_at: now,
    updated_at: now
  };
  db_default.data.support_inquiries.unshift(inquiry);
  db_default.save();
  res.status(201).json({ ok: true, inquiry: { id: inquiry.id, created_at: inquiry.created_at } });
});
authRouter.put("/api/auth/profile", requireAuth, (req, res) => {
  const { name, email } = req.body || {};
  const user = req.user;
  const nextName = (name ?? user.name).trim();
  const nextEmail = (email ?? user.email).trim();
  if (!nextName) {
    res.status(400).json({ error: "Display name cannot be empty." });
    return;
  }
  if (!isValidEmail(nextEmail)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }
  if (nextEmail.toLowerCase() !== user.email) {
    const conflict = getUserByEmail(nextEmail);
    if (conflict) {
      res.status(409).json({ error: "That email is already in use by another account." });
      return;
    }
  }
  user.name = nextName;
  user.email = nextEmail.toLowerCase();
  user.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  db_default.save();
  res.json({ user: userWithExtras(getUserById(user.id)) });
});
authRouter.put("/api/auth/password", requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = req.user;
  if (!verifyPassword(user, currentPassword || "")) {
    res.status(401).json({ error: "Current password is incorrect." });
    return;
  }
  if (!newPassword || !isStrongPassword(newPassword)) {
    res.status(400).json({ error: "New password must be at least 8 characters with uppercase, lowercase, and a number." });
    return;
  }
  updatePasswordHash(user.id, newPassword);
  res.json({ ok: true });
});
authRouter.put("/api/auth/avatar", requireAuth, (req, res) => {
  const { avatar, banner } = req.body || {};
  const MAX_AVATAR_BYTES = 6e5;
  if (typeof avatar === "string" && avatar.length > MAX_AVATAR_BYTES) {
    return res.status(400).json({ error: "Profile image is too large. Please use a photo under 500 KB." });
  }
  if (typeof banner === "string" && banner.length > MAX_AVATAR_BYTES) {
    return res.status(400).json({ error: "Banner image is too large." });
  }
  const user = req.user;
  user.avatar = avatar ?? user.avatar;
  user.banner = banner ?? user.banner;
  user.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  db_default.save();
  res.json({ user: userWithExtras(getUserById(user.id)) });
});
authRouter.put("/api/auth/preferences", requireAuth, (req, res) => {
  const user = req.user;
  let current = {};
  try {
    current = JSON.parse(user.preferences || "{}");
  } catch {
  }
  const merged = { ...current, ...req.body || {} };
  user.preferences = JSON.stringify(merged);
  user.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  db_default.save();
  res.json({ user: userWithExtras(getUserById(user.id)) });
});
authRouter.post("/api/auth/onboarding", requireAuth, (req, res) => {
  const { age, favoriteGenres } = req.body || {};
  const user = req.user;
  if (!age || !Array.isArray(favoriteGenres) || favoriteGenres.length === 0) {
    res.status(400).json({ error: "Age and favorite genres are required." });
    return;
  }
  if (favoriteGenres.length > 2) {
    res.status(400).json({ error: "You can select a maximum of 2 favorite genres." });
    return;
  }
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  let birthYear;
  if (age.includes("-")) {
    const [min, max] = age.split("-").map(Number);
    birthYear = currentYear - Math.floor((min + max) / 2);
  } else if (age.includes("+")) {
    const min = parseInt(age.replace("+", ""));
    birthYear = currentYear - min;
  } else {
    birthYear = currentYear - parseInt(age);
  }
  user.onboarding = {
    age: String(age),
    favoriteGenres: favoriteGenres.map(String),
    completedAt: (/* @__PURE__ */ new Date()).toISOString(),
    birthYear
  };
  user.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  db_default.save();
  logActivity(user.email, "completed_onboarding", "user_profile", { age, favoriteGenres }, user.id, req.ip);
  res.json({ ok: true, user: userWithExtras(getUserById(user.id)) });
});
authRouter.get("/api/auth/age-verification", requireAuth, (req, res) => {
  const user = req.user;
  const override = db_default.data.gens_access.find((g) => g.user_id === user.id);
  if (override) {
    override.last_accessed_at = (/* @__PURE__ */ new Date()).toISOString();
    override.access_count = (override.access_count || 0) + 1;
    db_default.save();
    return res.json({ allowed: true, adminOverride: true });
  }
  if (!user.onboarding || !user.onboarding.birthYear) {
    return res.json({
      allowed: false,
      reason: "You must complete onboarding with age information to access this content."
    });
  }
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  const currentAge = currentYear - user.onboarding.birthYear;
  const MIN_AGE = 18;
  const MAX_AGE = 35;
  if (currentAge < MIN_AGE) {
    return res.json({
      allowed: false,
      reason: `You must be at least ${MIN_AGE} years old to access this content. Your current age is ${currentAge}.`
    });
  }
  if (currentAge > MAX_AGE) {
    return res.json({
      allowed: false,
      reason: `Gens is available to members aged ${MIN_AGE}-${MAX_AGE}. Your current age is ${currentAge}.`
    });
  }
  res.json({
    allowed: true,
    currentAge,
    birthYear: user.onboarding.birthYear
  });
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const existing = db_default.data.gens_access.find((g) => g.user_id === user.id);
  if (existing) {
    existing.last_accessed_at = nowIso;
    existing.access_count += 1;
    existing.user_name = user.name;
    existing.user_email = user.email;
  } else {
    db_default.data.gens_access.push({
      user_id: user.id,
      user_name: user.name,
      user_email: user.email,
      first_accessed_at: nowIso,
      last_accessed_at: nowIso,
      access_count: 1
    });
  }
  db_default.save();
});
authRouter.delete("/api/auth/account", requireAuth, (req, res) => {
  const userId = req.user.id;
  db_default.data.users = db_default.data.users.filter((u) => u.id !== userId);
  db_default.data.watchlist = db_default.data.watchlist.filter((w) => w.user_id !== userId);
  db_default.data.my_list = (db_default.data.my_list || []).filter((w) => w.user_id !== userId);
  db_default.data.downloads = (db_default.data.downloads || []).filter((d) => d.user_id !== userId);
  db_default.data.favorites = db_default.data.favorites.filter((f) => f.user_id !== userId);
  db_default.data.watch_history = db_default.data.watch_history.filter((h) => h.user_id !== userId);
  db_default.data.notifications = db_default.data.notifications.filter((n) => n.user_id !== userId);
  db_default.save();
  clearSessionCookie(res);
  res.json({ ok: true });
});
authRouter.post("/api/auth/clear-cache", requireAuth, (req, res) => {
  const userId = req.user.id;
  db_default.data.my_list = (db_default.data.my_list || []).filter((w) => w.user_id !== userId);
  db_default.data.downloads = (db_default.data.downloads || []).filter((d) => d.user_id !== userId);
  db_default.data.favorites = db_default.data.favorites.filter((f) => f.user_id !== userId);
  db_default.data.watch_history = db_default.data.watch_history.filter((h) => h.user_id !== userId);
  db_default.data.notifications = db_default.data.notifications.filter((n) => n.user_id !== userId);
  db_default.data.watchlist = db_default.data.watchlist.filter((w) => w.user_id !== userId);
  db_default.save();
  res.json({ ok: true, user: userWithExtras(getUserById(userId)) });
});
authRouter.get("/api/comments/:movieId", (req, res) => {
  const movieId = Number(req.params.movieId);
  const comments = db_default.data.comments.filter((c) => c.movie_id === movieId && c.status === "approved").sort((a, b) => a.created_at < b.created_at ? 1 : -1);
  res.json({ comments });
});
authRouter.post("/api/comments", requireAuth, (req, res) => {
  const { movieId, movieTitle, text, rating } = req.body || {};
  if (!movieId || !text || !String(text).trim()) {
    res.status(400).json({ error: "movieId and text are required." });
    return;
  }
  const comment = {
    id: crypto3.randomUUID(),
    movie_id: Number(movieId),
    movie_title: movieTitle || null,
    user_id: req.user.id,
    user_name: req.user.name,
    text: String(text).trim().slice(0, 2e3),
    rating: rating != null ? Number(rating) : null,
    status: "pending",
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  db_default.data.comments.push(comment);
  db_default.save();
  res.status(201).json({ comment });
});
authRouter.get("/api/categories/hidden", (_req, res) => {
  const hiddenIds = db_default.data.category_overrides.filter((c) => c.hidden).map((c) => c.genre_id);
  res.json({ hiddenIds });
});
authRouter.get("/api/categories/public", (_req, res) => {
  const overrides = db_default.data.category_overrides;
  res.json({
    hiddenIds: overrides.filter((c) => c.hidden).map((c) => c.genre_id),
    labels: Object.fromEntries(
      overrides.filter((c) => c.label).map((c) => [String(c.genre_id), c.label])
    )
  });
});
authRouter.get("/api/content/custom", (_req, res) => {
  const movies = db_default.data.custom_content.map((c) => ({
    id: c.numeric_id,
    title: c.title,
    name: c.media_type === "tv" ? c.title : void 0,
    // For TV shows
    overview: c.overview,
    poster_path: c.poster_url,
    backdrop_path: c.backdrop_url,
    vote_average: c.rating,
    release_date: c.release_date || void 0,
    first_air_date: c.first_air_date || c.release_date || void 0,
    genre_ids: c.genre_ids || [],
    genres: c.genre_names.map((name, i) => ({ id: c.genre_ids?.[i] || i, name })),
    media_type: c.media_type,
    isCustom: true,
    trailerYoutubeKey: c.trailer_youtube_key || void 0,
    // Path to an admin-uploaded video file this site owns the rights to
    // (served by this same backend). Undefined means trailer-only.
    videoUrl: c.video_url || void 0,
    // External movie URL for third-party streaming sites
    fullMovieUrl: c.full_movie_url || void 0,
    featured: c.featured,
    // TV Show specific fields
    seasons: c.seasons,
    episodes: c.episodes,
    number_of_seasons: c.number_of_seasons,
    number_of_episodes: c.number_of_episodes,
    status: c.status,
    // Cast and crew
    cast: c.cast,
    crew: c.crew,
    // Additional metadata
    original_language: c.original_language,
    original_title: c.original_title,
    popularity: c.popularity,
    vote_count: c.vote_count,
    video: c.video
  }));
  res.json({ movies });
});
authRouter.get("/api/my-list", requireAuth, (req, res) => {
  res.json({ movieIds: getUserExtras(req.user.id).myList });
});
authRouter.post("/api/my-list", requireAuth, (req, res) => {
  const { movieId } = req.body || {};
  if (!movieId) {
    res.status(400).json({ error: "movieId is required." });
    return;
  }
  const userId = req.user.id;
  const used = computeListStorageUsed(userId);
  if (used + DEFAULT_ITEM_BYTES > LIST_STORAGE_LIMIT_BYTES) {
    res.status(413).json({ error: "List storage full (2GB limit). Remove items from My List, Favorites, or Watchlist to free space." });
    return;
  }
  const exists = (db_default.data.my_list || []).some((w) => w.user_id === userId && w.movie_id === movieId);
  if (!exists) {
    if (!db_default.data.my_list) db_default.data.my_list = [];
    db_default.data.my_list.push({
      user_id: userId,
      movie_id: movieId,
      added_at: (/* @__PURE__ */ new Date()).toISOString(),
      estimated_bytes: DEFAULT_ITEM_BYTES
    });
    db_default.save();
  }
  res.status(201).json({ ok: true });
});
authRouter.delete("/api/my-list/:movieId", requireAuth, (req, res) => {
  const userId = req.user.id;
  const movieId = Number(req.params.movieId);
  db_default.data.my_list = (db_default.data.my_list || []).filter((w) => !(w.user_id === userId && w.movie_id === movieId));
  db_default.save();
  res.json({ ok: true });
});
authRouter.get("/api/watchlist", requireAuth, (req, res) => {
  res.json({ movieIds: getUserExtras(req.user.id).watchlist });
});
authRouter.post("/api/watchlist", requireAuth, (req, res) => {
  const { movieId } = req.body || {};
  if (!movieId) {
    res.status(400).json({ error: "movieId is required." });
    return;
  }
  req.body = { movieId };
  const userId = req.user.id;
  const used = computeListStorageUsed(userId);
  if (used + DEFAULT_ITEM_BYTES > LIST_STORAGE_LIMIT_BYTES) {
    res.status(413).json({ error: "List storage full (2GB limit). Remove items to free space." });
    return;
  }
  if (!db_default.data.my_list) db_default.data.my_list = [];
  const exists = db_default.data.my_list.some((w) => w.user_id === userId && w.movie_id === movieId);
  if (!exists) {
    db_default.data.my_list.push({
      user_id: userId,
      movie_id: movieId,
      added_at: (/* @__PURE__ */ new Date()).toISOString(),
      estimated_bytes: DEFAULT_ITEM_BYTES
    });
    db_default.save();
  }
  res.status(201).json({ ok: true });
});
authRouter.delete("/api/watchlist/:movieId", requireAuth, (req, res) => {
  const userId = req.user.id;
  const movieId = Number(req.params.movieId);
  db_default.data.my_list = (db_default.data.my_list || []).filter((w) => !(w.user_id === userId && w.movie_id === movieId));
  db_default.save();
  res.json({ ok: true });
});
authRouter.get("/api/downloads", requireAuth, (req, res) => {
  const extras = getUserExtras(req.user.id);
  res.json({
    downloads: extras.downloads,
    storageUsed: extras.downloadStorageUsed,
    storageLimit: DOWNLOAD_STORAGE_LIMIT_BYTES
  });
});
authRouter.post("/api/downloads", requireAuth, (req, res) => {
  const { movieId, title, poster, sizeBytes, mediaType } = req.body || {};
  if (!movieId) {
    res.status(400).json({ error: "movieId is required." });
    return;
  }
  const userId = req.user.id;
  const size = Number(sizeBytes) || DEFAULT_ITEM_BYTES;
  if (size > DOWNLOAD_STORAGE_LIMIT_BYTES) {
    res.status(413).json({ error: "Single download cannot exceed 2GB." });
    return;
  }
  const extras = getUserExtras(userId);
  if (extras.downloadStorageUsed + size > DOWNLOAD_STORAGE_LIMIT_BYTES) {
    res.status(413).json({ error: "Download storage full (2GB). Delete downloads to free space." });
    return;
  }
  if (!db_default.data.downloads) db_default.data.downloads = [];
  const exists = db_default.data.downloads.some((d) => d.user_id === userId && d.movie_id === movieId);
  if (!exists) {
    db_default.data.downloads.push({
      user_id: userId,
      movie_id: movieId,
      title: title || "Untitled",
      poster: poster || null,
      size_bytes: size,
      added_at: (/* @__PURE__ */ new Date()).toISOString(),
      media_type: mediaType === "tv" ? "tv" : "movie"
    });
    db_default.save();
  }
  res.status(201).json({
    ok: true,
    storageUsed: getUserExtras(userId).downloadStorageUsed,
    storageLimit: DOWNLOAD_STORAGE_LIMIT_BYTES,
    downloads: getUserExtras(userId).downloads
  });
});
authRouter.delete("/api/downloads/:movieId", requireAuth, (req, res) => {
  const userId = req.user.id;
  const movieId = Number(req.params.movieId);
  db_default.data.downloads = (db_default.data.downloads || []).filter((d) => !(d.user_id === userId && d.movie_id === movieId));
  db_default.save();
  res.json({
    ok: true,
    storageUsed: getUserExtras(userId).downloadStorageUsed,
    storageLimit: DOWNLOAD_STORAGE_LIMIT_BYTES,
    downloads: getUserExtras(userId).downloads
  });
});
authRouter.get("/api/config/public", (_req, res) => {
  const settings = db_default.data.site_settings;
  res.json({
    tmdbApiKey: settings.apiKeys?.tmdb || process.env.TMDB_API_KEY || "",
    siteName: settings.siteName,
    heroTagline: settings.heroTagline,
    maintenanceMode: settings.maintenanceMode,
    featuredMovieIds: settings.featuredMovieIds || [],
    trendingOverrideIds: settings.trendingOverrideIds || [],
    hiddenMovieIds: settings.hiddenMovieIds || [],
    homepageSections: settings.homepageSections || [],
    contentPages: settings.contentPages || {},
    mailerEnabled: getMailerStatus().configured
  });
});
authRouter.get("/api/ads/public", (_req, res) => {
  const ads = db_default.data.ads.filter((a) => a.active).map((a) => ({
    id: a.id,
    title: a.title,
    image_url: a.image_url,
    target_url: a.target_url,
    placement: a.placement
  }));
  res.json({ ads });
});
authRouter.get("/api/download-apk", async (_req, res) => {
  const apkUrl = db_default.data.site_settings?.apkUrl || process.env.APK_URL || "";
  if (apkUrl && apkUrl.trim()) {
    try {
      const upstream = await fetch(apkUrl.trim(), { redirect: "follow" });
      if (!upstream.ok || !upstream.body) {
        res.status(502).json({ error: "Configured APK URL could not be downloaded." });
        return;
      }
      res.setHeader("content-type", upstream.headers.get("content-type") || "application/vnd.android.package-archive");
      res.setHeader("content-disposition", 'attachment; filename="cinemax.apk"');
      const len = upstream.headers.get("content-length");
      if (len) res.setHeader("content-length", len);
      Readable.fromWeb(upstream.body).pipe(res);
    } catch (err) {
      console.error("[apk] download failed:", err);
      res.status(502).json({ error: "Configured APK URL could not be downloaded." });
    }
    return;
  }
  res.status(404).json({
    error: "Native APK not available. Cinemax is a PWA. Set site_settings.apkUrl or APK_URL to enable direct APK downloads.",
    pwaInstructions: {
      desktop: "Click the install icon in your browser's address bar or use the 'Install App' button.",
      mobile: "Tap 'Add to Home Screen' from your browser's menu (iOS) or use the install prompt (Android)."
    }
  });
});
authRouter.get("/api/favorites", requireAuth, (req, res) => {
  res.json({ movieIds: getUserExtras(req.user.id).favorites });
});
authRouter.post("/api/favorites", requireAuth, (req, res) => {
  const { movieId } = req.body || {};
  if (!movieId) {
    res.status(400).json({ error: "movieId is required." });
    return;
  }
  const userId = req.user.id;
  const used = computeListStorageUsed(userId);
  if (used + DEFAULT_ITEM_BYTES > LIST_STORAGE_LIMIT_BYTES) {
    res.status(413).json({ error: "List storage full (2GB limit). Remove items to free space." });
    return;
  }
  const exists = db_default.data.favorites.some((f) => f.user_id === userId && f.movie_id === movieId);
  if (!exists) {
    db_default.data.favorites.push({ user_id: userId, movie_id: movieId, added_at: (/* @__PURE__ */ new Date()).toISOString() });
    db_default.save();
  }
  res.status(201).json({ ok: true });
});
authRouter.delete("/api/favorites/:movieId", requireAuth, (req, res) => {
  const userId = req.user.id;
  const movieId = Number(req.params.movieId);
  db_default.data.favorites = db_default.data.favorites.filter((f) => !(f.user_id === userId && f.movie_id === movieId));
  db_default.save();
  res.json({ ok: true });
});
authRouter.get("/api/notifications", requireAuth, (req, res) => {
  const notifications = db_default.data.notifications.filter((n) => n.user_id === req.user.id).sort((a, b) => a.created_at < b.created_at ? 1 : -1).slice(0, 50);
  res.json({ notifications });
});
authRouter.post("/api/notifications", requireAuth, (req, res) => {
  const { type, title, message } = req.body || {};
  if (!type || !title || !message) {
    res.status(400).json({ error: "type, title, and message are required." });
    return;
  }
  const id = crypto3.randomUUID();
  db_default.data.notifications.push({
    id,
    user_id: req.user.id,
    type,
    title,
    message,
    read: 0,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  db_default.save();
  res.status(201).json({ id });
});
authRouter.put("/api/notifications/:id/read", requireAuth, (req, res) => {
  const n = db_default.data.notifications.find((n2) => n2.id === req.params.id && n2.user_id === req.user.id);
  if (n) {
    n.read = 1;
    db_default.save();
  }
  res.json({ ok: true });
});
authRouter.put("/api/notifications/read-all", requireAuth, (req, res) => {
  db_default.data.notifications.forEach((n) => {
    if (n.user_id === req.user.id) n.read = 1;
  });
  db_default.save();
  res.json({ ok: true });
});
authRouter.delete("/api/notifications", requireAuth, (req, res) => {
  db_default.data.notifications = db_default.data.notifications.filter((n) => n.user_id !== req.user.id);
  db_default.save();
  res.json({ ok: true });
});
authRouter.get("/api/watch-history", requireAuth, (req, res) => {
  res.json({ history: getUserExtras(req.user.id).watchHistory });
});
authRouter.post("/api/watch-history", requireAuth, (req, res) => {
  const { movieId, title, poster, mediaType, duration, season, episode } = req.body || {};
  if (!movieId) {
    res.status(400).json({ error: "movieId is required." });
    return;
  }
  const userId = req.user.id;
  const existing = db_default.data.watch_history.find((h) => h.user_id === userId && h.movie_id === movieId);
  if (existing) {
    existing.watched_at = (/* @__PURE__ */ new Date()).toISOString();
  } else {
    db_default.data.watch_history.push({
      user_id: userId,
      movie_id: movieId,
      title: title || null,
      poster: poster || null,
      media_type: mediaType || null,
      duration: duration || 0,
      season: season ?? null,
      episode: episode ?? null,
      progress: 0,
      watched_at: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  db_default.save();
  res.status(201).json({ ok: true });
});
authRouter.put("/api/watch-history/:movieId/progress", requireAuth, (req, res) => {
  const userId = req.user.id;
  const movieId = Number(req.params.movieId);
  const { progress } = req.body || {};
  const existing = db_default.data.watch_history.find((h) => h.user_id === userId && h.movie_id === movieId);
  if (existing) {
    existing.progress = progress ?? 0;
    db_default.save();
  }
  res.json({ ok: true });
});
authRouter.delete("/api/watch-history", requireAuth, (req, res) => {
  db_default.data.watch_history = db_default.data.watch_history.filter((h) => h.user_id !== req.user.id);
  db_default.save();
  res.json({ ok: true });
});
function toPublicChatMessage(m, viewerId) {
  return {
    id: m.id,
    userId: m.user_id,
    userName: m.user_name,
    userAvatar: m.user_avatar,
    text: m.text,
    parentId: m.parent_id,
    likeCount: m.liked_by.length,
    likedByMe: viewerId ? m.liked_by.includes(viewerId) : false,
    createdAt: m.created_at,
    mediaUrl: m.media_url || null,
    mediaType: m.media_type || null
  };
}
function toPublicDirectMessage(m, viewerId) {
  return {
    id: m.id,
    fromUserId: m.from_user_id,
    toUserId: m.to_user_id,
    text: m.text,
    likeCount: m.liked_by.length,
    likedByMe: m.liked_by.includes(viewerId),
    read: m.read,
    createdAt: m.created_at,
    mediaUrl: m.media_url || null,
    mediaType: m.media_type || null
  };
}
var MAX_MEDIA_DATA_URL_LENGTH = 35e5;
authRouter.get("/api/chat/global", (req, res) => {
  const viewerId = getOptionalUserId(req);
  const messages = db_default.data.chat_messages.slice(-500).map((m) => toPublicChatMessage(m, viewerId));
  res.json({ messages });
});
authRouter.post("/api/chat/global", requireAuth, (req, res) => {
  const { text, parentId, mediaUrl, mediaType } = req.body || {};
  const trimmed = String(text || "").trim();
  if (mediaType && mediaType !== "image") {
    res.status(400).json({ error: "Voice messages can only be sent in your Inbox." });
    return;
  }
  if (!trimmed && !mediaUrl) {
    res.status(400).json({ error: "Message text or an image is required." });
    return;
  }
  if (trimmed.length > 1e3) {
    res.status(400).json({ error: "Messages must be 1000 characters or fewer." });
    return;
  }
  if (mediaUrl && (typeof mediaUrl !== "string" || mediaUrl.length > MAX_MEDIA_DATA_URL_LENGTH)) {
    res.status(400).json({ error: "That image is too large to send." });
    return;
  }
  if (parentId && !db_default.data.chat_messages.some((m) => m.id === parentId)) {
    res.status(404).json({ error: "The message you're replying to no longer exists." });
    return;
  }
  const message = {
    id: crypto3.randomUUID(),
    user_id: req.user.id,
    user_name: req.user.name,
    user_avatar: req.user.avatar,
    text: trimmed,
    parent_id: parentId || null,
    liked_by: [],
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    media_url: mediaUrl ? String(mediaUrl) : null,
    media_type: mediaUrl ? "image" : null
  };
  db_default.data.chat_messages.push(message);
  db_default.save();
  res.status(201).json({ message: toPublicChatMessage(message, req.user.id) });
});
authRouter.post("/api/chat/global/:id/like", requireAuth, (req, res) => {
  const message = db_default.data.chat_messages.find((m) => m.id === req.params.id);
  if (!message) {
    res.status(404).json({ error: "Message not found." });
    return;
  }
  const userId = req.user.id;
  const idx = message.liked_by.indexOf(userId);
  if (idx === -1) message.liked_by.push(userId);
  else message.liked_by.splice(idx, 1);
  db_default.save();
  res.json({ message: toPublicChatMessage(message, userId) });
});
authRouter.delete("/api/chat/global/:id", requireAuth, (req, res) => {
  const message = db_default.data.chat_messages.find((m) => m.id === req.params.id);
  if (!message) {
    res.status(404).json({ error: "Message not found." });
    return;
  }
  if (message.user_id !== req.user.id && req.user.role !== "admin") {
    res.status(403).json({ error: "You can only delete your own messages." });
    return;
  }
  db_default.data.chat_messages = db_default.data.chat_messages.filter((m) => m.id !== req.params.id && m.parent_id !== req.params.id);
  db_default.save();
  res.json({ ok: true });
});
authRouter.get("/api/chat/directory", requireAuth, (req, res) => {
  const people = db_default.data.users.filter((u) => u.id !== req.user.id && u.status === "active").map((u) => ({ id: u.id, name: u.name, avatar: u.avatar }));
  res.json({ people });
});
authRouter.get("/api/chat/conversations", requireAuth, (req, res) => {
  const myId = req.user.id;
  const related = db_default.data.direct_messages.filter((m) => m.from_user_id === myId || m.to_user_id === myId);
  const byPartner = /* @__PURE__ */ new Map();
  for (const m of related) {
    const partnerId = m.from_user_id === myId ? m.to_user_id : m.from_user_id;
    if (!byPartner.has(partnerId)) byPartner.set(partnerId, []);
    byPartner.get(partnerId).push(m);
  }
  const conversations = Array.from(byPartner.entries()).map(([partnerId, msgs]) => {
    const partner = getUserById(partnerId);
    const sorted = msgs.slice().sort((a, b) => a.created_at < b.created_at ? -1 : 1);
    const last = sorted[sorted.length - 1];
    const unreadCount = sorted.filter((m) => m.to_user_id === myId && !m.read).length;
    return {
      userId: partnerId,
      userName: partner?.name || "Deleted user",
      userAvatar: partner?.avatar || "",
      lastMessage: last.text,
      lastMessageAt: last.created_at,
      unreadCount
    };
  }).sort((a, b) => a.lastMessageAt < b.lastMessageAt ? 1 : -1);
  res.json({ conversations });
});
authRouter.get("/api/chat/conversations/:userId", requireAuth, (req, res) => {
  const myId = req.user.id;
  const partnerId = req.params.userId;
  if (!getUserById(partnerId)) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const thread = db_default.data.direct_messages.filter(
    (m) => m.from_user_id === myId && m.to_user_id === partnerId || m.from_user_id === partnerId && m.to_user_id === myId
  ).sort((a, b) => a.created_at < b.created_at ? -1 : 1);
  let changed = false;
  for (const m of thread) {
    if (m.to_user_id === myId && !m.read) {
      m.read = true;
      changed = true;
    }
  }
  if (changed) db_default.save();
  res.json({ messages: thread.map((m) => toPublicDirectMessage(m, myId)) });
});
authRouter.post("/api/chat/conversations/:userId", requireAuth, (req, res) => {
  const myId = req.user.id;
  const partnerId = req.params.userId;
  const partner = getUserById(partnerId);
  if (!partner) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  if (partnerId === myId) {
    res.status(400).json({ error: "You can't message yourself." });
    return;
  }
  const trimmed = String(req.body?.text || "").trim();
  const { mediaUrl, mediaType } = req.body || {};
  if (mediaType && mediaType !== "image" && mediaType !== "audio") {
    res.status(400).json({ error: "Unsupported attachment type." });
    return;
  }
  if (!trimmed && !mediaUrl) {
    res.status(400).json({ error: "Message text or an attachment is required." });
    return;
  }
  if (trimmed.length > 2e3) {
    res.status(400).json({ error: "Messages must be 2000 characters or fewer." });
    return;
  }
  if (mediaUrl && (typeof mediaUrl !== "string" || mediaUrl.length > MAX_MEDIA_DATA_URL_LENGTH)) {
    res.status(400).json({ error: "That attachment is too large to send." });
    return;
  }
  const message = {
    id: crypto3.randomUUID(),
    from_user_id: myId,
    to_user_id: partnerId,
    text: trimmed,
    liked_by: [],
    read: false,
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    media_url: mediaUrl ? String(mediaUrl) : null,
    media_type: mediaUrl ? mediaType === "audio" ? "audio" : "image" : null
  };
  db_default.data.direct_messages.push(message);
  db_default.save();
  db_default.data.notifications.push({
    id: crypto3.randomUUID(),
    user_id: partnerId,
    type: "message",
    title: `New message from ${req.user.name}`,
    message: trimmed ? trimmed.slice(0, 120) : mediaType === "audio" ? "\u{1F3A4} Voice message" : "\u{1F4F7} Image",
    read: 0,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  db_default.save();
  res.status(201).json({ message: toPublicDirectMessage(message, myId) });
});
authRouter.post("/api/chat/dm/:id/like", requireAuth, (req, res) => {
  const message = db_default.data.direct_messages.find((m) => m.id === req.params.id);
  if (!message) {
    res.status(404).json({ error: "Message not found." });
    return;
  }
  const myId = req.user.id;
  if (message.from_user_id !== myId && message.to_user_id !== myId) {
    res.status(403).json({ error: "You don't have access to this conversation." });
    return;
  }
  const idx = message.liked_by.indexOf(myId);
  if (idx === -1) message.liked_by.push(myId);
  else message.liked_by.splice(idx, 1);
  db_default.save();
  res.json({ message: toPublicDirectMessage(message, myId) });
});

// src/routes/admin.ts
import { Router as Router2 } from "express";
import crypto4 from "crypto";
import path2 from "path";
import fs2 from "fs";
import multer from "multer";
var adminRouter = Router2();
var UPLOADS_DIR = path2.join(process.cwd(), "uploads", "videos");
fs2.mkdirSync(UPLOADS_DIR, { recursive: true });
var videoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path2.extname(file.originalname).toLowerCase();
      cb(null, `${crypto4.randomUUID()}${ext}`);
    }
  }),
  limits: { fileSize: 4 * 1024 * 1024 * 1024 },
  // 4GB ceiling, tune as needed
  fileFilter: (_req, file, cb) => {
    const allowed = [".mp4", ".webm", ".mov", ".m4v"];
    const ext = path2.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      cb(new Error("Unsupported video format. Use mp4, webm, mov, or m4v."));
      return;
    }
    cb(null, true);
  }
});
adminRouter.use("/api/admin", requireAuth, requireAdmin);
adminRouter.get("/api/admin/stats", (_req, res) => {
  const users = db_default.data.users;
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1e3;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1e3;
  const signupsLast7d = users.filter((u) => new Date(u.created_at).getTime() >= sevenDaysAgo).length;
  const signupsLast30d = users.filter((u) => new Date(u.created_at).getTime() >= thirtyDaysAgo).length;
  const dailySignups = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(now - i * 24 * 60 * 60 * 1e3);
    const dayKey = day.toISOString().slice(0, 10);
    const count = users.filter((u) => u.created_at.slice(0, 10) === dayKey).length;
    dailySignups.push({ date: dayKey, count });
  }
  const watchCounts = /* @__PURE__ */ new Map();
  db_default.data.watch_history.forEach((h) => {
    const entry = watchCounts.get(h.movie_id) || { movieId: h.movie_id, title: h.title, poster: h.poster, count: 0 };
    entry.count += 1;
    watchCounts.set(h.movie_id, entry);
  });
  const topWatched = Array.from(watchCounts.values()).sort((a, b) => b.count - a.count).slice(0, 10);
  res.json({
    totalUsers: users.length,
    activeSessions: getActiveSessionCount(),
    activeUsers: users.filter((u) => u.status === "active").length,
    suspendedUsers: users.filter((u) => u.status === "suspended").length,
    bannedUsers: users.filter((u) => u.status === "banned").length,
    adminUsers: users.filter((u) => u.role === "admin").length,
    signupsLast7d,
    signupsLast30d,
    dailySignups,
    totalWatchlistEntries: db_default.data.watchlist.length,
    totalFavoriteEntries: db_default.data.favorites.length,
    totalWatchHistoryEntries: db_default.data.watch_history.length,
    totalComments: db_default.data.comments.length,
    pendingComments: db_default.data.comments.filter((c) => c.status === "pending").length,
    totalNotifications: db_default.data.notifications.length,
    totalAds: db_default.data.ads.length,
    activeAds: db_default.data.ads.filter((a) => a.active).length,
    totalDownloads: (db_default.data.downloads || []).length,
    openInquiries: (db_default.data.support_inquiries || []).filter((i) => i.status === "open").length,
    totalInquiries: (db_default.data.support_inquiries || []).length,
    topWatched
  });
});
adminRouter.post("/api/admin/users", (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !String(name).trim()) {
    res.status(400).json({ error: "Name is required." });
    return;
  }
  if (!email || !isValidEmail(email)) {
    res.status(400).json({ error: "A valid email is required." });
    return;
  }
  if (!password || String(password).length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }
  if (getUserByEmail(email)) {
    res.status(409).json({ error: "An account with that email already exists." });
    return;
  }
  const user = createUser(email, password, name);
  logActivity(req.user.email, "user.create", user.email);
  res.status(201).json({ user: publicUser(user) });
});
adminRouter.get("/api/admin/users", (req, res) => {
  const { search, status, role, page = "1", pageSize = "25" } = req.query;
  let list = db_default.data.users;
  if (search) {
    const q = search.toLowerCase();
    list = list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }
  if (status) list = list.filter((u) => u.status === status);
  if (role) list = list.filter((u) => u.role === role);
  list = [...list].sort((a, b) => a.created_at < b.created_at ? 1 : -1);
  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));
  const total = list.length;
  const paged = list.slice((p - 1) * ps, p * ps);
  res.json({
    total,
    page: p,
    pageSize: ps,
    users: paged.map((u) => ({
      ...publicUser(u),
      favoritesCount: db_default.data.favorites.filter((f) => f.user_id === u.id).length,
      watchlistCount: db_default.data.watchlist.filter((w) => w.user_id === u.id).length
    }))
  });
});
adminRouter.put("/api/admin/users/:id", (req, res) => {
  const target = getUserById(req.params.id);
  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const { name, email } = req.body || {};
  if (name) target.name = String(name).trim();
  if (email) target.email = String(email).toLowerCase().trim();
  target.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  db_default.save();
  logActivity(req.user.email, "user.update", target.email, { name, email });
  res.json({ user: publicUser(target) });
});
adminRouter.put("/api/admin/users/:id/status", (req, res) => {
  const target = getUserById(req.params.id);
  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const { status } = req.body || {};
  if (!["active", "suspended", "banned"].includes(status)) {
    res.status(400).json({ error: "status must be active, suspended, or banned." });
    return;
  }
  if (target.role === "admin") {
    res.status(400).json({ error: "Administrator accounts cannot be suspended or banned." });
    return;
  }
  target.status = status;
  target.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  db_default.save();
  logActivity(req.user.email, `user.${status}`, target.email);
  res.json({ user: publicUser(target) });
});
adminRouter.put("/api/admin/users/:id/role", (req, res) => {
  const target = getUserById(req.params.id);
  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const { role } = req.body || {};
  if (!["user", "admin"].includes(role)) {
    res.status(400).json({ error: "role must be user or admin." });
    return;
  }
  target.role = role;
  target.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  db_default.save();
  logActivity(req.user.email, "user.role_change", target.email, { role });
  res.json({ user: publicUser(target) });
});
adminRouter.delete("/api/admin/users/:id", (req, res) => {
  const target = getUserById(req.params.id);
  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  if (target.role === "admin") {
    res.status(400).json({ error: "Administrator accounts cannot be deleted from here." });
    return;
  }
  const userId = target.id;
  db_default.data.users = db_default.data.users.filter((u) => u.id !== userId);
  db_default.data.watchlist = db_default.data.watchlist.filter((w) => w.user_id !== userId);
  db_default.data.favorites = db_default.data.favorites.filter((f) => f.user_id !== userId);
  db_default.data.watch_history = db_default.data.watch_history.filter((h) => h.user_id !== userId);
  db_default.data.notifications = db_default.data.notifications.filter((n) => n.user_id !== userId);
  db_default.data.downloads = (db_default.data.downloads || []).filter((d) => d.user_id !== userId);
  db_default.data.my_list = (db_default.data.my_list || []).filter((m) => m.user_id !== userId);
  db_default.save();
  logActivity(req.user.email, "user.delete", target.email);
  res.json({ ok: true });
});
adminRouter.put("/api/admin/users/:id/subscription", (req, res) => {
  const target = getUserById(req.params.id);
  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const { subscription } = req.body || {};
  const allowed = ["Free", "Basic", "Standard", "Premium"];
  if (!allowed.includes(subscription)) {
    res.status(400).json({ error: `subscription must be one of: ${allowed.join(", ")}.` });
    return;
  }
  target.subscription = subscription;
  target.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  db_default.save();
  logActivity(req.user.email, "user.subscription", target.email, { subscription });
  res.json({ user: publicUser(target) });
});
adminRouter.get("/api/admin/users/:id/data", (req, res) => {
  const target = getUserById(req.params.id);
  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const userId = target.id;
  res.json({
    user: publicUser(target),
    favorites: db_default.data.favorites.filter((f) => f.user_id === userId).length,
    watchlist: db_default.data.watchlist.filter((w) => w.user_id === userId).length,
    myList: (db_default.data.my_list || []).filter((m) => m.user_id === userId).length,
    watchHistory: db_default.data.watch_history.filter((h) => h.user_id === userId).length,
    downloads: (db_default.data.downloads || []).filter((d) => d.user_id === userId).length,
    notifications: db_default.data.notifications.filter((n) => n.user_id === userId).length,
    comments: db_default.data.comments.filter((c) => c.user_id === userId).length
  });
});
adminRouter.delete("/api/admin/users/:id/data/:kind", (req, res) => {
  const target = getUserById(req.params.id);
  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const userId = target.id;
  const kind = req.params.kind;
  switch (kind) {
    case "watch_history":
      db_default.data.watch_history = db_default.data.watch_history.filter((h) => h.user_id !== userId);
      break;
    case "favorites":
      db_default.data.favorites = db_default.data.favorites.filter((f) => f.user_id !== userId);
      break;
    case "watchlist":
      db_default.data.watchlist = db_default.data.watchlist.filter((w) => w.user_id !== userId);
      break;
    case "my_list":
      db_default.data.my_list = (db_default.data.my_list || []).filter((m) => m.user_id !== userId);
      break;
    case "downloads":
      db_default.data.downloads = (db_default.data.downloads || []).filter((d) => d.user_id !== userId);
      break;
    case "notifications":
      db_default.data.notifications = db_default.data.notifications.filter((n) => n.user_id !== userId);
      break;
    default:
      res.status(400).json({ error: "kind must be watch_history, favorites, watchlist, my_list, downloads, or notifications." });
      return;
  }
  db_default.save();
  logActivity(req.user.email, `user.clear_${kind}`, target.email);
  res.json({ ok: true });
});
adminRouter.get("/api/admin/comments", (req, res) => {
  const { status } = req.query;
  let list = db_default.data.comments;
  if (status) list = list.filter((c) => c.status === status);
  list = [...list].sort((a, b) => a.created_at < b.created_at ? 1 : -1);
  res.json({ comments: list });
});
adminRouter.put("/api/admin/comments/:id/status", (req, res) => {
  const comment = db_default.data.comments.find((c) => c.id === req.params.id);
  if (!comment) {
    res.status(404).json({ error: "Comment not found." });
    return;
  }
  const { status } = req.body || {};
  if (!["pending", "approved", "rejected"].includes(status)) {
    res.status(400).json({ error: "status must be pending, approved, or rejected." });
    return;
  }
  comment.status = status;
  db_default.save();
  logActivity(req.user.email, `comment.${status}`, comment.id);
  res.json({ comment });
});
adminRouter.delete("/api/admin/comments/:id", (req, res) => {
  const comment = db_default.data.comments.find((c) => c.id === req.params.id);
  db_default.data.comments = db_default.data.comments.filter((c) => c.id !== req.params.id);
  db_default.save();
  if (comment) logActivity(req.user.email, "comment.delete", comment.id);
  res.json({ ok: true });
});
adminRouter.get("/api/admin/chat", (req, res) => {
  const { search } = req.query;
  let list = [...db_default.data.chat_messages].sort((a, b) => a.created_at < b.created_at ? 1 : -1);
  if (search) {
    const q = search.toLowerCase();
    list = list.filter((m) => m.text.toLowerCase().includes(q) || m.user_name.toLowerCase().includes(q));
  }
  res.json({
    messages: list.slice(0, 200).map((m) => ({
      id: m.id,
      userId: m.user_id,
      userName: m.user_name,
      userAvatar: m.user_avatar,
      text: m.text,
      mediaUrl: m.media_url,
      mediaType: m.media_type,
      createdAt: m.created_at
    }))
  });
});
adminRouter.delete("/api/admin/chat/:id", (req, res) => {
  const message = db_default.data.chat_messages.find((m) => m.id === req.params.id);
  db_default.data.chat_messages = db_default.data.chat_messages.filter((m) => m.id !== req.params.id && m.parent_id !== req.params.id);
  db_default.save();
  if (message) logActivity(req.user.email, "chat.delete", message.id);
  res.json({ ok: true });
});
adminRouter.get("/api/admin/ads", (_req, res) => {
  res.json({ ads: db_default.data.ads });
});
adminRouter.post("/api/admin/ads", (req, res) => {
  const { title, imageUrl, targetUrl, placement } = req.body || {};
  if (!title || !imageUrl || !targetUrl) {
    res.status(400).json({ error: "title, imageUrl, and targetUrl are required." });
    return;
  }
  const ad = {
    id: crypto4.randomUUID(),
    title,
    image_url: imageUrl,
    target_url: targetUrl,
    placement: placement || "homepage_top",
    active: true,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  db_default.data.ads.push(ad);
  db_default.save();
  logActivity(req.user.email, "ad.create", title);
  res.status(201).json({ ad });
});
adminRouter.put("/api/admin/ads/:id", (req, res) => {
  const ad = db_default.data.ads.find((a) => a.id === req.params.id);
  if (!ad) {
    res.status(404).json({ error: "Ad not found." });
    return;
  }
  const { title, imageUrl, targetUrl, placement, active } = req.body || {};
  if (title !== void 0) ad.title = title;
  if (imageUrl !== void 0) ad.image_url = imageUrl;
  if (targetUrl !== void 0) ad.target_url = targetUrl;
  if (placement !== void 0) ad.placement = placement;
  if (active !== void 0) ad.active = active;
  db_default.save();
  logActivity(req.user.email, "ad.update", ad.title);
  res.json({ ad });
});
adminRouter.delete("/api/admin/ads/:id", (req, res) => {
  const ad = db_default.data.ads.find((a) => a.id === req.params.id);
  db_default.data.ads = db_default.data.ads.filter((a) => a.id !== req.params.id);
  db_default.save();
  if (ad) logActivity(req.user.email, "ad.delete", ad.title);
  res.json({ ok: true });
});
adminRouter.post("/api/admin/notifications/broadcast", (req, res) => {
  const { title, message, type } = req.body || {};
  if (!title || !message) {
    res.status(400).json({ error: "title and message are required." });
    return;
  }
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  db_default.data.users.forEach((u) => {
    db_default.data.notifications.push({
      id: crypto4.randomUUID(),
      user_id: u.id,
      type: type || "announcement",
      title,
      message,
      read: 0,
      created_at: createdAt
    });
  });
  db_default.save();
  logActivity(req.user.email, "notification.broadcast", title, { recipients: db_default.data.users.length });
  res.status(201).json({ ok: true, recipients: db_default.data.users.length });
});
adminRouter.post("/api/admin/notifications/user", (req, res) => {
  const { userId, title, message, type } = req.body || {};
  if (!userId || !title || !message) {
    res.status(400).json({ error: "userId, title, and message are required." });
    return;
  }
  const target = getUserById(userId);
  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  db_default.data.notifications.push({
    id: crypto4.randomUUID(),
    user_id: target.id,
    type: type || "announcement",
    title,
    message,
    read: 0,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  db_default.save();
  logActivity(req.user.email, "notification.user", target.email, { title });
  res.status(201).json({ ok: true });
});
adminRouter.get("/api/admin/categories", (_req, res) => {
  res.json({ overrides: db_default.data.category_overrides });
});
adminRouter.put("/api/admin/categories/:genreId", (req, res) => {
  const genreId = Number(req.params.genreId);
  const { label, hidden } = req.body || {};
  let override = db_default.data.category_overrides.find((c) => c.genre_id === genreId);
  if (!override) {
    override = { genre_id: genreId, label: null, hidden: false };
    db_default.data.category_overrides.push(override);
  }
  if (label !== void 0) override.label = label;
  if (hidden !== void 0) override.hidden = hidden;
  db_default.save();
  logActivity(req.user.email, "category.update", String(genreId), { label, hidden });
  res.json({ override });
});
adminRouter.get("/api/admin/settings", (_req, res) => {
  res.json({ settings: db_default.data.site_settings });
});
adminRouter.put("/api/admin/settings", (req, res) => {
  db_default.data.site_settings = { ...db_default.data.site_settings, ...req.body || {} };
  db_default.save();
  logActivity(req.user.email, "settings.update", "site_settings", req.body || {});
  res.json({ settings: db_default.data.site_settings });
});
adminRouter.get("/api/admin/logs", (req, res) => {
  const { limit = "100" } = req.query;
  const n = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));
  const logs = [...db_default.data.activity_logs].sort((a, b) => a.created_at < b.created_at ? 1 : -1).slice(0, n);
  res.json({ logs });
});
adminRouter.get("/api/admin/gens-access", (_req, res) => {
  const nowYear = (/* @__PURE__ */ new Date()).getFullYear();
  const accessByUser = new Map(db_default.data.gens_access.map((g) => [g.user_id, g]));
  const directory = db_default.data.users.map((u) => {
    const g = accessByUser.get(u.id);
    const birthYear = u.onboarding?.birthYear || null;
    const currentAge = birthYear ? nowYear - birthYear : null;
    const ageEligible = currentAge != null && currentAge >= 18 && currentAge <= 35;
    const authorized = Boolean(g) || ageEligible || u.role === "admin";
    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      status: u.status,
      role: u.role,
      subscription: u.subscription,
      avatar: u.avatar,
      createdAt: u.created_at,
      onboarding: u.onboarding || null,
      birthYear,
      currentAge,
      ageEligible,
      adminOverride: Boolean(g),
      authorized,
      authorizationReason: g ? "admin_override" : u.role === "admin" ? "admin_role" : ageEligible ? "age_eligible" : "restricted",
      firstAccessedAt: g?.first_accessed_at || null,
      lastAccessedAt: g?.last_accessed_at || null,
      accessCount: g?.access_count || 0
    };
  }).sort((a, b) => {
    if (a.authorized !== b.authorized) return a.authorized ? -1 : 1;
    return a.email.localeCompare(b.email);
  });
  res.json({
    total: directory.length,
    authorized: directory.filter((u) => u.authorized).length,
    unauthorized: directory.filter((u) => !u.authorized).length,
    users: directory
  });
});
adminRouter.post("/api/admin/gens-access/:userId/grant", (req, res) => {
  const userId = req.params.userId;
  const target = getUserById(userId);
  if (!target) return res.status(404).json({ error: "User not found." });
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const existing = db_default.data.gens_access.find((g) => g.user_id === userId);
  if (existing) {
    existing.last_accessed_at = nowIso;
    existing.access_count = (existing.access_count || 0) + 1;
    existing.user_name = target.name;
    existing.user_email = target.email;
  } else {
    db_default.data.gens_access.push({
      user_id: userId,
      user_name: target.name,
      user_email: target.email,
      first_accessed_at: nowIso,
      last_accessed_at: nowIso,
      access_count: 1
    });
  }
  db_default.save();
  logActivity(req.user.email, "gens.grant", target.email);
  res.json({ ok: true });
});
adminRouter.delete("/api/admin/gens-access/:userId/revoke", (req, res) => {
  const userId = req.params.userId;
  const existing = db_default.data.gens_access.find((g) => g.user_id === userId);
  if (!existing) return res.status(404).json({ error: "Gens access record not found." });
  db_default.data.gens_access = db_default.data.gens_access.filter((g) => g.user_id !== userId);
  db_default.save();
  logActivity(req.user.email, "gens.revoke", userId);
  res.json({ ok: true });
});
adminRouter.get("/api/admin/ai/control", (_req, res) => {
  const logs = [...db_default.data.ai_chat_history || []].sort((a, b) => a.created_at < b.created_at ? 1 : -1);
  const memory = [...db_default.data.ai_memory || []].sort((a, b) => a.updated_at < b.updated_at ? 1 : -1);
  const totalTokens = logs.reduce((sum, item) => sum + (item.tokens_estimate || 0), 0);
  res.json({
    settings: {
      aiEnabled: db_default.data.site_settings.aiEnabled,
      aiPrimaryModel: db_default.data.site_settings.aiPrimaryModel,
      aiModel: db_default.data.site_settings.aiModel,
      aiSystemPromptExtra: db_default.data.site_settings.aiSystemPromptExtra
    },
    stats: {
      totalMessages: logs.length,
      totalTokensEstimate: totalTokens,
      geminiMessages: logs.filter((l) => l.engine === "gemini").length,
      groqMessages: logs.filter((l) => l.engine === "groq").length,
      memoryItems: memory.length
    },
    recentLogs: logs.slice(0, 100),
    memory
  });
});
adminRouter.put("/api/admin/ai/settings", (req, res) => {
  const { aiEnabled, aiPrimaryModel, aiModel, aiSystemPromptExtra } = req.body || {};
  if (aiEnabled !== void 0) db_default.data.site_settings.aiEnabled = !!aiEnabled;
  if (aiPrimaryModel !== void 0) db_default.data.site_settings.aiPrimaryModel = String(aiPrimaryModel || "gemini-2.5-flash").trim();
  if (aiModel !== void 0) db_default.data.site_settings.aiModel = String(aiModel || "llama-3.3-70b-versatile").trim();
  if (aiSystemPromptExtra !== void 0) db_default.data.site_settings.aiSystemPromptExtra = String(aiSystemPromptExtra || "").slice(0, 2e4);
  db_default.save();
  logActivity(req.user.email, "ai.settings", "AI Control", req.body || {});
  res.json({ settings: db_default.data.site_settings });
});
adminRouter.post("/api/admin/ai/memory", (req, res) => {
  const title = String(req.body?.title || "").trim();
  const content = String(req.body?.content || "").trim();
  if (!title || !content) {
    res.status(400).json({ error: "title and content are required." });
    return;
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const item = {
    id: crypto4.randomUUID(),
    title: title.slice(0, 160),
    content: content.slice(0, 8e3),
    enabled: req.body?.enabled !== false,
    source: "admin",
    created_at: now,
    updated_at: now
  };
  db_default.data.ai_memory.push(item);
  db_default.save();
  logActivity(req.user.email, "ai.memory.create", item.title);
  res.status(201).json({ item });
});
adminRouter.put("/api/admin/ai/memory/:id", (req, res) => {
  const item = db_default.data.ai_memory.find((m) => m.id === req.params.id);
  if (!item) {
    res.status(404).json({ error: "Memory item not found." });
    return;
  }
  if (req.body?.title !== void 0) item.title = String(req.body.title || "").trim().slice(0, 160);
  if (req.body?.content !== void 0) item.content = String(req.body.content || "").trim().slice(0, 8e3);
  if (req.body?.enabled !== void 0) item.enabled = !!req.body.enabled;
  item.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  db_default.save();
  logActivity(req.user.email, "ai.memory.update", item.title);
  res.json({ item });
});
adminRouter.delete("/api/admin/ai/memory/:id", (req, res) => {
  const item = db_default.data.ai_memory.find((m) => m.id === req.params.id);
  db_default.data.ai_memory = db_default.data.ai_memory.filter((m) => m.id !== req.params.id);
  db_default.save();
  if (item) logActivity(req.user.email, "ai.memory.delete", item.title);
  res.json({ ok: true });
});
adminRouter.get("/api/admin/tmdb/search", async (req, res) => {
  try {
    const { query, type = "multi" } = req.query;
    const tmdbKey = db_default.data.site_settings.apiKeys.tmdb;
    if (!tmdbKey) {
      return res.status(503).json({ error: "TMDB API key not configured" });
    }
    if (!query || String(query).trim().length < 2) {
      return res.status(400).json({ error: "Search query is required" });
    }
    const searchQuery = String(query).trim();
    const url = type === "movie" ? `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&query=${encodeURIComponent(searchQuery)}` : type === "tv" ? `https://api.themoviedb.org/3/search/tv?api_key=${tmdbKey}&query=${encodeURIComponent(searchQuery)}` : `https://api.themoviedb.org/3/search/multi?api_key=${tmdbKey}&query=${encodeURIComponent(searchQuery)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }
    const data2 = await response.json();
    res.json({ results: data2.results || [] });
  } catch (error) {
    console.error("[admin] TMDB search error:", error);
    res.status(500).json({ error: "Failed to search TMDB" });
  }
});
adminRouter.get("/api/admin/tmdb/details/:type/:id", async (req, res) => {
  try {
    const { type, id } = req.params;
    const tmdbKey = db_default.data.site_settings.apiKeys.tmdb;
    if (!tmdbKey) {
      return res.status(503).json({ error: "TMDB API key not configured" });
    }
    if (!["movie", "tv"].includes(type)) {
      return res.status(400).json({ error: "Invalid media type" });
    }
    const detailsUrl = `https://api.themoviedb.org/3/${type}/${id}?api_key=${tmdbKey}&append_to_response=credits,videos,external_ids`;
    const detailsResponse = await fetch(detailsUrl);
    if (!detailsResponse.ok) {
      throw new Error(`TMDB details error: ${detailsResponse.status}`);
    }
    const details = await detailsResponse.json();
    let seasons = [];
    let episodes = [];
    if (type === "tv" && details.seasons) {
      for (const season of details.seasons) {
        if (season.season_number === 0) continue;
        const seasonUrl = `https://api.themoviedb.org/3/tv/${id}/season/${season.season_number}?api_key=${tmdbKey}`;
        const seasonResponse = await fetch(seasonUrl);
        if (seasonResponse.ok) {
          const seasonData = await seasonResponse.json();
          seasons.push({
            season_number: season.season_number,
            name: season.name,
            overview: season.overview,
            poster_path: season.poster_path,
            air_date: season.air_date,
            episode_count: season.episode_count
          });
          if (seasonData.episodes) {
            for (const ep of seasonData.episodes) {
              episodes.push({
                episode_number: ep.episode_number,
                season_number: ep.season_number,
                name: ep.name,
                overview: ep.overview,
                still_path: ep.still_path,
                air_date: ep.air_date,
                runtime: ep.runtime
              });
            }
          }
        }
      }
    }
    const trailer = details.videos?.results?.find((v) => v.type === "Trailer" && v.site === "YouTube");
    res.json({
      details: {
        tmdb_id: details.id,
        title: details.title || details.name,
        original_title: details.original_title || details.original_name,
        overview: details.overview,
        poster_path: details.poster_path,
        backdrop_path: details.backdrop_path,
        release_date: details.release_date || details.first_air_date,
        first_air_date: details.first_air_date,
        last_air_date: details.last_air_date,
        status: details.status,
        number_of_seasons: details.number_of_seasons,
        number_of_episodes: details.number_of_episodes,
        genres: details.genres || [],
        genre_ids: (details.genres || []).map((g) => g.id),
        genre_names: (details.genres || []).map((g) => g.name),
        vote_average: details.vote_average,
        vote_count: details.vote_count,
        popularity: details.popularity,
        original_language: details.original_language,
        runtime: details.runtime,
        trailer_youtube_key: trailer?.key || null
      },
      cast: (details.credits?.cast || []).slice(0, 20).map((c) => ({
        id: c.id,
        name: c.name,
        character: c.character,
        profile_path: c.profile_path,
        order: c.order
      })),
      crew: (details.credits?.crew || []).slice(0, 10).map((c) => ({
        id: c.id,
        name: c.name,
        job: c.job,
        department: c.department,
        profile_path: c.profile_path
      })),
      seasons,
      episodes
    });
  } catch (error) {
    console.error("[admin] TMDB details error:", error);
    res.status(500).json({ error: "Failed to fetch TMDB details" });
  }
});
adminRouter.get("/api/admin/content", (req, res) => {
  const { search, mediaType, featured } = req.query;
  let items = [...db_default.data.custom_content].sort((a, b) => a.created_at < b.created_at ? 1 : -1);
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(
      (item) => item.title.toLowerCase().includes(q) || item.overview.toLowerCase().includes(q)
    );
  }
  if (mediaType) {
    items = items.filter((item) => item.media_type === mediaType);
  }
  if (featured !== void 0) {
    const isFeatured = featured === "true";
    items = items.filter((item) => item.featured === isFeatured);
  }
  res.json({
    items,
    total: items.length,
    featuredCount: items.filter((i) => i.featured).length,
    movieCount: items.filter((i) => i.media_type === "movie").length,
    tvCount: items.filter((i) => i.media_type === "tv").length
  });
});
adminRouter.post("/api/admin/content", (req, res) => {
  const {
    title,
    overview,
    posterUrl,
    backdropUrl,
    trailerYoutubeKey,
    mediaType,
    genreNames,
    genreIds,
    releaseDate,
    rating,
    featured,
    // TMDB import fields
    tmdbId,
    seasons,
    episodes,
    cast,
    crew,
    firstAirDate,
    lastAirDate,
    status,
    numberOfSeasons,
    numberOfEpisodes,
    originalLanguage,
    originalTitle,
    popularity,
    voteCount,
    video,
    videoUrl,
    fullMovieUrl
  } = req.body || {};
  if (!title || !String(title).trim()) {
    res.status(400).json({ error: "Title is required." });
    return;
  }
  if (!posterUrl || !String(posterUrl).trim()) {
    res.status(400).json({ error: "A poster image URL is required." });
    return;
  }
  if (fullMovieUrl && String(fullMovieUrl).trim()) {
    const urlStr = String(fullMovieUrl).trim();
    try {
      new URL(urlStr);
    } catch {
      res.status(400).json({ error: "Full Movie URL must be a valid URL (e.g., https://example.com/movie/avatar)." });
      return;
    }
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const item = {
    id: crypto4.randomUUID(),
    numeric_id: db_default.nextCustomContentId(),
    tmdb_id: tmdbId || null,
    title: String(title).trim().slice(0, 200),
    overview: String(overview || "").trim().slice(0, 2e3),
    poster_url: String(posterUrl).trim(),
    backdrop_url: String(backdropUrl || posterUrl).trim(),
    trailer_youtube_key: String(trailerYoutubeKey || "").trim(),
    media_type: mediaType === "tv" ? "tv" : "movie",
    genre_names: Array.isArray(genreNames) ? genreNames.map(String).slice(0, 6) : [],
    genre_ids: Array.isArray(genreIds) ? genreIds.map(Number).slice(0, 6) : [],
    release_date: releaseDate || null,
    rating: Math.min(10, Math.max(0, Number(rating) || 0)),
    featured: !!featured,
    // TV Show specific fields
    seasons: seasons || void 0,
    episodes: episodes || void 0,
    first_air_date: firstAirDate || null,
    last_air_date: lastAirDate || null,
    status: status || null,
    number_of_seasons: numberOfSeasons || void 0,
    number_of_episodes: numberOfEpisodes || void 0,
    // Cast and crew
    cast: cast || void 0,
    crew: crew || void 0,
    // Additional metadata
    original_language: originalLanguage || void 0,
    original_title: originalTitle || void 0,
    popularity: popularity || void 0,
    vote_count: voteCount || void 0,
    video: video || void 0,
    video_url: videoUrl || null,
    full_movie_url: fullMovieUrl ? String(fullMovieUrl).trim() : null,
    created_at: now,
    updated_at: now
  };
  db_default.data.custom_content.push(item);
  db_default.save();
  logActivity(req.user.email, "content.create", item.title, { id: item.id, tmdb_id: item.tmdb_id });
  res.status(201).json({ item });
});
adminRouter.put("/api/admin/content/:id", (req, res) => {
  const item = db_default.data.custom_content.find((c) => c.id === req.params.id);
  if (!item) {
    res.status(404).json({ error: "Content not found." });
    return;
  }
  const { title, overview, posterUrl, backdropUrl, trailerYoutubeKey, mediaType, genreNames, releaseDate, rating, featured, fullMovieUrl } = req.body || {};
  if (fullMovieUrl !== void 0 && String(fullMovieUrl).trim()) {
    const urlStr = String(fullMovieUrl).trim();
    try {
      new URL(urlStr);
    } catch {
      res.status(400).json({ error: "Full Movie URL must be a valid URL (e.g., https://example.com/movie/avatar)." });
      return;
    }
  }
  if (title !== void 0) item.title = String(title).trim().slice(0, 200);
  if (overview !== void 0) item.overview = String(overview).trim().slice(0, 2e3);
  if (posterUrl !== void 0) item.poster_url = String(posterUrl).trim();
  if (backdropUrl !== void 0) item.backdrop_url = String(backdropUrl).trim();
  if (trailerYoutubeKey !== void 0) item.trailer_youtube_key = String(trailerYoutubeKey).trim();
  if (mediaType !== void 0) item.media_type = mediaType === "tv" ? "tv" : "movie";
  if (genreNames !== void 0) item.genre_names = Array.isArray(genreNames) ? genreNames.map(String).slice(0, 6) : [];
  if (releaseDate !== void 0) item.release_date = releaseDate || null;
  if (rating !== void 0) item.rating = Math.min(10, Math.max(0, Number(rating) || 0));
  if (featured !== void 0) item.featured = !!featured;
  if (fullMovieUrl !== void 0) item.full_movie_url = fullMovieUrl ? String(fullMovieUrl).trim() : null;
  item.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  db_default.save();
  logActivity(req.user.email, "content.update", item.title, { id: item.id });
  res.json({ item });
});
adminRouter.post("/api/admin/content/:id/video", videoUpload.single("video"), (req, res) => {
  const item = db_default.data.custom_content.find((c) => c.id === req.params.id);
  if (!item) {
    res.status(404).json({ error: "Content not found." });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "No video file was uploaded." });
    return;
  }
  if (item.video_url) {
    const oldPath = path2.join(process.cwd(), item.video_url.replace(/^\//, ""));
    fs2.unlink(oldPath, () => {
    });
  }
  item.video_url = `/uploads/videos/${req.file.filename}`;
  item.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  db_default.save();
  logActivity(req.user.email, "content.video_upload", item.title, { id: item.id });
  res.status(201).json({ item });
});
adminRouter.delete("/api/admin/content/:id/video", (req, res) => {
  const item = db_default.data.custom_content.find((c) => c.id === req.params.id);
  if (!item) {
    res.status(404).json({ error: "Content not found." });
    return;
  }
  if (item.video_url) {
    const oldPath = path2.join(process.cwd(), item.video_url.replace(/^\//, ""));
    fs2.unlink(oldPath, () => {
    });
  }
  item.video_url = null;
  item.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  db_default.save();
  logActivity(req.user.email, "content.video_remove", item.title, { id: item.id });
  res.json({ item });
});
adminRouter.delete("/api/admin/content/:id", (req, res) => {
  const item = db_default.data.custom_content.find((c) => c.id === req.params.id);
  if (item?.video_url) {
    const oldPath = path2.join(process.cwd(), item.video_url.replace(/^\//, ""));
    fs2.unlink(oldPath, () => {
    });
  }
  db_default.data.custom_content = db_default.data.custom_content.filter((c) => c.id !== req.params.id);
  db_default.save();
  if (item) logActivity(req.user.email, "content.delete", item.title, { id: item.id });
  res.json({ ok: true });
});
adminRouter.get("/api/admin/social-media", (_req, res) => {
  const links = db_default.data.site_settings.socialMediaLinks || [];
  res.json(links);
});
adminRouter.post("/api/admin/social-media", (req, res) => {
  const { platform, url, icon, name, enabled = true } = req.body;
  if (!platform || !url || !icon || !name) {
    res.status(400).json({ error: "Missing required fields: platform, url, icon, name" });
    return;
  }
  const newLink = {
    id: crypto4.randomUUID(),
    platform,
    url,
    icon,
    name,
    enabled
  };
  db_default.data.site_settings.socialMediaLinks.push(newLink);
  db_default.save();
  logActivity(req.user.email, "create_social_media", `Created social media link: ${name}`, { platform, url });
  res.status(201).json(newLink);
});
adminRouter.put("/api/admin/social-media/:id", (req, res) => {
  const { id } = req.params;
  const { platform, url, icon, name, enabled } = req.body;
  const linkIndex = db_default.data.site_settings.socialMediaLinks.findIndex((l) => l.id === id);
  if (linkIndex === -1) {
    res.status(404).json({ error: "Social media link not found" });
    return;
  }
  const link = db_default.data.site_settings.socialMediaLinks[linkIndex];
  if (platform !== void 0) link.platform = platform;
  if (url !== void 0) link.url = url;
  if (icon !== void 0) link.icon = icon;
  if (name !== void 0) link.name = name;
  if (enabled !== void 0) link.enabled = enabled;
  db_default.save();
  logActivity(req.user.email, "update_social_media", `Updated social media link: ${link.name}`, { id, platform, url });
  res.json(link);
});
adminRouter.delete("/api/admin/social-media/:id", (req, res) => {
  const { id } = req.params;
  const linkIndex = db_default.data.site_settings.socialMediaLinks.findIndex((l) => l.id === id);
  if (linkIndex === -1) {
    res.status(404).json({ error: "Social media link not found" });
    return;
  }
  const removed = db_default.data.site_settings.socialMediaLinks.splice(linkIndex, 1)[0];
  db_default.save();
  logActivity(req.user.email, "delete_social_media", `Deleted social media link: ${removed.name}`, { id });
  res.json({ success: true });
});
adminRouter.get("/api/admin/inquiries", (req, res) => {
  const status = String(req.query.status || "").trim();
  let items = [...db_default.data.support_inquiries || []].sort(
    (a, b) => a.created_at < b.created_at ? 1 : -1
  );
  if (status && ["open", "replied", "closed"].includes(status)) {
    items = items.filter((i) => i.status === status);
  }
  const search = String(req.query.search || "").trim().toLowerCase();
  if (search) {
    items = items.filter(
      (i) => i.subject.toLowerCase().includes(search) || i.message.toLowerCase().includes(search) || i.user_email.toLowerCase().includes(search) || i.user_name.toLowerCase().includes(search)
    );
  }
  res.json({ inquiries: items });
});
adminRouter.put("/api/admin/inquiries/:id", (req, res) => {
  const item = (db_default.data.support_inquiries || []).find((i) => i.id === req.params.id);
  if (!item) {
    res.status(404).json({ error: "Inquiry not found." });
    return;
  }
  const { status, adminReply } = req.body || {};
  if (status !== void 0) {
    if (!["open", "replied", "closed"].includes(status)) {
      res.status(400).json({ error: "Invalid status." });
      return;
    }
    item.status = status;
  }
  if (adminReply !== void 0) {
    item.admin_reply = String(adminReply || "").trim() || null;
    if (item.admin_reply && item.status === "open") item.status = "replied";
  }
  item.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  db_default.save();
  logActivity(req.user.email, "inquiry.update", item.subject, { id: item.id, status: item.status });
  res.json({ inquiry: item });
});
adminRouter.delete("/api/admin/inquiries/:id", (req, res) => {
  const item = (db_default.data.support_inquiries || []).find((i) => i.id === req.params.id);
  db_default.data.support_inquiries = (db_default.data.support_inquiries || []).filter((i) => i.id !== req.params.id);
  db_default.save();
  if (item) logActivity(req.user.email, "inquiry.delete", item.subject, { id: item.id });
  res.json({ ok: true });
});

// config/db.ts
import mongoose2 from "mongoose";
var didAttemptConnection = false;
async function connectDB() {
  if (mongoose2.connection.readyState === 1) {
    return;
  }
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    if (!didAttemptConnection) {
      console.warn("[db] MONGO_URI not configured; continuing with the file-backed store.");
      didAttemptConnection = true;
    }
    return;
  }
  if (didAttemptConnection && mongoose2.connection.readyState === 2) {
    return;
  }
  didAttemptConnection = true;
  await mongoose2.connect(mongoUri);
  console.log("[db] Connected to MongoDB.");
}

// src/lib/assistantKnowledge.ts
function buildCinemaxKnowledgeBase() {
  return `
CINEMAX \u2014 COMPLETE SITE KNOWLEDGE BASE

PLATFORM OVERVIEW:
Cinemax is a movie & TV discovery platform. Users browse TMDB-backed catalogs, watch official trailers, watch admin-uploaded titles the site owns the rights to, manage watchlists, chat live, and use AI features.

NAVIGATION & PAGES:
- Home: hero banner, curated shelves (Originals, Trending, TV, Popular, Top Rated, Upcoming, Now Playing), Up Next row, Live Chat (Popular global feed + Inbox DMs), footer.
- Movies / TV Shows: genre filters, search, grid browsing.
- Shorts: vertical autoplay trailer feed.
- My List: saved-for-later titles (sign-in required).
- Watchlist: continue-watching with progress bars.
- History / Favorites / Downloads: personal libraries.
- Profile / Settings: animated & cartoon avatars, custom photo upload, account details, security, preferences (theme, 12 languages, autoplay, quality, notifications, data saver, reduced motion, compact layout), danger zone.
- Help Desk: AI chat (All Kiki's), FAQ, contact form \u2192 admin Help Desk.
- About page, landing page for new visitors.

AUTH & ACCOUNTS:
- Sign up with email verification OTP; sign in with password.
- Guest mode: browse and watch, but My List, Favorites, Profile, Downloads locked.
- Forgot password flow site-wide.
- Admin account (allkikisweb@gmail.com): OTP or password login; on sign-in sees "Go to Admin Panel" or "Go to Website" card; external admin panel at ADMIN_PANEL_URL with JWT handoff.

PLAYER:
- Official trailer playback (via TMDB/YouTube) for the full discovery catalog.
- Native HTML5 video playback for titles the admin has uploaded and owns the rights to.
- Picture-in-Picture, favorites/watchlist, share, cast & reviews from TMDB.
- TV: season/episode picker; episodes loaded per season from TMDB.
- Live Chat panel beside Up Next queue on player page.

VISUAL SEARCH:
- Upload a photo (poster, screenshot, mood board) in Help Desk AI chat or Homepage AI widget.
- Gemini vision analyzes mood, genres, keywords; TMDB finds visually similar titles.
- Users can ask follow-up questions about the matches ("which is closest?", "any horror like this?").

DOWNLOADS:
- Sign-in required. Each title saves a .cinemax.json package + poster/backdrop images to the device and registers in Download History.
- Strict 2 GB account quota. Manage in Downloads page and Profile settings.
- NOT full video files \u2014 metadata + artwork offline packages for Cinemax library; playback still streams when online.

LIVE CHAT:
- Popular: global public feed with replies, likes, image attachments; auto-scrolls.
- Inbox: private DMs between signed-in users. Admin moderates via admin panel.

LANGUAGES (12):
English, French, Kinyarwanda, Spanish, German, Italian, Portuguese, Arabic (RTL), Chinese, Japanese, Korean, Swahili \u2014 switch in sidebar or Profile preferences.

THEME:
Dark mode default; light mode toggle in sidebar and Profile. Solid surfaces, neon green (#39FF14) accent.

ADMIN PANEL (standalone app, linked to website API):
Dashboard, Movies/TV CMS (Cinemax Originals), Catalog Curation (featured/trending override/hidden IDs), Genres, Users, Live Chat moderation, Help Desk inquiries, Comments, Advertisements, Broadcast notifications, Activity logs, API Keys (TMDB/Gemini/Groq), Site Settings (maintenance mode, homepage sections, AI toggles), Content Pages visibility.

AI ASSISTANT CAPABILITIES (All Kiki's):
- Recommend movies/TV, explain plots, compare titles, navigate users to site sections.
- Propose confirmed account actions: update_name, toggle_autoplay_next, toggle_autoplay_trailers, set_subtitle_language, set_default_quality, toggle_mature_lock, clear_watch_history, navigate (home|movies|tv|mylist|watchlist|history|favorites|downloads|profile|help).
- Multilingual: match the user's language exactly, especially fluent Kinyarwanda.

ADMIN USER RECOGNITION:
When userContext.role is "admin", greet them as Cinemax Administrator. You may explain admin panel features, Help Desk inquiry management, content CMS, broadcast notifications, and site settings \u2014 but never reveal passwords, API keys, or JWT secrets. Primary admin (allkikisweb@gmail.com) has full platform ownership; treat their requests with highest priority for site-management guidance.
`.trim();
}

// src/lib/tmdbMatch.ts
var TMDB_BASE = "https://api.themoviedb.org/3";
function getTmdbKey() {
  const fromDb = db_default.data.site_settings?.apiKeys?.tmdb;
  return (fromDb || process.env.TMDB_API_KEY || "422828f653928ec5244f1a63a8b8641f").trim();
}
async function tmdbFetch(path4, params = {}) {
  const qs = new URLSearchParams({ api_key: getTmdbKey(), ...params });
  const res = await fetch(`${TMDB_BASE}${path4}?${qs}`);
  if (!res.ok) throw new Error(`TMDB ${path4} failed (${res.status})`);
  return res.json();
}
function normalizeHit(m, mediaType) {
  if (!m?.poster_path) return null;
  return {
    id: m.id,
    title: m.title,
    name: m.name,
    overview: m.overview || "",
    poster_path: m.poster_path,
    backdrop_path: m.backdrop_path || m.poster_path,
    vote_average: m.vote_average ?? 0,
    release_date: m.release_date,
    first_air_date: m.first_air_date,
    media_type: mediaType || (m.title ? "movie" : "tv")
  };
}
async function searchExactTitle(title, year) {
  if (!title?.trim()) return [];
  const data2 = await tmdbFetch("/search/multi", {
    query: title.trim(),
    include_adult: "false"
  });
  const hits = [];
  for (const r of data2.results || []) {
    if (r.media_type !== "movie" && r.media_type !== "tv") continue;
    if (year) {
      const y = (r.release_date || r.first_air_date || "").slice(0, 4);
      if (y && y !== year) continue;
    }
    const hit = normalizeHit(r, r.media_type);
    if (hit) hits.push(hit);
  }
  hits.sort((a, b) => {
    const scoreA = (a.vote_average || 0) * 10 + Math.log10(1 + (a.vote_count || 0)) * 5;
    const scoreB = (b.vote_average || 0) * 10 + Math.log10(1 + (b.vote_count || 0)) * 5;
    return scoreB - scoreA;
  });
  return hits.slice(0, 3);
}
async function getSimilar(id, mediaType) {
  const path4 = mediaType === "tv" ? `/tv/${id}/similar` : `/movie/${id}/similar`;
  const data2 = await tmdbFetch(path4);
  return (data2.results || []).map((m) => normalizeHit(m, mediaType)).filter(Boolean);
}
async function discoverByGenreNames(genreNames) {
  if (!genreNames?.length) return [];
  const allGenres = await tmdbFetch("/genre/movie/list");
  const matchedIds = allGenres.genres.filter((g) => genreNames.some((n) => g.name.toLowerCase() === n.toLowerCase())).map((g) => g.id);
  if (!matchedIds.length) return [];
  const data2 = await tmdbFetch("/discover/movie", {
    with_genres: matchedIds.join(","),
    sort_by: "popularity.desc"
  });
  return (data2.results || []).map((m) => normalizeHit(m, "movie")).filter(Boolean);
}
async function searchByKeywords(keywords) {
  if (!keywords?.length) return [];
  const seen = /* @__PURE__ */ new Set();
  const merged = [];
  const batch = keywords.slice(0, 5);
  const results = await Promise.all(
    batch.map(
      (kw) => tmdbFetch("/search/movie", { query: kw }).catch(() => ({ results: [] }))
    )
  );
  for (const data2 of results) {
    for (const m of data2.results || []) {
      const hit = normalizeHit(m, "movie");
      if (hit && !seen.has(hit.id)) {
        seen.add(hit.id);
        merged.push(hit);
      }
    }
  }
  return merged;
}
async function matchMoviesFromAnalysis(analysis) {
  const seen = /* @__PURE__ */ new Set();
  const merged = [];
  const push = (list) => {
    for (const m of list) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        merged.push(m);
      }
    }
  };
  if (analysis.exactTitle) {
    const exact = await searchExactTitle(analysis.exactTitle, analysis.exactYear);
    push(exact);
    if (exact[0]) {
      const sim = await getSimilar(exact[0].id, exact[0].media_type || "movie");
      push(sim);
    }
  }
  const moodAsKeywords = [...analysis.keywords || [], ...analysis.moodTags || []];
  const [byKeyword, byGenre] = await Promise.all([
    searchByKeywords(moodAsKeywords),
    discoverByGenreNames(analysis.genres || [])
  ]);
  push(byKeyword);
  push(byGenre);
  const enriched = await Promise.all(
    merged.slice(0, 12).map(async (m) => {
      try {
        const details = await tmdbFetch(
          m.media_type === "tv" ? `/tv/${m.id}` : `/movie/${m.id}`
        );
        return {
          ...m,
          genre_ids: details.genre_ids || [],
          genres: details.genres || [],
          runtime: details.runtime,
          episode_run_time: details.episode_run_time,
          number_of_seasons: details.number_of_seasons,
          number_of_episodes: details.number_of_episodes
        };
      } catch {
        return m;
      }
    })
  );
  return enriched;
}

// src/server.ts
try {
  const __dir = path3.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path3.resolve(__dir, "../config/.env") });
  dotenv.config({ path: path3.resolve(__dir, "../../config/.env") });
} catch {
}
var app = express();
app.set("trust proxy", 1);
function buildAllowedOrigins() {
  const raw = [];
  if (process.env.CORS_ORIGIN) raw.push(...process.env.CORS_ORIGIN.split(","));
  if (process.env.WEBSITE_URL) raw.push(process.env.WEBSITE_URL);
  if (process.env.ADMIN_PANEL_URL) raw.push(process.env.ADMIN_PANEL_URL);
  raw.push("http://localhost:5173", "http://localhost:5174", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:5174");
  return Array.from(
    new Set(
      raw.map((o) => (o || "").trim().replace(/\/+$/, "")).filter(Boolean)
    )
  );
}
var allowedOrigins = buildAllowedOrigins();
console.log("[cors] Allowed origins:", allowedOrigins);
function isAllowedOrigin(origin) {
  const normalized = origin.replace(/\/+$/, "");
  if (allowedOrigins.includes(normalized)) return true;
  if (/^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(normalized)) return true;
  return false;
}
var corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:") || origin.startsWith("https://localhost:") || origin.startsWith("https://127.0.0.1:")) {
      console.log("[cors] Allowing localhost origin:", origin);
      return cb(null, true);
    }
    if (isAllowedOrigin(origin)) return cb(null, true);
    console.warn("[cors] Rejected origin:", origin);
    return cb(new Error(`Origin ${origin} is not allowed by CORS.`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "20mb" }));
app.use(cookieParser());
app.use("/uploads", express.static(path3.join(process.cwd(), "uploads")));
var adminDistPath = path3.join(process.cwd(), "public", "admin");
app.use("/admin", express.static(adminDistPath));
app.get("/admin/*", (req, res, next) => {
  if (req.path.startsWith("/admin/api")) return next();
  res.sendFile(path3.join(adminDistPath, "index.html"), (err) => {
    if (err) next();
  });
});
app.get("/api/health", (_req, res) => {
  const mailerStatus = getMailerStatus();
  res.json({
    status: "ok",
    uptime: process.uptime(),
    db: process.env.MONGO_URI ? "mongo" : "file",
    mailer: mailerStatus.configured ? "configured" : "missing",
    mailerUser: mailerStatus.user ? mailerStatus.user.substring(0, 3) + "***" : "not_set",
    time: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/test/mailer", async (_req, res) => {
  const mailerStatus = getMailerStatus();
  res.json({
    configured: mailerStatus.configured,
    user: mailerStatus.user,
    envEmailUser: process.env.EMAIL_USER ? "set" : "missing",
    envEmailAppPassword: process.env.EMAIL_APP_PASSWORD ? "set" : "missing",
    envGmailUser: process.env.GMAIL_USER ? "set" : "missing",
    envGmailAppPassword: process.env.GMAIL_APP_PASSWORD ? "set" : "missing"
  });
});
app.use(authRouter);
app.use(adminRouter);
app.post("/api/assistant", async (req, res) => {
  try {
    if (db_default.data?.site_settings?.aiEnabled === false) {
      res.status(403).json({ error: "The AI assistant is currently disabled by the administrator." });
      return;
    }
    const { message, history = [], movieContext, visualContext } = req.body || {};
    const userMessage = String(message || "").trim();
    if (!userMessage) {
      res.status(400).json({ error: "Message is required." });
      return;
    }
    const systemPrompt = buildAssistantSystemPrompt({
      movieContext,
      visualContext,
      sessionUser: resolveSessionUser(req)
    });
    const safeHistory = Array.isArray(history) ? history.slice(-24).map((h) => ({
      role: h?.role === "assistant" ? "assistant" : "user",
      content: String(h?.content ?? h?.text ?? "").slice(0, 3e3)
    })).filter((h) => h.content.trim()) : [];
    const routed = await routedAssistantChat([
      { role: "system", content: systemPrompt },
      ...safeHistory,
      { role: "user", content: userMessage }
    ], db_default.data?.site_settings?.aiModel);
    const user = resolveSessionUser(req);
    saveAiChatLog(user, "user", userMessage, "system");
    saveAiChatLog(user, "assistant", routed.text, routed.engine);
    res.json({ text: routed.text, engine: routed.engine });
  } catch (err) {
    console.error("[assistant] request failed:", err);
    const missingKey = String(err?.message || "").toLowerCase().includes("api key");
    res.status(missingKey ? 503 : 500).json({
      error: missingKey ? "AI assistant is temporarily unavailable. Please try again later." : "The AI assistant is temporarily unavailable. Please try again."
    });
  }
});
app.post("/api/agent/generate-image", async (req, res) => {
  try {
    const { prompt, size = "1024x1024" } = req.body || {};
    const cleanPrompt = String(prompt || "").trim();
    if (!cleanPrompt) {
      res.status(400).json({ error: "Prompt is required." });
      return;
    }
    const imageUrl = await openaiGenerateImage(cleanPrompt, size);
    if (!imageUrl) {
      throw new Error("Image generation failed");
    }
    const user = resolveSessionUser(req);
    saveAiChatLog(user, "user", `Generate image: ${cleanPrompt}`, "system");
    saveAiChatLog(user, "assistant", `Image generated: ${imageUrl}`, "openai");
    res.json({ imageUrl, prompt: cleanPrompt });
  } catch (err) {
    console.error("[agent] image generation failed:", err);
    const missingKey = String(err?.message || "").toLowerCase().includes("api key");
    res.status(missingKey ? 503 : 500).json({
      error: missingKey ? "Image generation is temporarily unavailable. Please try again later." : "Image generation is temporarily unavailable. Please try again."
    });
  }
});
app.post("/api/visual-search/match", async (req, res) => {
  try {
    const { imageBase64, mimeType, question } = req.body || {};
    const rawImage = String(imageBase64 || "").trim();
    if (!rawImage) {
      res.status(400).json({ error: "Image data is required." });
      return;
    }
    const cleanImage = rawImage.includes(",") ? rawImage.split(",").pop() || rawImage : rawImage;
    const analysis = await analyzeImageWithGemini(cleanImage, String(mimeType || "image/jpeg"), question);
    const matches = await matchMoviesFromAnalysis(analysis);
    let aiAnswer;
    if (String(question || "").trim()) {
      try {
        const routed = await routedAssistantChat([
          {
            role: "system",
            content: buildAssistantSystemPrompt({
              visualContext: {
                description: analysis.description,
                analysis,
                matches: matches.map((m) => ({
                  id: m.id,
                  title: m.title || m.name || "Unknown",
                  overview: m.overview,
                  rating: m.vote_average
                }))
              },
              sessionUser: resolveSessionUser(req)
            })
          },
          { role: "user", content: String(question).trim() }
        ]);
        aiAnswer = routed.text;
      } catch (err) {
        console.warn("[visual-search] optional AI answer failed:", err);
      }
    }
    res.json({
      description: analysis.description,
      analysis,
      matches,
      ...aiAnswer ? { aiAnswer } : {}
    });
  } catch (err) {
    console.error("[visual-search] request failed:", err);
    const message = String(err?.message || "");
    const missingKey = message.toLowerCase().includes("api key");
    res.status(missingKey ? 503 : 500).json({
      error: missingKey ? "Visual search is temporarily unavailable. Please try again later." : "Visual search is temporarily unavailable. Please try again."
    });
  }
});
function getApiKey(name) {
  const fromEnv = name === "tmdb" ? process.env.TMDB_API_KEY : name === "gemini" ? process.env.GEMINI_API_KEY : name === "groq" ? process.env.GROQ_API_KEY : name === "openai" ? process.env.OPENAI_API_KEY : process.env.GROK_API_KEY;
  const fromDb = db_default.data?.site_settings?.apiKeys?.[name];
  const result = (fromEnv || fromDb || "").trim();
  if (name === "gemini") {
    console.log(`[getApiKey] ${name}: fromEnv=${fromEnv ? "SET" : "NOT_SET"}, fromDb=${fromDb ? "SET" : "NOT_SET"}, result=${result ? "HAS_VALUE" : "EMPTY"}`);
  }
  return result;
}
function getGeminiClient() {
  const key = getApiKey("gemini");
  if (!key) {
    console.error("[Gemini] API key not configured");
    throw new Error("Gemini API key not configured");
  }
  console.log("[Gemini] Client initialized with API key:", key.substring(0, 10) + "...");
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } }
  });
}
function getOpenAIClient() {
  const key = getApiKey("openai");
  if (!key) throw new Error("OpenAI API key not configured");
  return new OpenAI({ apiKey: key });
}
async function grokChat(messages, model = "grok-beta") {
  const grokKey = getApiKey("grok");
  if (!grokKey) throw new Error("Grok API key not configured");
  const grokResponse = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${grokKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2048
    })
  });
  if (!grokResponse.ok) {
    const errorText = await grokResponse.text();
    let detail = `Grok returned status ${grokResponse.status}`;
    try {
      const parsedErr = JSON.parse(errorText);
      if (parsedErr?.error?.message) detail = parsedErr.error.message;
    } catch {
    }
    throw new Error(detail);
  }
  const data2 = await grokResponse.json();
  return data2.choices?.[0]?.message?.content || "";
}
async function openaiChat(messages, model = "gpt-4o") {
  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model,
    messages,
    temperature: 0.7,
    max_tokens: 2048
  });
  return response.choices[0]?.message?.content || "";
}
async function openaiGenerateImage(prompt, size = "1024x1024") {
  const openai = getOpenAIClient();
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    size,
    quality: "standard",
    n: 1
  });
  return response.data[0]?.url || "";
}
async function openaiTextToSpeech(text, language = "en") {
  const openai = getOpenAIClient();
  const voiceMap = {
    "en": "nova",
    // Female voice, clear and Siri-like
    "es": "nova",
    // Female voice
    "fr": "shimmer",
    // Female voice
    "de": "nova",
    // Female voice
    "it": "nova",
    // Female voice
    "pt": "shimmer",
    // Female voice
    "ru": "shimmer",
    // Female voice
    "ja": "nova",
    // Female voice
    "ko": "nova",
    // Female voice
    "zh": "nova",
    // Female voice
    "ar": "shimmer",
    // Female voice
    "hi": "shimmer",
    // Female voice
    "rw": "nova"
    // Kinyarwanda fallback - female voice
  };
  const voice = voiceMap[language.split("-")[0]] || "nova";
  const response = await openai.audio.speech.create({
    model: "tts-1-hd",
    // Higher quality model for clearer voice
    voice,
    input: text,
    speed: 1
  });
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
app.post("/api/tts", async (req, res) => {
  try {
    const { text, language = "en" } = req.body || {};
    const cleanText = String(text || "").trim();
    if (!cleanText) {
      res.status(400).json({ error: "Text is required." });
      return;
    }
    const audioBuffer = await openaiTextToSpeech(cleanText, language);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", "attachment; filename=speech.mp3");
    res.send(audioBuffer);
  } catch (err) {
    console.error("[tts] text-to-speech failed:", err);
    const missingKey = String(err?.message || "").toLowerCase().includes("api key");
    res.status(missingKey ? 503 : 500).json({
      error: missingKey ? "Text-to-speech is temporarily unavailable. Please try again later." : "Text-to-speech is temporarily unavailable. Please try again."
    });
  }
});
app.post("/api/voice-agent", async (req, res) => {
  try {
    const { command, language = "en", userName } = req.body || {};
    const cleanCommand = String(command || "").trim();
    if (!cleanCommand || cleanCommand.length < 2) {
      res.status(400).json({ error: "Command is required and must be meaningful." });
      return;
    }
    const voiceSystemPrompt = `You are "CinemaX Voice Agent," a precise voice assistant for Cinemax streaming platform.

INTENT DETECTION RULES (CRITICAL - Follow exactly):
1. NAVIGATION: Only use navigateTo when user explicitly says "go to", "open", "take me to", "navigate to" + page name
2. SEARCH: Only use triggerSearch when user explicitly says "search", "find", "look for", "show me" + movie/show name
3. PLAY: Only use playMovie when user explicitly says "play", "watch" + specific title
4. DELETE: Only use deleteLastAction when user says "delete", "remove", "clear" + "what you wrote/that/it"
5. CATEGORIES: Only use openCategories when user says "categories", "genres", "browse by genre"
6. SETTINGS: Only use openSettings when user says "settings", "preferences", "options"
7. HELP: Only use openHelp when user says "help", "support", "assistance"

IF UNCLEAR: If intent is ambiguous, ask for clarification instead of guessing.

AVAILABLE PAGES: home, movies, tv, help, profile, settings, categories, mylist, favorites, history, downloads, shorts, gens, about, player

RESPONSE RULES:
- Keep responses SHORT (max 2 sentences)
- Match user's language exactly
- No markdown or special characters
- Always confirm the action before executing

CORRECT EXAMPLES:
User: "go to help page" \u2192 navigateTo("help") 
User: "search for Batman" \u2192 triggerSearch("Batman")
User: "play Inception" \u2192 playMovie("Inception")  
User: "delete what you wrote" \u2192 deleteLastAction()
User: "show me categories" \u2192 openCategories()
User: "open settings" \u2192 openSettings()

INCORRECT EXAMPLES (DO NOT DO):
User: "hello" \u2192 triggerSearch("hello") \u274C (Should ask what they want)
User: "that's cool" \u2192 navigateTo("cool") \u274C (Should acknowledge, not navigate)
User: "I like movies" \u2192 triggerSearch("I like movies") \u274C (Should acknowledge, not search)

Current user: ${userName || "User"}
Language: ${language}
Command: "${cleanCommand}"

Analyze the intent EXACTLY. If unclear, respond asking for clarification. If clear, respond with confirmation + TOOL_CALL.`;
    const aiResponse = await grokChat([
      { role: "system", content: voiceSystemPrompt },
      { role: "user", content: cleanCommand }
    ]);
    const toolCalls = [];
    const lines = aiResponse.split("\n");
    let voiceResponse = "";
    for (const line of lines) {
      if (line.startsWith("TOOL_CALL:")) {
        try {
          const toolCall = JSON.parse(line.replace("TOOL_CALL:", "").trim());
          toolCalls.push(toolCall);
        } catch {
        }
      } else if (line.trim()) {
        voiceResponse += line + " ";
      }
    }
    voiceResponse = voiceResponse.replace(/[*_`#]/g, "").replace(/\n/g, " ").trim();
    res.json({
      response: voiceResponse,
      action: toolCalls.length > 0 ? toolCalls[0] : null,
      language
    });
  } catch (err) {
    console.error("[voice-agent] processing failed:", err);
    const missingKey = String(err?.message || "").toLowerCase().includes("api key");
    res.status(missingKey ? 503 : 500).json({
      error: missingKey ? "Voice agent is temporarily unavailable. Please try again later." : "Voice agent is temporarily unavailable. Please try again."
    });
  }
});
async function analyzeImageWithGemini(imageBase64, mimeType, userQuestion) {
  const questionBlock = userQuestion ? `
The user also asks: "${userQuestion}" \u2014 factor this into your genre/keyword choices.` : "";
  const prompt = `You are a film curator analyzing an image (poster, screenshot, or photo) to find visually or thematically similar movies.
Look at composition, color palette, lighting, mood, setting, and recognizable film cues.${questionBlock}
If this is clearly a known movie poster or screenshot, extract the exact title and year.
Respond with ONLY raw JSON (no markdown fences):
{
  "description": "one vivid sentence describing the image and its cinematic mood",
  "genres": ["up to 3 TMDB genre names e.g. Science Fiction, Horror, Action"],
  "keywords": ["3-6 visual/theme keywords"],
  "moodTags": ["2-4 mood words e.g. moody, vibrant, gritty"],
  "exactTitle": "exact movie/show title if recognizable, else null",
  "exactYear": "YYYY release year if known, else null",
  "isKnownPoster": true or false
}`;
  try {
    const ai = getGeminiClient();
    console.log("[Gemini] Starting image analysis with model: gemini-2.5-flash");
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64 } }
          ]
        }
      ]
    });
    const rawText = response.text ?? response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    console.log("[Gemini] Raw response length:", rawText.length);
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    try {
      const parsed = JSON.parse(cleaned);
      console.log("[Gemini] Successfully parsed analysis");
      return {
        description: parsed.description || "A visually distinct image.",
        genres: parsed.genres || [],
        keywords: parsed.keywords || [],
        moodTags: parsed.moodTags || [],
        exactTitle: parsed.exactTitle || null,
        exactYear: parsed.exactYear || null,
        isKnownPoster: !!parsed.isKnownPoster
      };
    } catch (parseError) {
      console.error("[Gemini] JSON parse error:", parseError);
      return {
        description: "A visually distinct image with cinematic qualities.",
        genres: [],
        keywords: [],
        moodTags: [],
        exactTitle: null,
        exactYear: null,
        isKnownPoster: false
      };
    }
  } catch (error) {
    console.error("[Gemini] Image analysis error:", error);
    throw error;
  }
}
async function groqChat(messages, model) {
  const groqKey = getApiKey("groq").replace(/\/$/, "");
  if (!groqKey) throw new Error("Groq API key not configured");
  const aiModel = model || db_default.data?.site_settings?.aiModel || "llama-3.3-70b-versatile";
  const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqKey}`
    },
    body: JSON.stringify({
      model: aiModel,
      messages,
      temperature: 0.6,
      max_tokens: 2048
    })
  });
  if (!groqResponse.ok) {
    const errorText = await groqResponse.text();
    let detail = `Groq returned status ${groqResponse.status}`;
    try {
      const parsedErr = JSON.parse(errorText);
      if (parsedErr?.error?.message) detail = parsedErr.error.message;
    } catch {
    }
    throw new Error(detail);
  }
  const groqData = await groqResponse.json();
  return groqData.choices?.[0]?.message?.content || "I couldn't formulate an answer right now.";
}
async function geminiChat(messages) {
  const ai = getGeminiClient();
  const system = messages.find((m) => m.role === "system")?.content || "";
  const turns = messages.filter((m) => m.role !== "system");
  const response = await ai.models.generateContent({
    model: db_default.data?.site_settings?.aiPrimaryModel || "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${system}

CONVERSATION:
${turns.map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`).join("\n")}`
          }
        ]
      }
    ]
  });
  const text = response.text ?? response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text.trim()) throw new Error("Gemini returned an empty response");
  return text.trim();
}
async function routedAssistantChat(messages, groqModel) {
  try {
    return { text: await grokChat(messages), engine: "grok" };
  } catch (err) {
    console.warn("[assistant] Grok primary failed; falling back to OpenAI:", err);
    try {
      return { text: await openaiChat(messages), engine: "openai" };
    } catch (err2) {
      console.warn("[assistant] OpenAI fallback failed; falling back to Gemini:", err2);
      try {
        return { text: await geminiChat(messages), engine: "gemini" };
      } catch (err3) {
        console.warn("[assistant] Gemini fallback failed; falling back to Groq:", err3);
        return { text: await groqChat(messages, groqModel), engine: "groq" };
      }
    }
  }
}
function estimateTokens(text) {
  return Math.max(1, Math.ceil(String(text || "").length / 4));
}
function saveAiChatLog(user, role, message, engine) {
  db_default.data.ai_chat_history.push({
    id: crypto.randomUUID(),
    user_id: user?.id || null,
    user_name: user?.name || null,
    role,
    message: String(message || "").slice(0, 12e3),
    engine,
    tokens_estimate: estimateTokens(message),
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  db_default.data.ai_chat_history = db_default.data.ai_chat_history.slice(-2e3);
  db_default.save();
}
function resolveSessionUser(req) {
  const userId = getOptionalUserId(req);
  return userId ? getUserById(userId) : void 0;
}
function buildAssistantSystemPrompt(opts) {
  const settings = db_default.data?.site_settings || {};
  let systemPrompt = `You are "All Kiki's", the official Cinemax AI Agent \u2014 expert, friendly, and deeply knowledgeable about every feature on the Cinemax website.

`;
  systemPrompt += buildCinemaxKnowledgeBase();
  systemPrompt += "\n\nRESPONSE STYLE: Cinematic, engaging, concise. Use bullets or bold for lists. Match the user's language exactly (including fluent Kinyarwanda).\n";
  systemPrompt += "SITE ACTIONS: When the user explicitly requests a settings change or navigation, end with ONE ```action\\n{JSON}\\n``` block. Valid types: update_name, toggle_autoplay_next, toggle_autoplay_trailers, set_subtitle_language, set_default_quality, toggle_mature_lock, clear_watch_history, navigate (home|movies|tv|mylist|watchlist|history|favorites|downloads|profile|help|shorts|gens), search (query), play_movie (id, title), play_tv (id, title, season, episode), add_to_watchlist (id), remove_from_watchlist (id), add_to_favorites (id), remove_from_favorites (id), set_profile_image (image_url), generate_image (prompt), open_help_desk, submit_help_ticket (subject, message), download_movie (id, title), manage_downloads, view_download_history. For complex multi-step operations, break them into sequential actions. Only one action block when clearly requested.\n";
  systemPrompt += "LANGUAGE DETECTION: Always detect the user's language from their input and respond in that exact same language. If the user speaks Kinyarwanda, respond in fluent Kinyarwanda. If they speak English, respond in English. If they speak French, respond in French, etc. Never translate unless explicitly requested.\n";
  systemPrompt += 'RECOMMENDATIONS: Ask at most one short clarifying question, and only when the request is genuinely too broad to act on (e.g. "recommend something good" with no other signal). Otherwise commit to a real answer \u2014 a person who says "something like Inception" or "a good 90s action movie" has already told you enough to work with. When you suggest titles, name 3-5 specific ones, each with a one-line reason it fits (mood, genre, actor, director, or similarity to what they mentioned), then end with a `search` action block using the best single query so the site shows real, playable results \u2014 never claim a title is available on Cinemax unless it plausibly exists in the TMDB catalog. If they ask about a genre, actor, or theme rather than asking for a single pick, you can list several relevant titles instead of just one.\nCONVERSATION MEMORY: Treat everything earlier in this chat as still true \u2014 remember what titles, genres, or preferences the user already mentioned and build on them instead of re-asking. If they say "something else like that" or "not that one", refer back to what you already suggested.\n';
  if (settings.aiSystemPromptExtra) {
    systemPrompt += `

ADMIN CUSTOM INSTRUCTIONS:
${settings.aiSystemPromptExtra}`;
  }
  const memories = (db_default.data?.ai_memory || []).filter((m) => m.enabled).slice(-30);
  if (memories.length) {
    systemPrompt += `

APPROVED AI MEMORY BANK:
${memories.map((m) => `- ${m.title}: ${m.content}`).join("\n")}`;
  }
  const u = opts.sessionUser;
  if (u) {
    systemPrompt += `

[SIGNED-IN USER: ${u.name} (${u.email}), role: ${u.role}, subscription: ${u.subscription || "Free"}]`;
    if (u.role === "admin") {
      systemPrompt += `
This user is a CINEMAX ADMINISTRATOR with access to the Admin Panel. Address them professionally. Help with site management, content curation, Help Desk inquiries, broadcasts, and admin workflows. Never expose secrets.`;
      if (isAdminEmail(u.email)) {
        systemPrompt += `
This is the PRIMARY platform owner (allkikisweb@gmail.com) \u2014 highest priority for admin guidance.`;
      }
    }
    try {
      const prefs = JSON.parse(u.preferences || "{}");
      systemPrompt += `
User preferences snapshot: appLanguage=${prefs.appLanguage || "English"}, autoplayNext=${prefs.autoplayNext}, defaultQuality=${prefs.defaultQuality}, subtitleLanguage=${prefs.subtitleLanguage}.`;
    } catch {
    }
  } else {
    systemPrompt += "\n\n[VISITOR: Not signed in \u2014 guest browsing or anonymous. Remind them to sign in for downloads, My List, and profile features when relevant.]";
  }
  if (opts.visualContext) {
    systemPrompt += `

[VISUAL SEARCH CONTEXT \u2014 user uploaded an image]
Image analysis: ${opts.visualContext.description}`;
    if (opts.visualContext.analysis) {
      systemPrompt += `
Genres: ${(opts.visualContext.analysis.genres || []).join(", ")}`;
      systemPrompt += `
Mood: ${(opts.visualContext.analysis.moodTags || []).join(", ")}`;
    }
    if (opts.visualContext.matches?.length) {
      systemPrompt += `
Matched titles:
${opts.visualContext.matches.map((m, i) => `${i + 1}. ${m.title} (TMDB #${m.id})${m.rating ? ` \u2014 ${m.rating}/10` : ""}`).join("\n")}`;
    }
    systemPrompt += "\nAnswer follow-up questions about these matches with specific references to the list above.";
  }
  if (opts.movieContext) {
    systemPrompt += `

[CURRENT TITLE: "${opts.movieContext.title || opts.movieContext.name || "Unknown"}"]`;
    if (opts.movieContext.overview) systemPrompt += `
Overview: ${opts.movieContext.overview}`;
  }
  return systemPrompt;
}
var PORT = Number(process.env.PORT) || 5e3;
async function start() {
  await connectDB();
  await initDb();
  try {
    seedAdminUser();
  } catch (err) {
    console.error("[startup] seedAdminUser failed:", err);
  }
  app.listen(PORT, () => {
    console.log(`\u{1F680} Cinemax Backend listening on port ${PORT}`);
  });
}
start().catch((err) => {
  console.error("[startup] Fatal error:", err);
  process.exit(1);
});
async function shutdown(signal) {
  console.log(`[shutdown] ${signal} received \u2014 flushing DB\u2026`);
  try {
    await flushDb();
  } catch (err) {
    console.error("[shutdown] flush failed:", err);
  }
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
//# sourceMappingURL=server.js.map
