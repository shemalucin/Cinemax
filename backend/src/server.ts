import "dotenv/config";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
// Ensure config/.env is loaded in both dev and production builds.
try {
  const __dir = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.resolve(__dir, "../config/.env") });
  dotenv.config({ path: path.resolve(__dir, "../../config/.env") });
} catch {}
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { authRouter } from "./routes/website.js";
import { adminRouter } from "./routes/admin.js";
import { seedAdminUser, getUserById, getOptionalUserId, AuthedRequest, isAdminEmail } from "./lib/auth.js";
import { connectDB } from "../config/db.js";
import db, { initDb, flushDb } from "./lib/db.js";
import { getMailerStatus } from "./lib/mailer.js";
import { buildCinemaxKnowledgeBase } from "./lib/assistantKnowledge.js";
import { matchMoviesFromAnalysis, VisualAnalysis } from "./lib/tmdbMatch.js";

const app = express();

// Behind Render's proxy — required for `secure` cookies to be recognized.
app.set("trust proxy", 1);

// ---------------------------------------------------------------------------
// CORS — allow whatever's listed in CORS_ORIGIN / WEBSITE_URL / ADMIN_PANEL_URL
// (see backend/.env), plus local dev conveniences. No hosting-provider
// origins are hardcoded here; set the env vars for wherever you deploy.
// ---------------------------------------------------------------------------
function buildAllowedOrigins(): string[] {
  const raw: string[] = [];
  if (process.env.CORS_ORIGIN) raw.push(...process.env.CORS_ORIGIN.split(","));
  if (process.env.WEBSITE_URL) raw.push(process.env.WEBSITE_URL);
  if (process.env.ADMIN_PANEL_URL) raw.push(process.env.ADMIN_PANEL_URL);
  // Local dev conveniences - always allow these for development
  raw.push("http://localhost:5173", "http://localhost:5174", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:5174");
  return Array.from(
    new Set(
      raw
        .map((o) => (o || "").trim().replace(/\/+$/, ""))
        .filter(Boolean),
    ),
  );
}
const allowedOrigins = buildAllowedOrigins();
console.log("[cors] Allowed origins:", allowedOrigins);

function isAllowedOrigin(origin: string): boolean {
  const normalized = origin.replace(/\/+$/, "");
  if (allowedOrigins.includes(normalized)) return true;
  // Render static service URLs can change if the project is renamed. Trusting
  // Render HTTPS origins prevents hosted login from breaking with a browser
  // "Failed to fetch" when the service name differs from render.yaml.
  if (/^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(normalized)) return true;
  return false;
}

const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    // Non-browser callers (curl, server-to-server) send no Origin — allow.
    if (!origin) return cb(null, true);
    
    // Always allow localhost origins for development/testing
    if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:") || 
        origin.startsWith("https://localhost:") || origin.startsWith("https://127.0.0.1:")) {
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
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "20mb" }));
app.use(cookieParser());

// Serves only files the admin explicitly uploaded (content this site owns
// the rights to) — never a proxy or scrape of a third-party source.
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ---------------------------------------------------------------------------
// Admin panel (built React app) — served from this same backend/Render
// service at /admin, so a single Render URL covers both the API and the
// admin UI (matches a single-service deployment where WEBSITE_URL and
// ADMIN_PANEL_URL point at InfinityFree and this Render URL respectively).
// The admin build is copied into backend/public/admin as part of `npm run
// build` (see package.json / DEPLOYMENT_GUIDE.md). If that folder doesn't
// exist (e.g. admin deployed separately), this simply serves nothing here.
// ---------------------------------------------------------------------------
const adminDistPath = path.join(process.cwd(), "public", "admin");
app.use("/admin", express.static(adminDistPath));
app.get("/admin/*", (req, res, next) => {
  if (req.path.startsWith("/admin/api")) return next();
  res.sendFile(path.join(adminDistPath, "index.html"), (err) => {
    if (err) next();
  });
});

