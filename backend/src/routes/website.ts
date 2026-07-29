import { Router } from "express";
import crypto from "crypto";
import { Readable } from "stream";
import db, { DbChatMessage, DbDirectMessage, DbSharedMovieCard } from "../lib/db";
import {
  publicUser,
  isValidEmail,
  isStrongPassword,
  getUserByEmail,
  getUserById,
  createUser,
  verifyPassword,
  updatePasswordHash,
  signToken,
  signPortalToken,
  verifyPortalToken,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  AuthedRequest,
  isAdminEmail,
  getAdminLoginMethod,
  canSendOtp,
  issueOtp,
  verifyOtp,
  getOptionalUserId,
  issueSignupVerification,
  verifySignupCode,
  issuePasswordReset,
  verifyPasswordResetToken,
  consumePasswordReset,
  canSendPasswordReset,
  rateLimit,
  logActivity,
} from "../lib/auth";
import { sendOtpEmail, isMailerConfigured, sendSignupVerificationEmail, sendPasswordResetEmail, getMailerStatus } from "../lib/mailer";
import {
  broadcastChatEvent,
  clearPresence,
  clearTypingForActor,
  getActivityFeed,
  getPresenceEntries,
  getTypingEntries,
  pushChatActivity,
  registerChatClient,
  setTyping,
  unregisterChatClient,
  upsertPresence,
} from "../lib/chatRealtime";
import { 
  getUserByEmail as getSupabaseUserByEmail,
  getUserBySupabaseId,
  createUserProfile,
  updateUserProfile,
  getUserWatchlist,
  getUserFavorites,
  getUserMyList,
  addToWatchlist,
  removeFromWatchlist,
  addToFavorites,
  removeFromFavorites,
  addToMyList,
  removeFromMyList,
} from "../lib/supabase";

const LIST_STORAGE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
const DOWNLOAD_STORAGE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
const DEFAULT_ITEM_BYTES = 150 * 1024 * 1024; // ~150MB per title for quota math

export const authRouter = Router();

function getUserExtras(userId: string) {
  const myList = (db.data.my_list || [])
    .filter((w) => w.user_id === userId)
    .sort((a, b) => (a.added_at < b.added_at ? 1 : -1))
    .map((w) => w.movie_id);
  const favorites = db.data.favorites
    .filter((f) => f.user_id === userId)
    .sort((a, b) => (a.added_at < b.added_at ? 1 : -1))
    .map((f) => f.movie_id);
  const watchHistory = db.data.watch_history
    .filter((h) => h.user_id === userId)
    .sort((a, b) => (a.watched_at < b.watched_at ? 1 : -1))
    .slice(0, 50);
  // Continue-watching: titles with progress > 0 and not finished
  const watchlist = watchHistory
    .filter((h) => h.progress > 0 && h.progress < 100)
    .map((h) => h.movie_id);
  const downloads = (db.data.downloads || [])
    .filter((d) => d.user_id === userId)
    .sort((a, b) => (a.added_at < b.added_at ? 1 : -1));
  const listStorageUsed = computeListStorageUsed(userId);
  const downloadStorageUsed = downloads.reduce((sum, d) => sum + (d.size_bytes || 0), 0);
  return { myList, watchlist, favorites, watchHistory, downloads, listStorageUsed, listStorageLimit: LIST_STORAGE_LIMIT_BYTES, downloadStorageUsed, downloadStorageLimit: DOWNLOAD_STORAGE_LIMIT_BYTES };
}

function computeListStorageUsed(userId: string): number {
  let total = 0;
  for (const item of (db.data.my_list || []).filter((m) => m.user_id === userId)) {
    total += item.estimated_bytes || DEFAULT_ITEM_BYTES;
  }
  for (const item of db.data.favorites.filter((f) => f.user_id === userId)) {
    total += DEFAULT_ITEM_BYTES;
  }
  for (const item of db.data.watch_history.filter((h) => h.user_id === userId && h.progress > 0)) {
    total += DEFAULT_ITEM_BYTES;
  }
  return total;
}

function userWithExtras(u: Parameters<typeof publicUser>[0]) {
  return { ...publicUser(u), ...getUserExtras(u.id) };
}

// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------

