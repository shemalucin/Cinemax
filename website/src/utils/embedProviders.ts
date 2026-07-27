/**
 * Full-movie embed providers.
 *
 * Given a TMDB id (movie or TV episode), each provider returns a ready-to-load
 * iframe URL. The Player picks the currently selected provider; if it fails
 * or the user prefers a different source, they can switch via the picker
 * strip beneath the video without leaving the page.
 *
 * All URLs are pure iframe embeds keyed by TMDB id, so integrations "just
 * work" for movies and TV episodes as long as we have the TMDB id, season,
 * and episode numbers.
 */

export type MediaKind = "movie" | "tv";

export interface EmbedProvider {
  id: string;
  label: string;
  hint: string;
  buildMovieUrl: (tmdbId: number | string) => string;
  buildEpisodeUrl: (tmdbId: number | string, season: number, episode: number) => string;
}

export const EMBED_PROVIDERS: EmbedProvider[] = [
  {
    id: "vidsrc-sbs",
    label: "P1",
    hint: "vidsrc.sbs",
    buildMovieUrl: (id) => `https://vidsrc.sbs/embed/movie/${id}`,
    buildEpisodeUrl: (id, s, e) => `https://vidsrc.sbs/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: "vidcore",
    label: "P1",
    hint: "vidcore.org",
    buildMovieUrl: (id) => `https://vidcore.org/embed/movie/${id}`,
    buildEpisodeUrl: (id, s, e) => `https://vidcore.org/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: "vidsrc-to",
    label: "P1",
    hint: "vidsrc.to",
    buildMovieUrl: (id) => `https://vidsrc.to/embed/movie/${id}`,
    buildEpisodeUrl: (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: "2embed-cc",
    label: "P1",
    hint: "2embed.cc",
    buildMovieUrl: (id) => `https://www.2embed.cc/embed/${id}`,
    buildEpisodeUrl: (id, s, e) => `https://www.2embed.cc/embedtv/${id}?s=${s}&e=${e}`,
  },
  {
    id: "2embed-skin",
    label: "P1",
    hint: "2embed.skin",
    buildMovieUrl: (id) => `https://www.2embed.skin/embed/${id}`,
    buildEpisodeUrl: (id, s, e) => `https://www.2embed.skin/embedtv/${id}?s=${s}&e=${e}`,
  },
];

export const DEFAULT_EMBED_PROVIDER_ID = EMBED_PROVIDERS[0].id;

export function getEmbedProvider(providerId?: string | null): EmbedProvider {
  if (!providerId) return EMBED_PROVIDERS[0];
  return EMBED_PROVIDERS.find((p) => p.id === providerId) ?? EMBED_PROVIDERS[0];
}

export function buildFullMovieEmbedUrl(
  tmdbId: number | string,
  kind: MediaKind,
  opts: { season?: number; episode?: number; providerId?: string | null } = {}
): string {
  const provider = getEmbedProvider(opts.providerId);
  if (kind === "tv") {
    return provider.buildEpisodeUrl(tmdbId, opts.season ?? 1, opts.episode ?? 1);
  }
  return provider.buildMovieUrl(tmdbId);
}

/** iframe attributes shared across embed + trailer players so trailers play
 *  beautifully in fullscreen and embeds get autoplay + PiP when supported. */
export const EMBED_IFRAME_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share";