// Render healthcheck target (declared in render.yaml). Kept intentionally
// tiny so it always responds even when the DB is degraded.
app.get("/api/health", (_req, res) => {
  const mailerStatus = getMailerStatus();
  res.json({
    status: "ok",
    uptime: process.uptime(),
    db: process.env.MONGO_URI ? "mongo" : "file",
    mailer: mailerStatus.configured ? "configured" : "missing",
    mailerUser: mailerStatus.user ? mailerStatus.user.substring(0, 3) + "***" : "not_set",
    time: new Date().toISOString(),
  });
});

// Test endpoint to verify mailer configuration
app.get("/api/test/mailer", async (_req, res) => {
  const mailerStatus = getMailerStatus();
  res.json({
    configured: mailerStatus.configured,
    user: mailerStatus.user,
    envEmailUser: process.env.EMAIL_USER ? "set" : "missing",
    envEmailAppPassword: process.env.EMAIL_APP_PASSWORD ? "set" : "missing",
    envGmailUser: process.env.GMAIL_USER ? "set" : "missing",
    envGmailAppPassword: process.env.GMAIL_APP_PASSWORD ? "set" : "missing",
  });
});

app.use(authRouter);
app.use(adminRouter);


app.post("/api/assistant", async (req, res) => {
  try {
    if (db.data?.site_settings?.aiEnabled === false) {
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
      sessionUser: resolveSessionUser(req),
    });

    const safeHistory = Array.isArray(history)
      ? history.slice(-24).map((h: any) => ({
          role: h?.role === "assistant" ? "assistant" : "user",
          content: String(h?.content ?? h?.text ?? "").slice(0, 3000),
        })).filter((h: any) => h.content.trim())
      : [];

    const routed = await routedAssistantChat([
      { role: "system", content: systemPrompt },
      ...safeHistory,
      { role: "user", content: userMessage },
    ], db.data?.site_settings?.aiModel);

    const user = resolveSessionUser(req);
    saveAiChatLog(user, "user", userMessage, "system");
    saveAiChatLog(user, "assistant", routed.text, routed.engine);

    res.json({ text: routed.text, engine: routed.engine });
  } catch (err: any) {
    console.error("[assistant] request failed:", err);
    const missingKey = String(err?.message || "").toLowerCase().includes("api key");
    res.status(missingKey ? 503 : 500).json({
      error: missingKey
        ? "AI assistant is temporarily unavailable. Please try again later."
        : "The AI assistant is temporarily unavailable. Please try again.",
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
  } catch (err: any) {
    console.error("[agent] image generation failed:", err);
    const missingKey = String(err?.message || "").toLowerCase().includes("api key");
    res.status(missingKey ? 503 : 500).json({
      error: missingKey
        ? "Image generation is temporarily unavailable. Please try again later."
        : "Image generation is temporarily unavailable. Please try again.",
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

    let aiAnswer: string | undefined;
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
                  rating: m.vote_average,
                })),
              },
              sessionUser: resolveSessionUser(req),
            }),
          },
          { role: "user", content: String(question).trim() },
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
      ...(aiAnswer ? { aiAnswer } : {}),
    });
  } catch (err: any) {
    console.error("[visual-search] request failed:", err);
    const message = String(err?.message || "");
    const missingKey = message.toLowerCase().includes("api key");
    res.status(missingKey ? 503 : 500).json({
      error: missingKey
        ? "Visual search is temporarily unavailable. Please try again later."
        : "Visual search is temporarily unavailable. Please try again.",
    });
  }
});

function getApiKey(name: "tmdb" | "gemini" | "groq" | "openai" | "grok"): string {
  // Prioritize environment variables over database values
  const fromEnv = name === "tmdb"
    ? process.env.TMDB_API_KEY
    : name === "gemini"
    ? process.env.GEMINI_API_KEY
    : name === "groq"
    ? process.env.GROQ_API_KEY
    : name === "openai"
    ? process.env.OPENAI_API_KEY
    : process.env.GROK_API_KEY;
  
  // Fall back to database if environment variable is not set
  const fromDb = db.data?.site_settings?.apiKeys?.[name];
  
  const result = (fromEnv || fromDb || "").trim();
  
  // Debug logging for API key loading
  if (name === "gemini") {
    console.log(`[getApiKey] ${name}: fromEnv=${fromEnv ? 'SET' : 'NOT_SET'}, fromDb=${fromDb ? 'SET' : 'NOT_SET'}, result=${result ? 'HAS_VALUE' : 'EMPTY'}`);
  }
  
  return result;
}