authRouter.post("/api/auth/signup/request", rateLimit({ name: "signup-request", max: 5, windowMs: 15 * 60 * 1000 }), async (req, res) => {
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

  const displayName = (name && String(name).trim()) || email.split("@")[0];

  // If Brevo is not configured, create the account immediately without email verification.
  if (!isMailerConfigured()) {
    console.log("[auth] Brevo not configured - skipping email verification and creating account directly");
    const user = createUser(email, "", displayName, password);
    db.data.notifications.push({
      id: crypto.randomUUID(),
      user_id: user.id,
      type: "account",
      title: "Welcome to Cinemax",
      message: "Your account is ready. Sign in to explore trending titles and build your lists.",
      read: 0,
      created_at: new Date().toISOString(),
    });
    db.save();
    logActivity(user.email, "account_created", "user_account", { name: displayName }, user.id, req.ip);
    res.status(201).json({ ok: true, autoVerified: true, message: "Account created successfully. You can now sign in." });
    return;
  }

  // Brevo is configured - send OTP verification email
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

authRouter.post("/api/auth/signup/verify", rateLimit({ name: "signup-verify", max: 8, windowMs: 15 * 60 * 1000 }), (req, res) => {
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

  // The OTP was correct — this is the only moment the account is actually
  // written to the database. No session cookie is issued here on purpose:
  // per the requested flow, a freshly verified user lands on the Sign In
  // screen and logs in with the credentials they just created, rather than
  // being auto-signed-in.
  const existing = getUserByEmail(email);
  if (existing) {
    res.status(409).json({ 
      error: "An account with this email already exists. Please sign in or use the 'Forgot Password' option if you've forgotten your password.",
      alreadyExists: true 
    });
    return;
  }

  const user = createUser(email, "", result.name, result.passwordHash);
  db.data.notifications.push({
    id: crypto.randomUUID(),
    user_id: user.id,
    type: "account",
    title: "Welcome to Cinemax",
    message: "Your account is verified and ready. Sign in to explore trending titles and build your lists.",
    read: 0,
    created_at: new Date().toISOString(),
  });
  db.save();
  
  // Log account creation
  logActivity(user.email, "account_created", "user_account", { name: result.name }, user.id, req.ip);

  res.status(201).json({ ok: true, message: "Account created. You can now sign in." });
});

authRouter.post("/api/auth/signup", (req, res) => {
  res.status(400).json({ error: "Please verify your email first. Use signup/request then signup/verify." });
});

// Used only to decide which screen the frontend shows next (OTP entry for an
// existing account vs. the sign-up form for a new one) — never to reveal
// whether an email exists via an error message. Heavily rate-limited since
// it is, by necessity, a lookup on the user database.
authRouter.post(
  "/api/auth/forgot-password/check-email",
  rateLimit({ name: "check-email", max: 10, windowMs: 10 * 60 * 1000 }),
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
    // Allow admin accounts to use password reset too
    res.json({ found: true });
  }
);

authRouter.post(
  "/api/auth/forgot-password",
  rateLimit({ name: "forgot-password", max: 5, windowMs: 15 * 60 * 1000 }),
  async (req, res) => {
    const { email } = req.body || {};
    if (!email || !isValidEmail(email)) {
      res.status(400).json({ error: "Please enter a valid email address." });
      return;
    }
    const normalized = email.toLowerCase().trim();
    const user = getUserByEmail(normalized);

    // Always respond the same way whether or not the account exists — this
    // is the actual security-relevant step (unlike check-email above, which
    // only drives UI routing), so it must not leak account existence.
    const genericResponse = () =>
      res.json({
        ok: true,
        message: "If this email is registered with Cinemax, a 6-digit code has been sent to it.",
      });

    if (!user) {
      genericResponse();
      return;
    }

    const cooldown = canSendPasswordReset(normalized);
    if (cooldown.status === "cooldown") {
      // Still generic — don't confirm the account exists via a different
      // status code — but a code was already sent recently, so just let the
      // caller know via the same generic message rather than resending.
      genericResponse();
      return;
    }

    // If Brevo is not configured, return an error explaining password reset isn't available
    if (!isMailerConfigured()) {
      res.status(503).json({ error: "Email delivery isn't configured on this server yet, so password reset codes can't be sent. Please contact support to reset your password." });
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
  rateLimit({ name: "reset-password", max: 8, windowMs: 15 * 60 * 1000 }),
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

authRouter.post("/api/auth/login", rateLimit({ name: "login", max: 8, windowMs: 15 * 60 * 1000 }), (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const user = getUserByEmail(email);

  // Generic message on both "no such user" and "wrong password" — avoids
  // leaking which part was incorrect.
  if (!user || !verifyPassword(user, password)) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  // Admins may sign in with password directly — the OTP flow is optional
  // (used only when email delivery is configured).


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
  
  // Log successful login
  logActivity(user.email, "login", "session", {}, user.id, req.ip);
  
  res.json({ user: userWithExtras(user), token });
});

// ---------------------------------------------------------------------------
// ADMIN OTP LOGIN — the sole sign-in path for the administrator account.
// Step 1: POST /login/method tells the client whether an email belongs to
//         the admin account (→ "otp") or a regular one (→ "password"), so
//         the UI can render the right next step.
// Step 2: POST /otp/request sends a fresh 6-digit code to that email —
//         but ONLY if the email actually belongs to the admin account.
// Step 3: POST /otp/verify checks the code and, on success, logs them in
//         exactly like a normal login (session cookie + user payload).
// ---------------------------------------------------------------------------

authRouter.post("/api/auth/login/method", (req, res) => {
  const { email } = req.body || {};
  if (!email || !isValidEmail(email)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }
  res.json({ method: getAdminLoginMethod(email) });
});

authRouter.post("/api/auth/otp/request", rateLimit({ name: "otp-request", max: 5, windowMs: 15 * 60 * 1000 }), async (req, res) => {
  const { email } = req.body || {};
  if (!email || !isValidEmail(email)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }
  const normalized = String(email).toLowerCase().trim();

  // Only the admin account may request an OTP. Respond identically whether
  // the email doesn't exist or simply isn't an admin, so this endpoint can't
  // be used to enumerate which addresses are administrators.
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
    res.status(429).json({ error: `Please wait ${Math.ceil(cooldown.retryAfterMs / 1000)}s before requesting another code.` });
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

authRouter.post("/api/auth/otp/verify", rateLimit({ name: "otp-verify", max: 8, windowMs: 15 * 60 * 1000 }), (req, res) => {
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
  // The cookie is what the main site uses. `token` is also returned in the
  // body so the standalone admin panel (a separate origin, so it can't rely
  // on this cookie) can store it and send it as `Authorization: Bearer`.
  res.json({ user: userWithExtras(user), token });
});

authRouter.post("/api/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.get("/api/auth/me", requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: userWithExtras(req.user!) });
});

// Supabase OAuth sync endpoint - syncs Google OAuth users with backend
authRouter.post("/api/auth/supabase-sync", async (req, res) => {
  try {
    const { email, name, avatar, supabase_id, onboarding } = req.body || {};
    
    console.log('[Supabase Sync] Received sync request:', { email, supabase_id, hasOnboarding: !!onboarding });
    
    if (!email || !supabase_id) {
      res.status(400).json({ error: "Email and Supabase ID are required." });
      return;
    }

    // Check if user exists in Supabase
    let supabaseUser = await getSupabaseUserByEmail(email);
    
    if (!supabaseUser) {
      // Create new user in Supabase
      console.log('[Supabase Sync] Creating new user profile in Supabase');
      supabaseUser = await createUserProfile({
        id: supabase_id,
        email: email,
        full_name: name || email.split('@')[0],
        avatar_url: avatar || null,
        role: 'user',
        onboarding: onboarding || null,
      });
      console.log('[Supabase Sync] Created user with onboarding:', supabaseUser.onboarding);
    } else {
      // Update existing user in Supabase
      console.log('[Supabase Sync] Updating existing user profile in Supabase, current onboarding:', supabaseUser.onboarding);
      if (onboarding) {
        supabaseUser = await updateUserProfile(supabaseUser.id, {
          full_name: name || supabaseUser.full_name,
          avatar_url: avatar || supabaseUser.avatar_url,
          onboarding: onboarding,
        });
        console.log('[Supabase Sync] Updated user with onboarding:', supabaseUser.onboarding);
      } else {
        // CRITICAL: Even without new onboarding data, we must preserve existing onboarding
        console.log('[Supabase Sync] No new onboarding data, preserving existing onboarding:', supabaseUser.onboarding);
        // Ensure we still return the existing onboarding data
        if (!supabaseUser.onboarding) {
          console.warn('[Supabase Sync] User has no onboarding data in Supabase');
        }
      }
    }

    // Also sync to local db for compatibility
    let localUser = getUserByEmail(email);
    if (!localUser) {
      localUser = createUser(email, "", name || email.split('@')[0], "");
      // Mark as Google OAuth user
      localUser.google_id = supabase_id;
      if (onboarding) {
        localUser.onboarding = onboarding;
      }
      db.save();
      console.log('[Supabase Sync] Created local user with onboarding:', localUser.onboarding);
    } else {
      // Update local user
      if (onboarding) {
        localUser.onboarding = onboarding;
        db.save();
        console.log('[Supabase Sync] Updated local user with onboarding:', localUser.onboarding);
      } else if (supabaseUser.onboarding && !localUser.onboarding) {
        // Sync existing Supabase onboarding to local
        localUser.onboarding = supabaseUser.onboarding;
        db.save();
        console.log('[Supabase Sync] Synced Supabase onboarding to local user');
      }
    }

    // Get user data from Supabase
    const watchlist = await getUserWatchlist(supabaseUser.id);
    const favorites = await getUserFavorites(supabaseUser.id);
    const myList = await getUserMyList(supabaseUser.id);

    // Return combined user data - prioritize Supabase onboarding
    const userData = {
      id: supabaseUser.id,
      email: supabaseUser.email,
      name: supabaseUser.full_name || name,
      avatar: supabaseUser.avatar_url || avatar || "https://images.unsplash.com/photo-1574375927938-d5a98e8edd86?q=80&w=1200&auto=format&fit=crop",
      banner: "https://images.unsplash.com/photo-1574375927938-d5a98e8edd86?q=80&w=1200&auto=format&fit=crop",
      subscription: "Free",
      role: supabaseUser.role || "user",
      favorites: favorites.map(f => f.movie_id),
      myList: myList.map(m => m.movie_id),
      watchlist: watchlist.map(w => w.movie_id),
      listStorageUsed: 0,
      listStorageLimit: 2 * 1024 * 1024 * 1024,
      downloadStorageUsed: 0,
      downloadStorageLimit: 2 * 1024 * 1024 * 1024,
      downloads: [],
      watchHistory: [],
      preferences: {},
      onboarding: supabaseUser.onboarding || localUser.onboarding, // Prioritize Supabase
    };

    console.log('[Supabase Sync] Returning user data with onboarding:', userData.onboarding);
    
    // BUG FIX: this was setting the raw Supabase UUID as the session cookie
    // instead of a signed JWT. requireAuth() runs jwt.verify() on whatever is
    // in the cookie, so a bare UUID always failed verification — every
    // Google-signed-in user got a 401 on the very next authenticated request
    // (favorites, watchlist, notifications, /api/auth/me, etc.), which
    // syncFetch() treats as an expired session and force-opens the sign-in
    // modal. That repeated forced re-auth is what looked like the onboarding
    // screen looping.
    const sessionToken = signToken(supabaseUser.id);
    setSessionCookie(res, sessionToken);
    logActivity(email, "supabase_oauth_sync", "user_account", { supabase_id, hasOnboarding: !!userData.onboarding }, supabaseUser.id, req.ip);
    
    res.json({ user: userData });
  } catch (error) {
    console.error('[Supabase Sync] Error:', error);
    res.status(500).json({ error: "Failed to sync user with backend" });
  }
});

/** Short-lived signed URL so admins can open the standalone panel securely. */
authRouter.get("/api/auth/admin-portal-url", requireAuth, (req: AuthedRequest, res) => {
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "Admin access only." });
    return;
  }
  const portalToken = signPortalToken(req.user!.id);
  const base = (process.env.ADMIN_PANEL_URL || process.env.VITE_ADMIN_PANEL_URL || "http://localhost:5174").replace(/\/$/, "");
  res.json({ url: `${base}?token=${encodeURIComponent(portalToken)}` });
});

/** Exchange a short-lived portal handoff token for a full admin session JWT. */
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
  const user = getUserById(userId)!;
  const sessionToken = signToken(user.id);
  res.json({ user: userWithExtras(user), token: sessionToken });
});

