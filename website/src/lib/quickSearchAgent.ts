/**
 * Scout — the search bar's voice agent.
 *
 * This intentionally replaces the old conversational agent rather than
 * extending it: different personality (short, task-focused, no filler
 * chatter), a different backend route for its intelligence (never
 * `/api/assistant`, which is what the "All Kiki's" chat assistant uses —
 * Scout has its own brain), and a deliberately narrow job description.
 * Scout does exactly two things: search, and play a result it just found.
 * Nothing else. Anything outside that, it says so and stops.
 */

export interface ScoutResponse {
  /** What Scout says out loud AND shows as a caption — always both. */
  text: string;
  /** The only two actions Scout is allowed to take. */
  intent: "search" | "play" | "decline";
  query?: string;
  title?: string;
}

const DECLINE_TEXT =
  "That's outside what I handle here — I only search and play titles. Try the chat assistant for anything else.";

/**
 * Very small local fallback used only if the backend intent route can't be
 * reached (e.g. it hasn't been deployed yet). Deliberately dumb — it's a
 * safety net, not a second brain. Real understanding comes from the backend
 * call in `interpret()` below.
 */
function localFallbackIntent(transcript: string): ScoutResponse {
  const cleaned = transcript.trim();
  const lower = cleaned.toLowerCase();

  const playMatch = lower.match(/^(?:play|watch|open|start)\s+(.+)/);
  if (playMatch && playMatch[1]) {
    const title = playMatch[1].replace(/\bfor me\b|\bplease\b/g, "").trim();
    return { text: `On it — pulling up ${title}.`, intent: "play", title };
  }

  const searchMatch = lower.match(/^(?:search|find|look up|look for)\s+(?:for\s+)?(.+)/);
  const query = searchMatch?.[1]?.trim() || cleaned;
  if (query.length < 2) {
    return { text: "Say a title or a few keywords and I'll search for it.", intent: "decline" };
  }
  return { text: `Searching for ${query}.`, intent: "search", query };
}

/**
 * Scout's brain lives server-side at /api/voice-search-agent — a route of
 * its own, separate from /api/assistant and from the old /api/voice-agent.
 * If that route hasn't been added to the backend yet, this quietly drops to
 * the local fallback above so the feature still works end to end.
 */
async function interpret(transcript: string): Promise<ScoutResponse> {
  try {
    const res = await fetch("/api/voice-search-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ transcript, scope: ["search", "play"] }),
    });
    if (!res.ok) throw new Error(`voice-search-agent ${res.status}`);
    const data = await res.json();
    if (data && (data.intent === "search" || data.intent === "play" || data.intent === "decline")) {
      return {
        text: typeof data.text === "string" && data.text.trim() ? data.text : DECLINE_TEXT,
        intent: data.intent,
        query: data.query,
        title: data.title,
      };
    }
    return { text: DECLINE_TEXT, intent: "decline" };
  } catch {
    return localFallbackIntent(transcript);
  }
}

type TranscriptCallback = (text: string) => void;
type ResponseCallback = (response: ScoutResponse) => void;

export class QuickSearchAgent {
  private recognition: any = null;
  private listening = false;
  private onInterim?: TranscriptCallback;
  private onFinal?: TranscriptCallback;
  private onReply?: ResponseCallback;
  private audio: HTMLAudioElement | null = null;

  isSupported(): boolean {
    return typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);
  }

  isActive(): boolean {
    return this.listening;
  }

  onInterimTranscript(cb: TranscriptCallback) {
    this.onInterim = cb;
  }

  onFinalTranscript(cb: TranscriptCallback) {
    this.onFinal = cb;
  }

  onReplyReady(cb: ResponseCallback) {
    this.onReply = cb;
  }

  start(): boolean {
    if (!this.isSupported()) return false;
    if (this.listening) return true;

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      this.listening = true;
    };

    recognition.onresult = async (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += chunk;
        else interim += chunk;
      }
      if (interim) this.onInterim?.(interim);
      if (final.trim()) {
        this.onFinal?.(final.trim());
        const response = await interpret(final.trim());
        this.onReply?.(response);
        await this.speak(response.text);
      }
    };

    recognition.onerror = () => {
      this.listening = false;
    };

    recognition.onend = () => {
      this.listening = false;
    };

    this.recognition = recognition;
    try {
      recognition.start();
      return true;
    } catch {
      return false;
    }
  }

  stop() {
    this.listening = false;
    try {
      this.recognition?.stop();
    } catch {
      /* already stopped */
    }
    this.audio?.pause();
  }

  /** Speaks via TTS, but the caption is always shown by the caller regardless — this never blocks the text-out requirement. */
  async speak(text: string): Promise<void> {
    if (!text.trim()) return;
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: text.replace(/[*_`]/g, ""), language: "en-US" }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (!this.audio) this.audio = new Audio();
      this.audio.pause();
      this.audio.src = url;
      await this.audio.play().catch(() => {});
      this.audio.onended = () => URL.revokeObjectURL(url);
    } catch {
      // Silent — the on-screen caption already carries the message.
    }
  }

  destroy() {
    this.stop();
    this.recognition = null;
    this.audio = null;
  }
}

let singleton: QuickSearchAgent | null = null;
export function getQuickSearchAgent(): QuickSearchAgent {
  if (!singleton) singleton = new QuickSearchAgent();
  return singleton;
}
