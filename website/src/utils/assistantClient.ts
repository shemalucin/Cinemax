import { VisualContextPayload } from "./visualSearch";

export interface AssistantUserContext {
  name?: string;
  email?: string;
  role?: string;
  subscription?: string;
  isGuest?: boolean;
  preferences?: Record<string, unknown>;
}

export interface AssistantMovieContext {
  id?: number;
  title?: string;
  name?: string;
  overview?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  genres?: Array<{ name: string }> | string;
}

export interface AgentAction {
  type: string;
  params?: Record<string, any>;
}

export async function askAssistant(params: {
  message: string;
  history?: Array<{ role: string; text: string }>;
  movieContext?: AssistantMovieContext;
  visualContext?: VisualContextPayload | null;
}): Promise<{ text: string; action?: AgentAction }> {
  const res = await fetch("/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      message: params.message,
      history: params.history || [],
      movieContext: params.movieContext,
      visualContext: params.visualContext,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Assistant error (${res.status})`);
  
  const action = extractAction(data.text || "");
  return { 
    text: stripActionBlocks(data.text || ""), 
    action 
  };
}

export async function generateImage(prompt: string, size: string = "1024x1024"): Promise<{ imageUrl: string; prompt: string }> {
  const res = await fetch("/api/agent/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ prompt, size }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Image generation error (${res.status})`);
  return { imageUrl: data.imageUrl, prompt: data.prompt };
}

/** Strip ```action blocks for widgets that don't execute actions. */
export function stripActionBlocks(text: string): string {
  return text.replace(/```action\s*[\s\S]*?```/g, "").trim();
}

/** Extract action block from AI response */
export function extractAction(text: string): AgentAction | undefined {
  const match = text.match(/```action\s*([\s\S]*?)```/);
  if (!match) return undefined;
  
  try {
    const action = JSON.parse(match[1].trim());
    return action;
  } catch {
    return undefined;
  }
}