/** Help Desk contact form — stored for admin review. */
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
  if (subject.length > 200 || message.length > 5000) {
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

  const now = new Date().toISOString();
  const inquiry = {
    id: crypto.randomUUID(),
    user_id: authedUserId,
    user_name: userName,
    user_email: userEmail,
    subject,
    message,
    status: "open" as const,
    admin_reply: null,
    created_at: now,
    updated_at: now,
  };
  db.data.support_inquiries.unshift(inquiry);
  db.save();
  res.status(201).json({ ok: true, inquiry: { id: inquiry.id, created_at: inquiry.created_at } });
});

authRouter.put("/api/auth/profile", requireAuth, (req: AuthedRequest, res) => {
  const { name, email } = req.body || {};
  const user = req.user!;

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
  user.updated_at = new Date().toISOString();
  db.save();
  res.json({ user: userWithExtras(getUserById(user.id)!) });
});

authRouter.put("/api/auth/password", requireAuth, (req: AuthedRequest, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = req.user!;

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

authRouter.put("/api/auth/avatar", requireAuth, (req: AuthedRequest, res) => {
  const { avatar, banner } = req.body || {};
  const MAX_AVATAR_BYTES = 600_000;
  if (typeof avatar === "string" && avatar.length > MAX_AVATAR_BYTES) {
    return res.status(400).json({ error: "Profile image is too large. Please use a photo under 500 KB." });
  }
  if (typeof banner === "string" && banner.length > MAX_AVATAR_BYTES) {
    return res.status(400).json({ error: "Banner image is too large." });
  }
  const user = req.user!;
  user.avatar = avatar ?? user.avatar;
  user.banner = banner ?? user.banner;
  user.updated_at = new Date().toISOString();
  db.save();
  res.json({ user: userWithExtras(getUserById(user.id)!) });
});

authRouter.put("/api/auth/preferences", requireAuth, (req: AuthedRequest, res) => {
  const user = req.user!;
  let current = {};
  try {
    current = JSON.parse(user.preferences || "{}");
  } catch {
    /* ignore malformed existing prefs */
  }
  const merged = { ...current, ...(req.body || {}) };
  user.preferences = JSON.stringify(merged);
  user.updated_at = new Date().toISOString();
  db.save();
  res.json({ user: userWithExtras(getUserById(user.id)!) });
});

authRouter.post("/api/auth/onboarding", requireAuth, (req: AuthedRequest, res) => {
  const { age, favoriteGenres } = req.body || {};
  const user = req.user!;

  if (!age || !Array.isArray(favoriteGenres) || favoriteGenres.length === 0) {
    res.status(400).json({ error: "Age and favorite genres are required." });
    return;
  }

  // Enforce maximum of 2 genre selections
  if (favoriteGenres.length > 2) {
    res.status(400).json({ error: "You can select a maximum of 2 favorite genres." });
    return;
  }

  // Calculate birth year from age range (use middle of range for accuracy)
  const currentYear = new Date().getFullYear();
  let birthYear: number;
  
  // Parse age range (e.g., "18-24" -> use 21 as approximate birth year)
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
    completedAt: new Date().toISOString(),
    birthYear,
  };
  user.updated_at = new Date().toISOString();
  db.save();
  
  // Log onboarding completion
  logActivity(user.email, "completed_onboarding", "user_profile", { age, favoriteGenres }, user.id, req.ip);
  
  res.json({ ok: true, user: userWithExtras(getUserById(user.id)!) });
});

authRouter.get("/api/auth/age-verification", requireAuth, (req: AuthedRequest, res) => {
  const user = req.user!;
  // Allow admin-granted Gens access regardless of birth year: if the user
  // exists in the gens_access table they've been explicitly authorized.
  const override = db.data.gens_access.find((g) => g.user_id === user.id);
  if (override) {
    // update last accessed metadata
    override.last_accessed_at = new Date().toISOString();
    override.access_count = (override.access_count || 0) + 1;
    db.save();
    return res.json({ allowed: true, adminOverride: true });
  }

  if (!user.onboarding || !user.onboarding.birthYear) {
    return res.json({ 
      allowed: false, 
      reason: "You must complete onboarding with age information to access this content." 
    });
  }

  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - user.onboarding.birthYear;

  // Gens is exclusively for ages 18-35 (inclusive). Access is recomputed from
  // birthYear on every check — never cached on the user record — so it
  // updates itself automatically: a 17-year-old is let in the moment their
  // birth year rolls them to 18, and a 35-year-old is locked out the moment
  // it rolls them to 36, with no separate migration or cron job needed.
  const MIN_AGE = 18;
  const MAX_AGE = 35;

  if (currentAge < MIN_AGE) {
    return res.json({
      allowed: false,
      reason: `You must be at least ${MIN_AGE} years old to access this content. Your current age is ${currentAge}.`,
    });
  }
  if (currentAge > MAX_AGE) {
    return res.json({
      allowed: false,
      reason: `Gens is available to members aged ${MIN_AGE}-${MAX_AGE}. Your current age is ${currentAge}.`,
    });
  }

  res.json({
    allowed: true,
    currentAge,
    birthYear: user.onboarding.birthYear,
  });

  // Track that this user has accessed the Gens (mature/romance) section so
  // admins can see exactly who has been in there — upserts one row per user.
  const nowIso = new Date().toISOString();
  const existing = db.data.gens_access.find((g) => g.user_id === user.id);
  if (existing) {
    existing.last_accessed_at = nowIso;
    existing.access_count += 1;
    existing.user_name = user.name;
    existing.user_email = user.email;
  } else {
    db.data.gens_access.push({
      user_id: user.id,
      user_name: user.name,
      user_email: user.email,
      first_accessed_at: nowIso,
      last_accessed_at: nowIso,
      access_count: 1,
    });
  }
  db.save();
});

authRouter.delete("/api/auth/account", requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  db.data.users = db.data.users.filter((u) => u.id !== userId);
  db.data.watchlist = db.data.watchlist.filter((w) => w.user_id !== userId);
  db.data.my_list = (db.data.my_list || []).filter((w) => w.user_id !== userId);
  db.data.downloads = (db.data.downloads || []).filter((d) => d.user_id !== userId);
  db.data.favorites = db.data.favorites.filter((f) => f.user_id !== userId);
  db.data.watch_history = db.data.watch_history.filter((h) => h.user_id !== userId);
  db.data.notifications = db.data.notifications.filter((n) => n.user_id !== userId);
  db.save();
  clearSessionCookie(res);
  res.json({ ok: true });
});

/** Wipes all local user activity — history, lists, favorites, downloads, notifications. */
authRouter.post("/api/auth/clear-cache", requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  db.data.my_list = (db.data.my_list || []).filter((w) => w.user_id !== userId);
  db.data.downloads = (db.data.downloads || []).filter((d) => d.user_id !== userId);
  db.data.favorites = db.data.favorites.filter((f) => f.user_id !== userId);
  db.data.watch_history = db.data.watch_history.filter((h) => h.user_id !== userId);
  db.data.notifications = db.data.notifications.filter((n) => n.user_id !== userId);
  db.data.watchlist = db.data.watchlist.filter((w) => w.user_id !== userId);
  db.save();
  res.json({ ok: true, user: userWithExtras(getUserById(userId)!) });
});

// ---------------------------------------------------------------------------
// COMMENTS / REVIEWS — public read of approved comments, authed create.
// New comments start "pending" until an admin approves them.
// ---------------------------------------------------------------------------

authRouter.get("/api/comments/:movieId", (req, res) => {
  const movieId = Number(req.params.movieId);
  const comments = db.data.comments
    .filter((c) => c.movie_id === movieId && c.status === "approved")
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  res.json({ comments });
});