function getGeminiClient(): GoogleGenAI {
  const key = getApiKey("gemini");
  if (!key) {
    console.error("[Gemini] API key not configured");
    throw new Error("Gemini API key not configured");
  }
  console.log("[Gemini] Client initialized with API key:", key.substring(0, 10) + "...");
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });
}

function getOpenAIClient(): OpenAI {
  const key = getApiKey("openai");
  if (!key) throw new Error("OpenAI API key not configured");
  return new OpenAI({ apiKey: key });
}

async function grokChat(messages: Array<{ role: string; content: string }>, model: string = "grok-beta"): Promise<string> {
  const grokKey = getApiKey("grok");
  if (!grokKey) throw new Error("Grok API key not configured");

  const grokResponse = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${grokKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!grokResponse.ok) {
    const errorText = await grokResponse.text();
    let detail = `Grok returned status ${grokResponse.status}`;
    try {
      const parsedErr = JSON.parse(errorText);
      if (parsedErr?.error?.message) detail = parsedErr.error.message;
    } catch {
      /* keep generic */
    }
    throw new Error(detail);
  }

  const data = await grokResponse.json();
  return data.choices?.[0]?.message?.content || "";
}

async function openaiChat(messages: Array<{ role: string; content: string }>, model: string = "gpt-4o"): Promise<string> {
  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model,
    messages,
    temperature: 0.7,
    max_tokens: 2048,
  });
  return response.choices[0]?.message?.content || "";
}

async function openaiGenerateImage(prompt: string, size: string = "1024x1024"): Promise<string> {
  const openai = getOpenAIClient();
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    size: size as "1024x1024" | "1792x1024" | "1024x1792",
    quality: "standard",
    n: 1,
  });
  return response.data[0]?.url || "";
}

async function openaiTextToSpeech(text: string, language: string = "en"): Promise<Buffer> {
  const openai = getOpenAIClient();
  
  // Map language codes to OpenAI TTS voices - using female voices for Siri-like experience
  const voiceMap: Record<string, string> = {
    'en': 'nova', // Female voice, clear and Siri-like
    'es': 'nova', // Female voice
    'fr': 'shimmer', // Female voice
    'de': 'nova', // Female voice
    'it': 'nova', // Female voice
    'pt': 'shimmer', // Female voice
    'ru': 'shimmer', // Female voice
    'ja': 'nova', // Female voice
    'ko': 'nova', // Female voice
    'zh': 'nova', // Female voice
    'ar': 'shimmer', // Female voice
    'hi': 'shimmer', // Female voice
    'rw': 'nova', // Kinyarwanda fallback - female voice
  };
  
  const voice = voiceMap[language.split('-')[0]] || 'nova';
  
  const response = await openai.audio.speech.create({
    model: "tts-1-hd", // Higher quality model for clearer voice
    voice: voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
    input: text,
    speed: 1.0,
  });
  
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// TTS Endpoint
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
  } catch (err: any) {
    console.error("[tts] text-to-speech failed:", err);
    const missingKey = String(err?.message || "").toLowerCase().includes("api key");
    res.status(missingKey ? 503 : 500).json({
      error: missingKey
        ? "Text-to-speech is temporarily unavailable. Please try again later."
        : "Text-to-speech is temporarily unavailable. Please try again.",
    });
  }
});