authRouter.post("/api/comments", requireAuth, (req: AuthedRequest, res) => {
  const { movieId, movieTitle, text, rating } = req.body || {};
  if (!movieId || !text || !String(text).trim()) {
    res.status(400).json({ error: "movieId and text are required." });
    return;
  }
  const comment = {
    id: crypto.randomUUID(),
    movie_id: Number(movieId),
    movie_title: movieTitle || null,
    user_id: req.user!.id,
    user_name: req.user!.name,
    text: String(text).trim().slice(0, 2000),
    rating: rating != null ? Number(rating) : null,
    status: "pending" as const,
    created_at: new Date().toISOString(),
  };
  db.data.comments.push(comment);
  db.save();
  res.status(201).json({ comment });
});

// ---------------------------------------------------------------------------
// PUBLIC CATEGORY VISIBILITY — read-only, no auth required. Lets every
// visitor's navbar respect genres the admin has hidden site-wide.
// ---------------------------------------------------------------------------

authRouter.get("/api/categories/hidden", (_req, res) => {
  const hiddenIds = db.data.category_overrides.filter((c) => c.hidden).map((c) => c.genre_id);
  res.json({ hiddenIds });
});

authRouter.get("/api/categories/public", (_req, res) => {
  const overrides = db.data.category_overrides;
  res.json({
    hiddenIds: overrides.filter((c) => c.hidden).map((c) => c.genre_id),
    labels: Object.fromEntries(
      overrides.filter((c) => c.label).map((c) => [String(c.genre_id), c.label as string])
    ),
  });
});

// ---------------------------------------------------------------------------
// CUSTOM CONTENT (CMS) — public, read-only. Shaped to drop straight into the
// same Movie[] arrays the homepage already renders with MovieCard, so admin-
// authored titles show up right alongside TMDB's catalog with no special
// casing on the frontend.
// ---------------------------------------------------------------------------

authRouter.get("/api/content/custom", (_req, res) => {
  const movies = db.data.custom_content.map((c) => ({
    id: c.numeric_id,
    title: c.title,
    name: c.media_type === 'tv' ? c.title : undefined, // For TV shows
    overview: c.overview,
    poster_path: c.poster_url,
    backdrop_path: c.backdrop_url,
    vote_average: c.rating,
    release_date: c.release_date || undefined,
    first_air_date: c.first_air_date || c.release_date || undefined,
    genre_ids: c.genre_ids || [],
    genres: c.genre_names.map((name, i) => ({ id: c.genre_ids?.[i] || i, name })),
    media_type: c.media_type,
    isCustom: true,
    trailerYoutubeKey: c.trailer_youtube_key || undefined,
    // Path to an admin-uploaded video file this site owns the rights to
    // (served by this same backend). Undefined means trailer-only.
    videoUrl: c.video_url || undefined,
    // External movie URL for third-party streaming sites
    fullMovieUrl: c.full_movie_url || undefined,
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
    video: c.video,
  }));
  res.json({ movies });
});

// ---------------------------------------------------------------------------
// MY LIST (manual save-for-later)
// ---------------------------------------------------------------------------

authRouter.get("/api/my-list", requireAuth, async (req: AuthedRequest, res) => {
  // Try to get from Supabase first, fall back to local db
  try {
    const supabaseMyList = await getUserMyList(req.user!.id);
    const localMyList = getUserExtras(req.user!.id).myList;
    // Combine both sources, preferring Supabase
    const allMyList = [...new Set([...supabaseMyList.map(m => m.movie_id), ...localMyList])];
    res.json({ movieIds: allMyList });
  } catch (error) {
    console.error('[MyList] Error fetching from Supabase, using local:', error);
    res.json({ movieIds: getUserExtras(req.user!.id).myList });
  }
});

authRouter.post("/api/my-list", requireAuth, async (req: AuthedRequest, res) => {
  const { movieId } = req.body || {};
  if (!movieId) {
    res.status(400).json({ error: "movieId is required." });
    return;
  }
  const userId = req.user!.id;
  const used = computeListStorageUsed(userId);
  if (used + DEFAULT_ITEM_BYTES > LIST_STORAGE_LIMIT_BYTES) {
    res.status(413).json({ error: "List storage full (2GB limit). Remove items from My List, Favorites, or Watchlist to free space." });
    return;
  }
  
  // Add to local db for compatibility
  const exists = (db.data.my_list || []).some((w) => w.user_id === userId && w.movie_id === movieId);
  if (!exists) {
    if (!db.data.my_list) db.data.my_list = [];
    db.data.my_list.push({
      user_id: userId,
      movie_id: movieId,
      added_at: new Date().toISOString(),
      estimated_bytes: DEFAULT_ITEM_BYTES,
    });
    db.save();
  }
  
  // Also sync to Supabase
  try {
    await addToMyList(userId, movieId);
  } catch (error) {
    console.error('[MyList] Error syncing to Supabase:', error);
    // Continue anyway since local db was updated
  }
  
  res.status(201).json({ ok: true });
});

authRouter.delete("/api/my-list/:movieId", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const movieId = Number(req.params.movieId);
  
  // Remove from local db
  db.data.my_list = (db.data.my_list || []).filter((w) => !(w.user_id === userId && w.movie_id === movieId));
  db.save();
  
  // Also remove from Supabase
  try {
    await removeFromMyList(userId, movieId);
  } catch (error) {
    console.error('[MyList] Error removing from Supabase:', error);
    // Continue anyway since local db was updated
  }
  
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// WATCHLIST (continue watching — derived from history, read-only via API)
// ---------------------------------------------------------------------------

authRouter.get("/api/watchlist", requireAuth, async (req: AuthedRequest, res) => {
  // Try to get from Supabase first, fall back to local db
  try {
    const supabaseWatchlist = await getUserWatchlist(req.user!.id);
    const localWatchlist = getUserExtras(req.user!.id).watchlist;
    // Combine both sources, preferring Supabase
    const allWatchlist = [...new Set([...supabaseWatchlist.map(w => w.movie_id), ...localWatchlist])];
    res.json({ movieIds: allWatchlist });
  } catch (error) {
    console.error('[Watchlist] Error fetching from Supabase, using local:', error);
    res.json({ movieIds: getUserExtras(req.user!.id).watchlist });
  }
});

authRouter.post("/api/watchlist", requireAuth, (req: AuthedRequest, res) => {
  // Legacy endpoint — redirects to my-list for manual saves
  const { movieId } = req.body || {};
  if (!movieId) {
    res.status(400).json({ error: "movieId is required." });
    return;
  }
  req.body = { movieId };
  const userId = req.user!.id;
  const used = computeListStorageUsed(userId);
  if (used + DEFAULT_ITEM_BYTES > LIST_STORAGE_LIMIT_BYTES) {
    res.status(413).json({ error: "List storage full (2GB limit). Remove items to free space." });
    return;
  }
  if (!db.data.my_list) db.data.my_list = [];
  const exists = db.data.my_list.some((w) => w.user_id === userId && w.movie_id === movieId);
  if (!exists) {
    db.data.my_list.push({
      user_id: userId,
      movie_id: movieId,
      added_at: new Date().toISOString(),
      estimated_bytes: DEFAULT_ITEM_BYTES,
    });
    db.save();
  }
  res.status(201).json({ ok: true });
});

authRouter.delete("/api/watchlist/:movieId", requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const movieId = Number(req.params.movieId);
  db.data.my_list = (db.data.my_list || []).filter((w) => !(w.user_id === userId && w.movie_id === movieId));
  db.save();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// DOWNLOADS
// ---------------------------------------------------------------------------

authRouter.get("/api/downloads", requireAuth, (req: AuthedRequest, res) => {
  const extras = getUserExtras(req.user!.id);
  res.json({
    downloads: extras.downloads,
    storageUsed: extras.downloadStorageUsed,
    storageLimit: DOWNLOAD_STORAGE_LIMIT_BYTES,
  });
});

authRouter.post("/api/downloads", requireAuth, (req: AuthedRequest, res) => {
  const { movieId, title, poster, sizeBytes, mediaType } = req.body || {};
  if (!movieId) {
    res.status(400).json({ error: "movieId is required." });
    return;
  }
  const userId = req.user!.id;
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
  if (!db.data.downloads) db.data.downloads = [];
  const exists = db.data.downloads.some((d) => d.user_id === userId && d.movie_id === movieId);
  if (!exists) {
    db.data.downloads.push({
      user_id: userId,
      movie_id: movieId,
      title: title || "Untitled",
      poster: poster || null,
      size_bytes: size,
      added_at: new Date().toISOString(),
      media_type: mediaType === "tv" ? "tv" : "movie",
    });
    db.save();
  }
  res.status(201).json({
    ok: true,
    storageUsed: getUserExtras(userId).downloadStorageUsed,
    storageLimit: DOWNLOAD_STORAGE_LIMIT_BYTES,
    downloads: getUserExtras(userId).downloads,
  });
});

authRouter.delete("/api/downloads/:movieId", requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const movieId = Number(req.params.movieId);
  db.data.downloads = (db.data.downloads || []).filter((d) => !(d.user_id === userId && d.movie_id === movieId));
  db.save();
  res.json({
    ok: true,
    storageUsed: getUserExtras(userId).downloadStorageUsed,
    storageLimit: DOWNLOAD_STORAGE_LIMIT_BYTES,
    downloads: getUserExtras(userId).downloads,
  });
});

authRouter.get("/api/config/public", (_req, res) => {
  const settings = db.data.site_settings;
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
    mailerEnabled: getMailerStatus().configured,
  });
});

/** Active ads for the public website — no auth required. */
authRouter.get("/api/ads/public", (_req, res) => {
  const ads = db.data.ads
    .filter((a) => a.active)
    .map((a) => ({
      id: a.id,
      title: a.title,
      image_url: a.image_url,
      target_url: a.target_url,
      placement: a.placement,
    }));
  res.json({ ads });
});

// ---------------------------------------------------------------------------
// APK DOWNLOAD
// ---------------------------------------------------------------------------

authRouter.get("/api/download-apk", async (_req, res) => {
  // If an APK URL is configured in site settings or environment, redirect
  // to it so the header "Install APK" link can download it. Otherwise
  // return an informative 404 response so the client can fall back to
  // the PWA install flow.
  const apkUrl = db.data.site_settings?.apkUrl || process.env.APK_URL || "";
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
      Readable.fromWeb(upstream.body as any).pipe(res);
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


// ---------------------------------------------------------------------------
// FAVORITES
// ---------------------------------------------------------------------------

authRouter.get("/api/favorites", requireAuth, async (req: AuthedRequest, res) => {
  // Try to get from Supabase first, fall back to local db
  try {
    const supabaseFavorites = await getUserFavorites(req.user!.id);
    const localFavorites = getUserExtras(req.user!.id).favorites;
    // Combine both sources, preferring Supabase
    const allFavorites = [...new Set([...supabaseFavorites.map(f => f.movie_id), ...localFavorites])];
    res.json({ movieIds: allFavorites });
  } catch (error) {
    console.error('[Favorites] Error fetching from Supabase, using local:', error);
    res.json({ movieIds: getUserExtras(req.user!.id).favorites });
  }
});

authRouter.post("/api/favorites", requireAuth, async (req: AuthedRequest, res) => {
  const { movieId } = req.body || {};
  if (!movieId) {
    res.status(400).json({ error: "movieId is required." });
    return;
  }
  const userId = req.user!.id;
  const used = computeListStorageUsed(userId);
  if (used + DEFAULT_ITEM_BYTES > LIST_STORAGE_LIMIT_BYTES) {
    res.status(413).json({ error: "List storage full (2GB limit). Remove items to free space." });
    return;
  }
  
  // Add to local db for compatibility
  const exists = db.data.favorites.some((f) => f.user_id === userId && f.movie_id === movieId);
  if (!exists) {
    db.data.favorites.push({ user_id: userId, movie_id: movieId, added_at: new Date().toISOString() });
    db.save();
  }
  
  // Also sync to Supabase
  try {
    await addToFavorites(userId, movieId);
  } catch (error) {
    console.error('[Favorites] Error syncing to Supabase:', error);
    // Continue anyway since local db was updated
  }
  
  res.status(201).json({ ok: true });
});

authRouter.delete("/api/favorites/:movieId", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const movieId = Number(req.params.movieId);
  
  // Remove from local db
  db.data.favorites = db.data.favorites.filter((f) => !(f.user_id === userId && f.movie_id === movieId));
  db.save();
  
  // Also remove from Supabase
  try {
    await removeFromFavorites(userId, movieId);
  } catch (error) {
    console.error('[Favorites] Error removing from Supabase:', error);
    // Continue anyway since local db was updated
  }
  
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// NOTIFICATIONS — protected: an unauthenticated request gets a clear 401
// prompting sign-in, per the "notifications require login" requirement.
// ---------------------------------------------------------------------------

authRouter.get("/api/notifications", requireAuth, (req: AuthedRequest, res) => {
  const notifications = db.data.notifications
    .filter((n) => n.user_id === req.user!.id)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 50);
  res.json({ notifications });
});

authRouter.post("/api/notifications", requireAuth, (req: AuthedRequest, res) => {
  const { type, title, message } = req.body || {};
  if (!type || !title || !message) {
    res.status(400).json({ error: "type, title, and message are required." });
    return;
  }
  const id = crypto.randomUUID();
  db.data.notifications.push({
    id,
    user_id: req.user!.id,
    type,
    title,
    message,
    read: 0,
    created_at: new Date().toISOString(),
  });
  db.save();
  res.status(201).json({ id });
});

authRouter.put("/api/notifications/:id/read", requireAuth, (req: AuthedRequest, res) => {
  const n = db.data.notifications.find((n) => n.id === req.params.id && n.user_id === req.user!.id);
  if (n) {
    n.read = 1;
    db.save();
  }
  res.json({ ok: true });
});

authRouter.put("/api/notifications/read-all", requireAuth, (req: AuthedRequest, res) => {
  db.data.notifications.forEach((n) => {
    if (n.user_id === req.user!.id) n.read = 1;
  });
  db.save();
  res.json({ ok: true });
});

authRouter.delete("/api/notifications", requireAuth, (req: AuthedRequest, res) => {
  db.data.notifications = db.data.notifications.filter((n) => n.user_id !== req.user!.id);
  db.save();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// WATCH HISTORY
// ---------------------------------------------------------------------------

authRouter.get("/api/watch-history", requireAuth, (req: AuthedRequest, res) => {
  res.json({ history: getUserExtras(req.user!.id).watchHistory });
});

authRouter.post("/api/watch-history", requireAuth, (req: AuthedRequest, res) => {
  const { movieId, title, poster, mediaType, duration, season, episode } = req.body || {};
  if (!movieId) {
    res.status(400).json({ error: "movieId is required." });
    return;
  }
  const userId = req.user!.id;
  const existing = db.data.watch_history.find((h) => h.user_id === userId && h.movie_id === movieId);
  if (existing) {
    existing.watched_at = new Date().toISOString();
  } else {
    db.data.watch_history.push({
      user_id: userId,
      movie_id: movieId,
      title: title || null,
      poster: poster || null,
      media_type: mediaType || null,
      duration: duration || 0,
      season: season ?? null,
      episode: episode ?? null,
      progress: 0,
      watched_at: new Date().toISOString(),
    });
  }
  db.save();
  res.status(201).json({ ok: true });
});

authRouter.put("/api/watch-history/:movieId/progress", requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const movieId = Number(req.params.movieId);
  const { progress } = req.body || {};
  const existing = db.data.watch_history.find((h) => h.user_id === userId && h.movie_id === movieId);
  if (existing) {
    existing.progress = progress ?? 0;
    db.save();
  }
  res.json({ ok: true });
});

authRouter.delete("/api/watch-history", requireAuth, (req: AuthedRequest, res) => {
  db.data.watch_history = db.data.watch_history.filter((h) => h.user_id !== req.user!.id);
  db.save();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// LIVE CHAT — "Popular" is one shared global feed (readable by anyone,
// postable only when signed in) with threaded replies and likes. "Inbox" is
// private 1-to-1 messaging between any two signed-in users. Both are
// polled by the client rather than pushed over a socket — simple, and
// plenty responsive at this app's scale.
// ---------------------------------------------------------------------------

const CHAT_ROOMS = [
  { id: "action", label: "Action" },
  { id: "horror", label: "Horror" },
  { id: "comedy", label: "Comedy" },
  { id: "anime", label: "Anime" },
  { id: "marvel", label: "Marvel" },
  { id: "dc", label: "DC" },
  { id: "tv-shows", label: "TV Shows" },
  { id: "sci-fi", label: "Sci-Fi" },
  { id: "romance", label: "Romance" },
  { id: "african-movies", label: "African Movies" },
] as const;

function normalizeSharedMovie(raw: any): DbSharedMovieCard | null {
  if (!raw || typeof raw !== "object" || !raw.id || !raw.title) return null;
  return {
    id: Number(raw.id),
    title: String(raw.title),
    poster_path: raw.poster_path ? String(raw.poster_path) : null,
    backdrop_path: raw.backdrop_path ? String(raw.backdrop_path) : null,
    vote_average: Number(raw.vote_average || 0),
    media_type: raw.media_type === "tv" ? "tv" : "movie",
    genres: Array.isArray(raw.genres) ? raw.genres.map((g) => String(g)) : [],
    overview: raw.overview ? String(raw.overview) : undefined,
  };
}

function normalizedReactions(raw: any): Record<string, string[]> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string[]> = {};
  for (const [emoji, users] of Object.entries(raw)) {
    out[emoji] = Array.isArray(users) ? users.map((u) => String(u)) : [];
  }
  return out;
}

function toggleReaction(reactions: Record<string, string[]>, emoji: string, actorId: string) {
  const current = reactions[emoji] || [];
  const exists = current.includes(actorId);
  reactions[emoji] = exists ? current.filter((id) => id !== actorId) : [...current, actorId];
  if (reactions[emoji].length === 0) delete reactions[emoji];
}

function toPublicChatMessage(m: (typeof db.data.chat_messages)[number], viewerId?: string) {
  const reactions = normalizedReactions(m.reactions);
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
    mediaType: m.media_type || null,
    editedAt: m.edited_at || null,
    roomId: m.room_id || null,
    quoteMessageId: m.quote_message_id || null,
    sharedMovie: m.shared_movie || null,
    reactions: reactions,
  };
}

function toPublicDirectMessage(m: (typeof db.data.direct_messages)[number], viewerId: string) {
  const reactions = normalizedReactions(m.reactions);
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
    mediaType: m.media_type || null,
    editedAt: m.edited_at || null,
    deliveredAt: m.delivered_at || m.created_at,
    seenAt: m.seen_at || (m.read ? m.created_at : null),
    quoteMessageId: m.quote_message_id || null,
    sharedMovie: m.shared_movie || null,
    reactions: reactions,
  };
}

function getChatActor(req: AuthedRequest) {
  const guestId = String(req.body?.guestId || req.query.guestId || "").trim();
  if (req.user) {
    return {
      actorId: req.user.id,
      userId: req.user.id,
      guestId: "",
      name: req.user.name,
      avatar: req.user.avatar,
      isGuest: false,
    };
  }
  return {
    actorId: guestId || `guest-${crypto.randomUUID()}`,
    userId: "",
    guestId: guestId || `guest-${crypto.randomUUID()}`,
    name: "Guest Viewer",
    avatar: "",
    isGuest: true,
  };
}

function buildChatMeta(viewerId?: string) {
  const online = getPresenceEntries();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();
  const messagesToday = db.data.chat_messages.filter((m) => m.created_at >= todayIso).length + db.data.direct_messages.filter((m) => m.created_at >= todayIso).length;
  const nowWatching = online.filter((entry) => !!entry.currentMovieTitle).length;

  const trendingCounts = new Map<string, { count: number; poster?: string | null }>();
  for (const item of db.data.watch_history.filter((h) => h.watched_at >= todayIso && h.title)) {
    const key = item.title || "Unknown";
    const existing = trendingCounts.get(key) || { count: 0, poster: item.poster };
    existing.count += 1;
    if (!existing.poster && item.poster) existing.poster = item.poster;
    trendingCounts.set(key, existing);
  }
  const trendingMovieEntry =
    Array.from(trendingCounts.entries()).sort((a, b) => b[1].count - a[1].count)[0] ||
    ["Community Favorite", { count: 0, poster: null }];

  const roomStats = CHAT_ROOMS.map((room) => ({
    ...room,
    messageCount: db.data.chat_messages.filter((m) => (m.room_id || "action") === room.id).length,
  }));

  const topMembers = Array.from(
    db.data.chat_messages.reduce((map, msg) => {
      const entry = map.get(msg.user_id) || {
        userId: msg.user_id,
        name: msg.user_name,
        avatar: msg.user_avatar,
        messages: 0,
        reputation: 0,
      };
      entry.messages += 1;
      entry.reputation += entry.messages * 2 + (msg.liked_by?.length || 0) * 5;
      map.set(msg.user_id, entry);
      return map;
    }, new Map<string, { userId: string; name: string; avatar: string; messages: number; reputation: number }>())
  )
    .sort((a, b) => b.reputation - a.reputation)
    .slice(0, 5)
    .map((member, index) => ({
      ...member,
      level: Math.max(1, Math.round(member.messages / 5) + 1),
      badge: index === 0 ? "Movie Master" : member.messages > 15 ? "Top Critic" : "Film Fan",
    }));

  const onlineMembers = online
    .filter((entry) => entry.userId && entry.userId !== viewerId)
    .slice(0, 8)
    .map((entry) => ({
      userId: entry.userId,
      name: entry.name,
      avatar: entry.avatar || "",
      status: entry.status,
      currentMovieTitle: entry.currentMovieTitle || null,
      lastActiveAt: entry.lastActiveAt,
    }));

  return {
    serverStatus: "online",
    stats: {
      onlineUsers: online.length,
      nowWatching,
      messagesToday,
      activeWatchParties: Math.max(1, Math.round(nowWatching / 3)),
      reviewsPosted: db.data.comments.filter((c) => c.created_at >= todayIso).length,
      trendingMovie: trendingMovieEntry[0],
      topCommunityMember: topMembers[0]?.name || "Cinemax Crew",
    },
    trendingMovie: {
      title: trendingMovieEntry[0],
      watchCount: trendingMovieEntry[1].count,
      poster: trendingMovieEntry[1].poster || null,
    },
    rooms: roomStats,
    onlineMembers,
    watchParties: online
      .filter((entry) => !!entry.currentMovieTitle)
      .slice(0, 5)
      .map((entry) => ({
        id: `${entry.clientId}-${entry.currentMovieTitle}`,
        hostName: entry.name,
        title: entry.currentMovieTitle,
      })),
    topMembers,
    topReviews: db.data.comments
      .filter((c) => c.status === "approved")
      .sort((a, b) => (a.rating || 0) < (b.rating || 0) ? 1 : -1)
      .slice(0, 4)
      .map((c) => ({
        id: c.id,
        author: c.user_name,
        movieTitle: c.movie_title || "Untitled",
        rating: c.rating || 0,
        text: c.text,
      })),
    rewards: {
      title: "Daily Rewards",
      description: "Send 3 messages, rate 1 movie, and join a room to unlock bonus points.",
      claimable: true,
    },
    activityFeed: getActivityFeed(),
    typing: getTypingEntries(),
  };
}

// A base64 data URL of roughly this length keeps chat snappy on the
// file-backed JSON store. ~2.5MB decoded, generous for a photo or a short
// voice note without letting one message balloon the whole database.
const MAX_MEDIA_DATA_URL_LENGTH = 3_500_000;

// Anyone (including guests) can read the global feed — only posting requires
// being signed in. requireAuth isn't used here; we manually read the cookie
// so a logged-in viewer's own likes still show as "liked" without forcing
// a login wall just to look at Popular.
authRouter.get("/api/chat/global", (req: AuthedRequest, res) => {
  const viewerId = getOptionalUserId(req);
  const roomId = String(req.query.roomId || "").trim();
  const messages = db.data.chat_messages
    .filter((m) => !roomId || (m.room_id || "action") === roomId)
    .slice(-500)
    .map((m) => toPublicChatMessage(m, viewerId));
  res.json({ messages });
});

authRouter.post("/api/chat/global", requireAuth, (req: AuthedRequest, res) => {
  const { text, parentId, mediaUrl, mediaType, roomId, quoteMessageId, sharedMovie } = req.body || {};
  const trimmed = String(text || "").trim();

  // The global "Popular" feed accepts images but never voice notes — voice
  // messages are an Inbox-only feature.
  if (mediaType && mediaType !== "image") {
    res.status(400).json({ error: "Voice messages can only be sent in your Inbox." });
    return;
  }
  if (!trimmed && !mediaUrl) {
    res.status(400).json({ error: "Message text or an image is required." });
    return;
  }
  if (trimmed.length > 1000) {
    res.status(400).json({ error: "Messages must be 1000 characters or fewer." });
    return;
  }
  if (mediaUrl && (typeof mediaUrl !== "string" || mediaUrl.length > MAX_MEDIA_DATA_URL_LENGTH)) {
    res.status(400).json({ error: "That image is too large to send." });
    return;
  }
  if (parentId && !db.data.chat_messages.some((m) => m.id === parentId)) {
    res.status(404).json({ error: "The message you're replying to no longer exists." });
    return;
  }

  const message = {
    id: crypto.randomUUID(),
    user_id: req.user!.id,
    user_name: req.user!.name,
    user_avatar: req.user!.avatar,
    text: trimmed,
    parent_id: parentId || null,
    liked_by: [] as string[],
    created_at: new Date().toISOString(),
    media_url: mediaUrl ? String(mediaUrl) : null,
    media_type: mediaUrl ? "image" as const : null,
    edited_at: null,
    room_id: typeof roomId === "string" && roomId ? roomId : CHAT_ROOMS[0].id,
    quote_message_id: quoteMessageId ? String(quoteMessageId) : null,
    shared_movie: normalizeSharedMovie(sharedMovie),
    reactions: {},
  };
  db.data.chat_messages.push(message);
  db.save();
  const publicMessage = toPublicChatMessage(message, req.user!.id);
  pushChatActivity("💬", `${req.user!.name} posted in ${(CHAT_ROOMS.find((room) => room.id === message.room_id)?.label) || "Live Chat"}.`);
  if (message.shared_movie?.title) {
    pushChatActivity("🎬", `${req.user!.name} shared ${message.shared_movie.title} in chat.`);
  }
  broadcastChatEvent("global_message_created", { message: publicMessage });
  broadcastChatEvent("chat_meta_updated", buildChatMeta(req.user!.id));
  res.status(201).json({ message: publicMessage });
});

authRouter.post("/api/chat/global/:id/like", requireAuth, (req: AuthedRequest, res) => {
  const message = db.data.chat_messages.find((m) => m.id === req.params.id);
  if (!message) {
    res.status(404).json({ error: "Message not found." });
    return;
  }
  const userId = req.user!.id;
  const idx = message.liked_by.indexOf(userId);
  if (idx === -1) message.liked_by.push(userId);
  else message.liked_by.splice(idx, 1);
  db.save();
  const publicMessage = toPublicChatMessage(message, userId);
  broadcastChatEvent("global_message_updated", { message: publicMessage });
  res.json({ message: publicMessage });
});

authRouter.post("/api/chat/global/:id/react", requireAuth, (req: AuthedRequest, res) => {
  const message = db.data.chat_messages.find((m) => m.id === req.params.id);
  const emoji = String(req.body?.emoji || "").trim();
  if (!message) {
    res.status(404).json({ error: "Message not found." });
    return;
  }
  if (!emoji) {
    res.status(400).json({ error: "emoji is required." });
    return;
  }
  message.reactions = normalizedReactions(message.reactions);
  toggleReaction(message.reactions, emoji, req.user!.id);
  db.save();
  const publicMessage = toPublicChatMessage(message, req.user!.id);
  broadcastChatEvent("message_reaction_updated", { scope: "global", message: publicMessage });
  res.json({ message: publicMessage });
});

authRouter.patch("/api/chat/global/:id", requireAuth, (req: AuthedRequest, res) => {
  const message = db.data.chat_messages.find((m) => m.id === req.params.id);
  const text = String(req.body?.text || "").trim();
  if (!message) {
    res.status(404).json({ error: "Message not found." });
    return;
  }
  if (message.user_id !== req.user!.id && req.user!.role !== "admin") {
    res.status(403).json({ error: "You can only edit your own messages." });
    return;
  }
  if (!text) {
    res.status(400).json({ error: "text is required." });
    return;
  }
  message.text = text.slice(0, 1000);
  message.edited_at = new Date().toISOString();
  db.save();
  const publicMessage = toPublicChatMessage(message, req.user!.id);
  broadcastChatEvent("global_message_updated", { message: publicMessage });
  res.json({ message: publicMessage });
});

authRouter.delete("/api/chat/global/:id", requireAuth, (req: AuthedRequest, res) => {
  const message = db.data.chat_messages.find((m) => m.id === req.params.id);
  if (!message) {
    res.status(404).json({ error: "Message not found." });
    return;
  }
  if (message.user_id !== req.user!.id && req.user!.role !== "admin") {
    res.status(403).json({ error: "You can only delete your own messages." });
    return;
  }
  db.data.chat_messages = db.data.chat_messages.filter((m) => m.id !== req.params.id && m.parent_id !== req.params.id);
  db.save();
  broadcastChatEvent("global_message_deleted", { id: req.params.id, parentId: message.parent_id || null });
  broadcastChatEvent("chat_meta_updated", buildChatMeta(req.user!.id));
  res.json({ ok: true });
});

authRouter.get("/api/chat/meta", (req: AuthedRequest, res) => {
  res.json(buildChatMeta(getOptionalUserId(req)));
});

authRouter.get("/api/chat/stream", (req: AuthedRequest, res) => {
  const clientId = String(req.query.clientId || crypto.randomUUID());
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  registerChatClient(clientId, res);
  res.write(`retry: 2500\n\n`);
  res.write(`event: ready\ndata: ${JSON.stringify({ clientId })}\n\n`);
  broadcastChatEvent("chat_meta_updated", buildChatMeta(getOptionalUserId(req)));
  req.on("close", () => {
    unregisterChatClient(clientId);
    clearPresence(clientId);
  });
});

authRouter.post("/api/chat/presence", (req: AuthedRequest, res) => {
  const actor = getChatActor(req);
  const clientId = String(req.body?.clientId || "").trim() || actor.actorId;
  upsertPresence({
    clientId,
    userId: actor.userId || undefined,
    guestId: actor.userId ? undefined : actor.guestId,
    name: actor.name,
    avatar: actor.avatar,
    status: req.body?.status === "away" ? "away" : "online",
    currentView: req.body?.currentView ? String(req.body.currentView) : undefined,
    currentMovieTitle: req.body?.currentMovieTitle ? String(req.body.currentMovieTitle) : undefined,
    lastActiveAt: new Date().toISOString(),
    panelOpen: !!req.body?.panelOpen,
    language: req.body?.language ? String(req.body.language) : undefined,
  });
  res.json({ ok: true, meta: buildChatMeta(actor.userId || undefined) });
});

authRouter.post("/api/chat/typing", (req: AuthedRequest, res) => {
  const actor = getChatActor(req);
  if (!req.body?.isTyping) {
    clearTypingForActor(actor.actorId);
    res.json({ ok: true });
    return;
  }
  setTyping({
    scope: req.body?.scope === "dm" ? "dm" : "global",
    userId: actor.userId || undefined,
    guestId: actor.userId ? undefined : actor.guestId,
    name: actor.name,
    roomId: req.body?.roomId ? String(req.body.roomId) : undefined,
    targetUserId: req.body?.targetUserId ? String(req.body.targetUserId) : undefined,
  });
  res.json({ ok: true });
});

// Directory of people you can DM — every active account except yourself.
// Deliberately excludes email/status/role: chat only needs a name + avatar.
authRouter.get("/api/chat/directory", requireAuth, (req: AuthedRequest, res) => {
  const people = db.data.users
    .filter((u) => u.id !== req.user!.id && u.status === "active")
    .map((u) => ({ id: u.id, name: u.name, avatar: u.avatar }));
  res.json({ people });
});

// One row per conversation the signed-in user is part of, newest first,
// with the other participant's info, the last message, and an unread count.
authRouter.get("/api/chat/conversations", requireAuth, (req: AuthedRequest, res) => {
  const myId = req.user!.id;
  const related = db.data.direct_messages.filter((m) => m.from_user_id === myId || m.to_user_id === myId);

  const byPartner = new Map<string, DbDirectMessage[]>();
  for (const m of related) {
    const partnerId = m.from_user_id === myId ? m.to_user_id : m.from_user_id;
    if (!byPartner.has(partnerId)) byPartner.set(partnerId, []);
    byPartner.get(partnerId)!.push(m);
  }

  const conversations = Array.from(byPartner.entries())
    .map(([partnerId, msgs]) => {
      const partner = getUserById(partnerId);
      const sorted = msgs.slice().sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
      const last = sorted[sorted.length - 1];
      const unreadCount = sorted.filter((m) => m.to_user_id === myId && !m.read).length;
      return {
        userId: partnerId,
        userName: partner?.name || "Deleted user",
        userAvatar: partner?.avatar || "",
        lastMessage: last.text,
        lastMessageAt: last.created_at,
        unreadCount,
      };
    })
    .sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1));

  res.json({ conversations });
});