// Voice Agent Endpoint with Tool Calling
app.post("/api/voice-agent", async (req, res) => {
  try {
    const { command, language = "en", userName } = req.body || {};
    const cleanCommand = String(command || "").trim();
    
    // Validate command has meaningful content
    if (!cleanCommand || cleanCommand.length < 2) {
      res.status(400).json({ error: "Command is required and must be meaningful." });
      return;
    }

    // Build specialized voice agent system prompt with improved intent detection
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
User: "go to help page" → navigateTo("help") 
User: "search for Batman" → triggerSearch("Batman")
User: "play Inception" → playMovie("Inception")  
User: "delete what you wrote" → deleteLastAction()
User: "show me categories" → openCategories()
User: "open settings" → openSettings()

INCORRECT EXAMPLES (DO NOT DO):
User: "hello" → triggerSearch("hello") ❌ (Should ask what they want)
User: "that's cool" → navigateTo("cool") ❌ (Should acknowledge, not navigate)
User: "I like movies" → triggerSearch("I like movies") ❌ (Should acknowledge, not search)

Current user: ${userName || "User"}
Language: ${language}
Command: "${cleanCommand}"

Analyze the intent EXACTLY. If unclear, respond asking for clarification. If clear, respond with confirmation + TOOL_CALL.`;

    // Process with Grok for advanced reasoning
    const aiResponse = await grokChat([
      { role: "system", content: voiceSystemPrompt },
      { role: "user", content: cleanCommand }
    ]);

    // Extract tool calls from response
    const toolCalls: any[] = [];
    const lines = aiResponse.split('\n');
    let voiceResponse = "";
    
    for (const line of lines) {
      if (line.startsWith('TOOL_CALL:')) {
        try {
          const toolCall = JSON.parse(line.replace('TOOL_CALL:', '').trim());
          toolCalls.push(toolCall);
        } catch {
          // Invalid tool call, skip
        }
      } else if (line.trim()) {
        voiceResponse += line + " ";
      }
    }

    // Clean up voice response (remove markdown)
    voiceResponse = voiceResponse
      .replace(/[*_`#]/g, '')
      .replace(/\n/g, ' ')
      .trim();

    res.json({
      response: voiceResponse,
      action: toolCalls.length > 0 ? toolCalls[0] : null,
      language
    });

  } catch (err: any) {
    console.error("[voice-agent] processing failed:", err);
    const missingKey = String(err?.message || "").toLowerCase().includes("api key");
    res.status(missingKey ? 503 : 500).json({
      error: missingKey
        ? "Voice agent is temporarily unavailable. Please try again later."
        : "Voice agent is temporarily unavailable. Please try again.",
    });
  }
});

async function analyzeImageWithGemini(imageBase64: string, mimeType: string, userQuestion?: string): Promise<VisualAnalysis & { description: string }> {
  const questionBlock = userQuestion
    ? `\nThe user also asks: "${userQuestion}" — factor this into your genre/keyword choices.`
    : "";

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
            { inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64 } },
          ],
        },
      ],
    });

    const rawText = (response as any).text ?? (response as any).candidates?.[0]?.content?.parts?.[0]?.text ?? "";
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
        isKnownPoster: !!parsed.isKnownPoster,
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
        isKnownPoster: false,
      };
    }
  } catch (error) {
    console.error("[Gemini] Image analysis error:", error);
    throw error;
  }
}

async function groqChat(messages: Array<{ role: string; content: string }>, model?: string): Promise<string> {
  const groqKey = getApiKey("groq").replace(/\/$/, "");
  if (!groqKey) throw new Error("Groq API key not configured");

  const aiModel = model || db.data?.site_settings?.aiModel || "llama-3.3-70b-versatile";

  const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: aiModel,
      messages,
      temperature: 0.6,
      max_tokens: 2048,
    }),
  });

  if (!groqResponse.ok) {
    const errorText = await groqResponse.text();
    let detail = `Groq returned status ${groqResponse.status}`;
    try {
      const parsedErr = JSON.parse(errorText);
      if (parsedErr?.error?.message) detail = parsedErr.error.message;
    } catch {
      /* keep generic */
    }
    throw new Error(detail);
  }

  const groqData = await groqResponse.json();
  return groqData.choices?.[0]?.message?.content || "I couldn't formulate an answer right now.";
}