authRouter.get("/api/chat/conversations/:userId", requireAuth, (req: AuthedRequest, res) => {
  const myId = req.user!.id;
  const partnerId = req.params.userId;
  if (!getUserById(partnerId)) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const thread = db.data.direct_messages
    .filter(
      (m) =>
        (m.from_user_id === myId && m.to_user_id === partnerId) ||
        (m.from_user_id === partnerId && m.to_user_id === myId)
    )
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));

  // Mark anything sent to me as read now that I've opened the thread.
  let changed = false;
  for (const m of thread) {
    if (m.to_user_id === myId && !m.read) {
      m.read = true;
      m.seen_at = new Date().toISOString();
      changed = true;
    }
  }
  if (changed) db.save();

  res.json({ messages: thread.map((m) => toPublicDirectMessage(m, myId)) });
});

authRouter.post("/api/chat/conversations/:userId", requireAuth, (req: AuthedRequest, res) => {
  const myId = req.user!.id;
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
  const { mediaUrl, mediaType, quoteMessageId, sharedMovie } = req.body || {};
  if (mediaType && mediaType !== "image" && mediaType !== "audio") {
    res.status(400).json({ error: "Unsupported attachment type." });
    return;
  }
  if (!trimmed && !mediaUrl) {
    res.status(400).json({ error: "Message text or an attachment is required." });
    return;
  }
  if (trimmed.length > 2000) {
    res.status(400).json({ error: "Messages must be 2000 characters or fewer." });
    return;
  }
  if (mediaUrl && (typeof mediaUrl !== "string" || mediaUrl.length > MAX_MEDIA_DATA_URL_LENGTH)) {
    res.status(400).json({ error: "That attachment is too large to send." });
    return;
  }

  const message = {
    id: crypto.randomUUID(),
    from_user_id: myId,
    to_user_id: partnerId,
    text: trimmed,
    liked_by: [] as string[],
    read: false,
    created_at: new Date().toISOString(),
    media_url: mediaUrl ? String(mediaUrl) : null,
    media_type: mediaUrl ? ((mediaType === "audio" ? "audio" : "image") as "audio" | "image") : null,
    edited_at: null,
    delivered_at: new Date().toISOString(),
    seen_at: null,
    quote_message_id: quoteMessageId ? String(quoteMessageId) : null,
    shared_movie: normalizeSharedMovie(sharedMovie),
    reactions: {},
  };
  db.data.direct_messages.push(message);
  db.save();

  db.data.notifications.push({
    id: crypto.randomUUID(),
    user_id: partnerId,
    type: "announcement",
    title: `New message from ${req.user!.name}`,
    message: trimmed ? trimmed.slice(0, 120) : (mediaType === "audio" ? "🎤 Voice message" : "📷 Image"),
    read: 0,
    created_at: new Date().toISOString(),
  });
  db.save();

  const publicMessage = toPublicDirectMessage(message, myId);
  pushChatActivity("📨", `${req.user!.name} sent a direct message.`);
  if (message.shared_movie?.title) {
    pushChatActivity("🎞️", `${req.user!.name} recommended ${message.shared_movie.title} privately.`);
  }
  broadcastChatEvent("direct_message_created", {
    message: publicMessage,
    participants: [myId, partnerId],
  });
  broadcastChatEvent("chat_meta_updated", buildChatMeta(myId));
  res.status(201).json({ message: publicMessage });
});

authRouter.post("/api/chat/dm/:id/like", requireAuth, (req: AuthedRequest, res) => {
  const message = db.data.direct_messages.find((m) => m.id === req.params.id);
  if (!message) {
    res.status(404).json({ error: "Message not found." });
    return;
  }
  const myId = req.user!.id;
  if (message.from_user_id !== myId && message.to_user_id !== myId) {
    res.status(403).json({ error: "You don't have access to this conversation." });
    return;
  }
  const idx = message.liked_by.indexOf(myId);
  if (idx === -1) message.liked_by.push(myId);
  else message.liked_by.splice(idx, 1);
  db.save();
  const publicMessage = toPublicDirectMessage(message, myId);
  broadcastChatEvent("direct_message_updated", { message: publicMessage, participants: [message.from_user_id, message.to_user_id] });
  res.json({ message: publicMessage });
});

authRouter.post("/api/chat/dm/:id/react", requireAuth, (req: AuthedRequest, res) => {
  const message = db.data.direct_messages.find((m) => m.id === req.params.id);
  const emoji = String(req.body?.emoji || "").trim();
  if (!message) {
    res.status(404).json({ error: "Message not found." });
    return;
  }
  const myId = req.user!.id;
  if (message.from_user_id !== myId && message.to_user_id !== myId) {
    res.status(403).json({ error: "You don't have access to this conversation." });
    return;
  }
  if (!emoji) {
    res.status(400).json({ error: "emoji is required." });
    return;
  }
  message.reactions = normalizedReactions(message.reactions);
  toggleReaction(message.reactions, emoji, myId);
  db.save();
  const publicMessage = toPublicDirectMessage(message, myId);
  broadcastChatEvent("message_reaction_updated", {
    scope: "dm",
    message: publicMessage,
    participants: [message.from_user_id, message.to_user_id],
  });
  res.json({ message: publicMessage });
});