async function geminiChat(messages: Array<{ role: string; content: string }>): Promise<string> {
  const ai = getGeminiClient();
  const system = messages.find((m) => m.role === "system")?.content || "";
  const turns = messages.filter((m) => m.role !== "system");
  const response = await ai.models.generateContent({
    model: db.data?.site_settings?.aiPrimaryModel || "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${system}\n\nCONVERSATION:\n${turns
              .map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`)
              .join("\n")}`,
          },
        ],
      },
    ],
  });
  const text = (response as any).text ?? (response as any).candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text.trim()) throw new Error("Gemini returned an empty response");
  return text.trim();
}

async function routedAssistantChat(messages: Array<{ role: string; content: string }>, groqModel?: string): Promise<{ text: string; engine: "openai" | "grok" | "gemini" | "groq" }> {
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

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(String(text || "").length / 4));
}

function saveAiChatLog(user: ReturnType<typeof getUserById> | undefined, role: "user" | "assistant", message: string, engine: "openai" | "grok" | "gemini" | "groq" | "system") {
  db.data.ai_chat_history.push({
    id: crypto.randomUUID(),
    user_id: user?.id || null,
    user_name: user?.name || null,
    role,
    message: String(message || "").slice(0, 12000),
    engine,
    tokens_estimate: estimateTokens(message),
    created_at: new Date().toISOString(),
  });
  db.data.ai_chat_history = db.data.ai_chat_history.slice(-2000);
  db.save();
}

function resolveSessionUser(req: express.Request) {
  const userId = getOptionalUserId(req as AuthedRequest);
  return userId ? getUserById(userId) : undefined;
}