authRouter.patch("/api/chat/dm/:id", requireAuth, (req: AuthedRequest, res) => {
  const message = db.data.direct_messages.find((m) => m.id === req.params.id);
  const text = String(req.body?.text || "").trim();
  if (!message) {
    res.status(404).json({ error: "Message not found." });
    return;
  }
  if (message.from_user_id !== req.user!.id) {
    res.status(403).json({ error: "You can only edit your own messages." });
    return;
  }
  if (!text) {
    res.status(400).json({ error: "text is required." });
    return;
  }
  message.text = text.slice(0, 2000);
  message.edited_at = new Date().toISOString();
  db.save();
  const publicMessage = toPublicDirectMessage(message, req.user!.id);
  broadcastChatEvent("direct_message_updated", { message: publicMessage, participants: [message.from_user_id, message.to_user_id] });
  res.json({ message: publicMessage });
});

authRouter.delete("/api/chat/dm/:id", requireAuth, (req: AuthedRequest, res) => {
  const message = db.data.direct_messages.find((m) => m.id === req.params.id);
  if (!message) {
    res.status(404).json({ error: "Message not found." });
    return;
  }
  if (message.from_user_id !== req.user!.id && req.user!.role !== "admin") {
    res.status(403).json({ error: "You can only delete your own messages." });
    return;
  }
  db.data.direct_messages = db.data.direct_messages.filter((m) => m.id !== req.params.id);
  db.save();
  broadcastChatEvent("direct_message_deleted", { id: req.params.id, participants: [message.from_user_id, message.to_user_id] });
  res.json({ ok: true });
});