function buildAssistantSystemPrompt(opts: {
  movieContext?: any;
  visualContext?: any;
  sessionUser?: ReturnType<typeof getUserById>;
}): string {
  const settings = db.data?.site_settings || {};
  let systemPrompt =
    'You are "All Kiki\'s", the official Cinemax AI Agent — expert, friendly, and deeply knowledgeable about every feature on the Cinemax website.\n\n';
  systemPrompt += buildCinemaxKnowledgeBase();
  systemPrompt += "\n\nRESPONSE STYLE: Cinematic, engaging, concise. Use bullets or bold for lists. Match the user's language exactly (including fluent Kinyarwanda).\n";
  systemPrompt +=
    "SITE ACTIONS: When the user explicitly requests a settings change or navigation, end with ONE ```action\\n{JSON}\\n``` block. Valid types: update_name, toggle_autoplay_next, toggle_autoplay_trailers, set_subtitle_language, set_default_quality, toggle_mature_lock, clear_watch_history, navigate (home|movies|tv|mylist|watchlist|history|favorites|downloads|profile|help|shorts|gens), search (query), play_movie (id, title), play_tv (id, title, season, episode), add_to_watchlist (id), remove_from_watchlist (id), add_to_favorites (id), remove_from_favorites (id), set_profile_image (image_url), generate_image (prompt), open_help_desk, submit_help_ticket (subject, message), download_movie (id, title), manage_downloads, view_download_history. For complex multi-step operations, break them into sequential actions. Only one action block when clearly requested.\n";
  systemPrompt +=
    "LANGUAGE DETECTION: Always detect the user's language from their input and respond in that exact same language. If the user speaks Kinyarwanda, respond in fluent Kinyarwanda. If they speak English, respond in English. If they speak French, respond in French, etc. Never translate unless explicitly requested.\n";
  systemPrompt +=
    "RECOMMENDATIONS: Ask at most one short clarifying question, and only when the request is genuinely too broad to act on (e.g. \"recommend something good\" with no other signal). Otherwise commit to a real answer — a person who says \"something like Inception\" or \"a good 90s action movie\" has already told you enough to work with. When you suggest titles, name 3-5 specific ones, each with a one-line reason it fits (mood, genre, actor, director, or similarity to what they mentioned), then end with a `search` action block using the best single query so the site shows real, playable results — never claim a title is available on Cinemax unless it plausibly exists in the TMDB catalog. If they ask about a genre, actor, or theme rather than asking for a single pick, you can list several relevant titles instead of just one.\n" +
    "CONVERSATION MEMORY: Treat everything earlier in this chat as still true — remember what titles, genres, or preferences the user already mentioned and build on them instead of re-asking. If they say \"something else like that\" or \"not that one\", refer back to what you already suggested.\n";

  if (settings.aiSystemPromptExtra) {
    systemPrompt += `\n\nADMIN CUSTOM INSTRUCTIONS:\n${settings.aiSystemPromptExtra}`;
  }
  const memories = (db.data?.ai_memory || []).filter((m) => m.enabled).slice(-30);
  if (memories.length) {
    systemPrompt += `\n\nAPPROVED AI MEMORY BANK:\n${memories.map((m) => `- ${m.title}: ${m.content}`).join("\n")}`;
  }

  const u = opts.sessionUser;
  if (u) {
    systemPrompt += `\n\n[SIGNED-IN USER: ${u.name} (${u.email}), role: ${u.role}, subscription: ${u.subscription || "Free"}]`;
    if (u.role === "admin") {
      systemPrompt += `\nThis user is a CINEMAX ADMINISTRATOR with access to the Admin Panel. Address them professionally. Help with site management, content curation, Help Desk inquiries, broadcasts, and admin workflows. Never expose secrets.`;
      if (isAdminEmail(u.email)) {
        systemPrompt += `\nThis is the PRIMARY platform owner (allkikisweb@gmail.com) — highest priority for admin guidance.`;
      }
    }
    try {
      const prefs = JSON.parse(u.preferences || "{}");
      systemPrompt += `\nUser preferences snapshot: appLanguage=${prefs.appLanguage || "English"}, autoplayNext=${prefs.autoplayNext}, defaultQuality=${prefs.defaultQuality}, subtitleLanguage=${prefs.subtitleLanguage}.`;
    } catch {
      /* ignore */
    }
  } else {
    systemPrompt += "\n\n[VISITOR: Not signed in — guest browsing or anonymous. Remind them to sign in for downloads, My List, and profile features when relevant.]";
  }

  if (opts.visualContext) {
    systemPrompt += `\n\n[VISUAL SEARCH CONTEXT — user uploaded an image]\nImage analysis: ${opts.visualContext.description}`;
    if (opts.visualContext.analysis) {
      systemPrompt += `\nGenres: ${(opts.visualContext.analysis.genres || []).join(", ")}`;
      systemPrompt += `\nMood: ${(opts.visualContext.analysis.moodTags || []).join(", ")}`;
    }
    if (opts.visualContext.matches?.length) {
      systemPrompt += `\nMatched titles:\n${opts.visualContext.matches
        .map((m: any, i: number) => `${i + 1}. ${m.title} (TMDB #${m.id})${m.rating ? ` — ${m.rating}/10` : ""}`)
        .join("\n")}`;
    }
    systemPrompt += "\nAnswer follow-up questions about these matches with specific references to the list above.";
  }

  if (opts.movieContext) {
    systemPrompt += `\n\n[CURRENT TITLE: "${opts.movieContext.title || opts.movieContext.name || "Unknown"}"]`;
    if (opts.movieContext.overview) systemPrompt += `\nOverview: ${opts.movieContext.overview}`;
  }

  return systemPrompt;
}

// ---------------------------------------------------------------------------
// STARTUP — connect to Mongo, load state, seed admin, then listen.
// ---------------------------------------------------------------------------
const PORT = Number(process.env.PORT) || 5000;

async function start() {
  await connectDB();
  await initDb();
  try {
    seedAdminUser();
  } catch (err) {
    console.error("[startup] seedAdminUser failed:", err);
  }
  app.listen(PORT, () => {
    console.log(`🚀 Cinemax Backend listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("[startup] Fatal error:", err);
  process.exit(1);
});

async function shutdown(signal: string) {
  console.log(`[shutdown] ${signal} received — flushing DB…`);
  try {
    await flushDb();
  } catch (err) {
    console.error("[shutdown] flush failed:", err);
  }
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
