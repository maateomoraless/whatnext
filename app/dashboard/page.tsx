"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { BottomNav } from "@/components/BottomNav";
import {
  bumpMovieStreak,
  claimPendingStreakMilestoneOnVisit,
  claimStreakMilestoneAfterBump,
  readEffectiveMovieStreak
} from "@/lib/movieStreak";
import { logUserActivity, syncProfileFromLocal } from "@/lib/social";
import { supabase } from "@/lib/supabase";
import {
  TmdbDetailSheet,
  TMDB_API_KEY,
  collectProviderNames,
  fetchJson,
  ratingStorageKey,
  watchlistId,
  type MediaType,
  type MovieDetail,
  type MultiSearchResult,
  type SheetState,
  type TvDetail,
  type WatchProvidersResponse
} from "@/components/TmdbDetailSheet";
import { MotionButton } from "@/components/ui/MotionButton";
import { MotionLink } from "@/components/ui/MotionLink";
import { SkeletonMovieCard, SkeletonShimmer } from "@/components/ui/SkeletonShimmer";

type MatchItem = {
  id: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  match: number;
  platform: string;
  platformColor: string;
  gradient: [string, string];
  durationMinutes: number;
  genre: string;
  posterPath?: string;
  genreIds?: number[];
  popularity?: number;
  voteAverage?: number;
  releaseDate?: string;
  originalLanguage?: string;
};

type RatingValue = {
  rating: number;
  unseen: boolean;
  /** Géneros TMDB de la película (valoraciones desde el dashboard). */
  genreIds?: number[];
  /** Título mostrado en TMDB al valorar. */
  title?: string;
};

type Ratings = Record<string, RatingValue>;

type GustosSelection = Record<string, string[]>;

type TmdbDiscoverResponse = {
  results?: Array<{
    id: number;
    title?: string;
    name?: string;
    poster_path: string | null;
    overview?: string;
    vote_average: number;
    genre_ids?: number[];
    popularity?: number;
    release_date?: string;
    /** Presente en discover/movie. */
    original_language?: string;
  }>;
};

type TmdbWatchProvidersResponse = {
  results?: { ES?: { flatrate?: Array<{ provider_name: string; provider_id: number }> } };
};

/** Datos de TMDB necesarios para la puntuación de match. */
type PeliculaMatchInput = {
  genreIds: number[];
  popularity: number;
  voteAverage: number;
  releaseDate?: string;
  originalLanguage?: string;
};

/** Filtros adicionales para `fetchMoviesForUser` (runtime, género forzado, fechas). */
type DiscoverExtraFilters = {
  forcedGenreIds?: number[];
  withRuntimeLte?: number;
  withRuntimeGte?: number;
  primaryReleaseDateGte?: string;
  /** No aplicar with_genres desde gustos (p. ej. solo género forzado). */
  onlyForcedGenres?: boolean;
  skipOriginalLanguage?: boolean;
  skipEpoca?: boolean;
  /** No aplicar with_genres (ni forzados ni desde gustos). */
  skipGenres?: boolean;
  /** TMDB: coma = AND, barra = OR. Por defecto OR para mezclar gustos y temáticas. */
  joinGenresWithOr?: boolean;
};

const TMDB_FALLBACK_API_KEY = "2de8d3ecfb29fc4efda4d7fa09d0920e";

function getTmdbApiKey() {
  const key = process.env.NEXT_PUBLIC_TMDB_API_KEY?.trim();
  return key || TMDB_FALLBACK_API_KEY;
}

async function fetchTmdbJson<T>(
  label: string,
  url: string,
  signal?: AbortSignal
): Promise<{ ok: true; data: T; status: number } | { ok: false; status: number; error?: unknown }> {
  try {
    const safeUrl = url.replace(/api_key=[^&]+/, "api_key=***");
    console.log(`[TMDB] ${label} fetch →`, safeUrl);
    const response = await fetch(url, { signal });
    const status = response.status;
    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    console.log(`[TMDB] ${label} response ←`, status, parsed);
    if (!response.ok) {
      console.error(`[TMDB] ${label} HTTP error`, status, parsed);
      return { ok: false, status, error: parsed };
    }
    return { ok: true, data: parsed as T, status };
  } catch (err) {
    console.error(`[TMDB] ${label} fetch exception`, err);
    return { ok: false, status: 0, error: err };
  }
}

const PROVIDER_ID_BY_PLATFORM: Record<string, number> = {
  Netflix: 8,
  "Disney+": 337,
  Max: 1899,
  Prime: 119,
  "Apple TV+": 350,
  Filmin: 55
};

const PROVIDER_COLOR_BY_NAME: Record<string, string> = {
  Netflix: "#E50914",
  "Disney+": "#0063e5",
  Max: "#5822B4",
  Prime: "#00A8E0",
  "Amazon Prime Video": "#00A8E0",
  "Apple TV+": "#555555",
  Filmin: "#e8175d",
  "No disponible": "#737373"
};

const MOVIE_META_BY_ID: Record<string, { title: string; genre: string }> = {
  "el-padrino": { title: "El Padrino", genre: "Crimen" },
  "pulp-fiction": { title: "Pulp Fiction", genre: "Thriller" },
  inception: { title: "Inception", genre: "Sci-fi" },
  interstellar: { title: "Interstellar", genre: "Sci-fi" },
  "the-dark-knight": { title: "The Dark Knight", genre: "Acción" },
  "forrest-gump": { title: "Forrest Gump", genre: "Drama" },
  titanic: { title: "Titanic", genre: "Romance" },
  matrix: { title: "Matrix", genre: "Sci-fi" },
  gladiator: { title: "Gladiator", genre: "Acción" },
  oppenheimer: { title: "Oppenheimer", genre: "Drama" }
};

const TMDB_ID_BY_ONBOARDING: Record<string, number> = {
  "el-padrino": 238,
  "pulp-fiction": 680,
  inception: 27205,
  interstellar: 157336,
  "the-dark-knight": 155,
  "forrest-gump": 13,
  titanic: 597,
  matrix: 603,
  gladiator: 98,
  oppenheimer: 872585
};

const GENRE_IDS_BY_NAME: Record<string, number> = {
  Acción: 28,
  Drama: 18,
  Comedia: 35,
  Terror: 27,
  "Sci-fi": 878,
  Documental: 99,
  Thriller: 53,
  Animación: 16,
  Romance: 10749,
  Fantasía: 14
};

/** Géneros TMDB por etiqueta del test de valoraciones (etiqueta → id). */
const GENRE_LABEL_TO_TMDB_ID: Record<string, number> = {
  ...GENRE_IDS_BY_NAME,
  Crimen: 80
};

/** Época fija (sin "Lo más reciente", que se calcula a 2 años desde hoy). */
const EPOCA_FILTERS: Record<string, { gte?: string; lte?: string }> = {
  Clásicos: { lte: "1979-12-31" },
  "2000s": { gte: "2000-01-01", lte: "2009-12-31" },
  "Últimos 5 años": { gte: "2020-01-01" }
};

const LANGUAGE_FILTERS: Record<string, string[]> = {
  /** Incluye `en`: gran parte del catálogo en España llega doblada/subtitulada. */
  Español: ["es", "en"],
  Inglés: ["en"],
  "Cine europeo": ["fr", "de", "it", "pt"],
  Asiático: ["ko", "ja", "zh"]
};

/** Temática onboarding → IDs de género TMDB (OR al combinar). */
const TEMATICA_GENRE_IDS: Record<string, number[]> = {
  "Mafia y crimen": [80],
  Superhéroes: [28],
  "Política y poder": [36],
  "Guerras e historia": [36, 10752],
  Espías: [53]
};

const DASHBOARD_RECS_OK_MS_KEY = "whatnext_dashboard_recs_ok_ms";

function matchItemToMultiSearch(item: MatchItem): MultiSearchResult {
  return {
    id: item.tmdbId,
    media_type: item.mediaType,
    title: item.title,
    name: item.title,
    poster_path: item.posterPath ?? null,
    release_date: item.releaseDate,
    genre_ids: item.genreIds ?? []
  };
}

function matchItemToPelicula(item: MatchItem): PeliculaMatchInput {
  return {
    genreIds: item.genreIds ?? [],
    popularity: item.popularity ?? 0,
    voteAverage: item.voteAverage ?? 0,
    releaseDate: item.releaseDate,
    originalLanguage: item.originalLanguage
  };
}

function fechaEnRangoEpoca(isoDate: string, range: { gte?: string; lte?: string }): boolean {
  const d = isoDate.slice(0, 10);
  if (range.gte && d < range.gte) {
    return false;
  }
  if (range.lte && d > range.lte) {
    return false;
  }
  return true;
}

/** `null` = sin filtro de proveedor (todas las plataformas en España). */
function buildWatchProvidersPipe(plataformasLabels: string[]): string | null {
  const ids = plataformasLabels
    .map((p) => PROVIDER_ID_BY_PLATFORM[p])
    .filter((id): id is number => typeof id === "number");
  if (ids.length === 0) {
    return null;
  }
  return ids.join("|");
}

/** Películas excluidas: "Ya la vi" (`unseen`), cualquier valoración, o pendientes con rating. */
function getExcludedTmdbIds(valoraciones: Ratings): Set<number> {
  const out = new Set<number>();
  Object.entries(valoraciones).forEach(([key, v]) => {
    if (!v) {
      return;
    }
    const hide =
      v.unseen === true || (typeof v.rating === "number" && v.rating > 0);
    if (!hide) {
      return;
    }
    if (key.startsWith("tmdb-")) {
      const n = Number(key.slice(5));
      if (Number.isFinite(n)) {
        out.add(n);
      }
      return;
    }
    const tid = TMDB_ID_BY_ONBOARDING[key];
    if (tid) {
      out.add(tid);
    }
  });
  return out;
}

function collectGenreIdsFromGustos(gustos: GustosSelection): number[] {
  const ids = new Set<number>();
  for (const name of gustos.generos ?? []) {
    const id = GENRE_IDS_BY_NAME[name];
    if (id) {
      ids.add(id);
    }
  }
  for (const label of gustos.tematica ?? []) {
    const extra = TEMATICA_GENRE_IDS[label];
    if (extra) {
      extra.forEach((id) => ids.add(id));
    }
  }
  return Array.from(ids);
}

function isoDateYearsAgo(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

function mergeEpocaPrimaryReleaseParams(gustos: GustosSelection): { gte?: string; lte?: string } {
  const epocas = gustos.epoca ?? [];
  if (epocas.length === 0) {
    return {};
  }
  let gte: string | undefined;
  let lte: string | undefined;
  for (const ep of epocas) {
    if (ep === "Lo más reciente") {
      const rGte = isoDateYearsAgo(2);
      gte = !gte ? rGte : rGte > gte ? rGte : gte;
      continue;
    }
    const r = EPOCA_FILTERS[ep];
    if (!r) {
      continue;
    }
    if (r.gte) {
      gte = !gte ? r.gte : r.gte > gte ? r.gte : gte;
    }
    if (r.lte) {
      lte = !lte ? r.lte : r.lte < lte ? r.lte : lte;
    }
  }
  return { gte, lte };
}

function originalLanguageDiscoverValue(gustos: GustosSelection): string | null {
  const pref = gustos.idioma?.[0];
  if (!pref || pref === "Me da igual") {
    return null;
  }
  const langs = LANGUAGE_FILTERS[pref];
  if (!langs?.length) {
    return null;
  }
  return langs.join("|");
}

async function fetchRatedBestMovieGenresAndTitle(
  ratedKey: string,
  apiKey: string,
  signal: AbortSignal
): Promise<{ genreIds: number[]; title: string | null }> {
  let tmdbMovieId: number | null = null;
  if (ratedKey.startsWith("tmdb-")) {
    const n = Number(ratedKey.slice(5));
    tmdbMovieId = Number.isFinite(n) ? n : null;
  } else {
    tmdbMovieId = TMDB_ID_BY_ONBOARDING[ratedKey] ?? null;
  }
  if (tmdbMovieId == null) {
    return { genreIds: [], title: null };
  }
  const url = `https://api.themoviedb.org/3/movie/${tmdbMovieId}?api_key=${apiKey}&language=es-ES`;
  const res = await fetchTmdbJson<{ genres?: Array<{ id: number }>; title?: string }>(
    `movie/${tmdbMovieId} detail`,
    url,
    signal
  );
  if (!res.ok) {
    return { genreIds: [], title: null };
  }
  const genreIds = (res.data.genres ?? [])
    .map((g) => g.id)
    .filter((id): id is number => typeof id === "number" && Number.isFinite(id));
  return {
    genreIds,
    title: typeof res.data.title === "string" ? res.data.title : null
  };
}

function rawDiscoverResultsToMatchItems(
  results: NonNullable<TmdbDiscoverResponse["results"]>,
  idPrefix: string,
  startIndex: number
): MatchItem[] {
  return results.map((movie, i) => ({
    id: `${idPrefix}-${movie.id}`,
    tmdbId: movie.id,
    mediaType: "movie" as const,
    title: movie.title ?? movie.name ?? "Sin título",
    match: 0,
    platform: "No disponible",
    platformColor: "#737373",
    gradient: (startIndex + i) % 2 === 0 ? ["#1f1f1f", "#0b0b0b"] : ["#2a241a", "#0f0d09"],
    durationMinutes: 110,
    genre: "Película",
    posterPath: movie.poster_path ?? undefined,
    genreIds: movie.genre_ids ?? [],
    popularity: movie.popularity ?? 0,
    voteAverage: movie.vote_average ?? 0,
    releaseDate: movie.release_date,
    originalLanguage: movie.original_language
  }));
}

function normalizeStreamingProviderName(name: string): string {
  return name === "Amazon Prime Video" ? "Prime" : name;
}

/** Si `allowedLabels` tiene entradas, solo se acepta un proveedor de streaming de esa lista (ES flatrate). */
async function enrichEsFlatrateOnly(
  items: MatchItem[],
  apiKey: string,
  allowedLabels: string[] | null
): Promise<MatchItem[]> {
  const allowed =
    allowedLabels && allowedLabels.length > 0 ? new Set(allowedLabels) : null;

  const enriched = await Promise.all(
    items.map(async (item) => {
      const url = `https://api.themoviedb.org/3/movie/${item.tmdbId}/watch/providers?api_key=${apiKey}`;
      try {
        const res = await fetchTmdbJson<TmdbWatchProvidersResponse>(`watch/providers ${item.tmdbId}`, url);
        if (!res.ok) {
          return null;
        }
        const flat = res.data.results?.ES?.flatrate;
        if (!flat?.length) {
          return null;
        }
        let chosen: { provider_name: string } | undefined;
        if (allowed) {
          chosen = flat.find((p) => allowed.has(normalizeStreamingProviderName(p.provider_name)));
        } else {
          chosen = flat[0];
        }
        if (!chosen) {
          return null;
        }
        const name = chosen.provider_name;
        const normalized = normalizeStreamingProviderName(name);
        const color = PROVIDER_COLOR_BY_NAME[normalized] ?? PROVIDER_COLOR_BY_NAME[name] ?? "#737373";
        return {
          ...item,
          platform: normalized,
          platformColor: color
        };
      } catch {
        return null;
      }
    })
  );
  return enriched.filter((x): x is MatchItem => x != null);
}

async function fetchMoviesForUser(
  gustos: GustosSelection,
  valoraciones: Ratings,
  plataformas: string[],
  filtrosExtra: DiscoverExtraFilters,
  apiKey: string,
  signal: AbortSignal,
  opts: { targetCount: number; idPrefix: string }
): Promise<MatchItem[]> {
  const excluded = getExcludedTmdbIds(valoraciones);
  const providerPipe = buildWatchProvidersPipe(plataformas);
  const restrictPlatforms = plataformas.length > 0;

  let genrePart: number[] = [];
  if (!filtrosExtra.skipGenres) {
    if (filtrosExtra.forcedGenreIds?.length) {
      genrePart = [...filtrosExtra.forcedGenreIds];
      if (!filtrosExtra.onlyForcedGenres) {
        collectGenreIdsFromGustos(gustos).forEach((id) => genrePart.push(id));
        genrePart = Array.from(new Set(genrePart));
      }
    } else if (!filtrosExtra.onlyForcedGenres) {
      genrePart = collectGenreIdsFromGustos(gustos);
    }
  }

  const epoca = filtrosExtra.skipEpoca ? {} : mergeEpocaPrimaryReleaseParams(gustos);
  const lang = filtrosExtra.skipOriginalLanguage ? null : originalLanguageDiscoverValue(gustos);
  const genreJoiner = filtrosExtra.joinGenresWithOr === false ? "," : "|";

  const collected: MatchItem[] = [];
  let page = 1;
  const maxPages = 10;

  while (collected.length < opts.targetCount && page <= maxPages) {
    if (signal.aborted) {
      break;
    }
    const params = new URLSearchParams({
      api_key: apiKey,
      language: "es-ES",
      watch_region: "ES",
      sort_by: "vote_average.desc",
      page: String(page),
      "vote_count.gte": "100"
    });
    if (providerPipe) {
      params.set("with_watch_providers", providerPipe);
    }

    if (genrePart.length > 0) {
      params.set("with_genres", genrePart.join(genreJoiner));
    }
    if (lang) {
      params.set("with_original_language", lang);
    }
    if (epoca.gte) {
      params.set("primary_release_date.gte", epoca.gte);
    }
    if (epoca.lte) {
      params.set("primary_release_date.lte", epoca.lte);
    }
    if (filtrosExtra.primaryReleaseDateGte) {
      params.set("primary_release_date.gte", filtrosExtra.primaryReleaseDateGte);
    }
    if (filtrosExtra.withRuntimeLte != null) {
      params.set("with_runtime.lte", String(filtrosExtra.withRuntimeLte));
    }
    if (filtrosExtra.withRuntimeGte != null) {
      params.set("with_runtime.gte", String(filtrosExtra.withRuntimeGte));
    }

    const url = `https://api.themoviedb.org/3/discover/movie?${params.toString()}`;
    const res = await fetchTmdbJson<TmdbDiscoverResponse>(
      `discover/movie ${opts.idPrefix} p${page}`,
      url,
      signal
    );
    if (!res.ok) {
      break;
    }
    const results = res.data.results ?? [];
    const candidates = results.filter(
      (m) =>
        m.poster_path != null &&
        m.poster_path !== "" &&
        !excluded.has(m.id)
    );
    const mapped = rawDiscoverResultsToMatchItems(candidates, opts.idPrefix, collected.length);
    const withProviders = await enrichEsFlatrateOnly(
      mapped,
      apiKey,
      restrictPlatforms ? plataformas : null
    );
    for (const it of withProviders) {
      if (collected.some((c) => c.tmdbId === it.tmdbId)) {
        continue;
      }
      collected.push(it);
      if (collected.length >= opts.targetCount) {
        break;
      }
    }
    page += 1;
  }

  return collected.slice(0, opts.targetCount);
}

async function fetchPopularOnPlatformsDiscover(
  valoraciones: Ratings,
  plataformas: string[],
  apiKey: string,
  signal: AbortSignal,
  targetCount: number,
  idPrefix: string
): Promise<MatchItem[]> {
  const excluded = getExcludedTmdbIds(valoraciones);
  const providerPipe = buildWatchProvidersPipe(plataformas);
  const restrictPlatforms = plataformas.length > 0;
  const collected: MatchItem[] = [];
  let page = 1;

  while (collected.length < targetCount && page <= 15) {
    if (signal.aborted) {
      break;
    }
    const params = new URLSearchParams({
      api_key: apiKey,
      language: "es-ES",
      watch_region: "ES",
      sort_by: "popularity.desc",
      page: String(page)
    });
    if (providerPipe) {
      params.set("with_watch_providers", providerPipe);
    }
    const url = `https://api.themoviedb.org/3/discover/movie?${params.toString()}`;
    const res = await fetchTmdbJson<TmdbDiscoverResponse>(
      `discover/popular-platforms ${idPrefix} p${page}`,
      url,
      signal
    );
    if (!res.ok) {
      break;
    }
    const results = res.data.results ?? [];
    const candidates = results.filter(
      (m) =>
        m.poster_path != null &&
        m.poster_path !== "" &&
        !excluded.has(m.id)
    );
    const mapped = rawDiscoverResultsToMatchItems(candidates, idPrefix, collected.length);
    const withProviders = await enrichEsFlatrateOnly(
      mapped,
      apiKey,
      restrictPlatforms ? plataformas : null
    );
    for (const it of withProviders) {
      if (!collected.some((c) => c.tmdbId === it.tmdbId)) {
        collected.push(it);
      }
      if (collected.length >= targetCount) {
        break;
      }
    }
    page += 1;
  }

  return collected.slice(0, targetCount);
}

async function fetchPopularDiscoverGlobal(
  valoraciones: Ratings,
  apiKey: string,
  signal: AbortSignal,
  targetCount: number,
  idPrefix: string
): Promise<MatchItem[]> {
  const excluded = getExcludedTmdbIds(valoraciones);
  const collected: MatchItem[] = [];
  let page = 1;

  while (collected.length < targetCount && page <= 15) {
    if (signal.aborted) {
      break;
    }
    const url = `https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&language=es-ES&page=${page}`;
    const res = await fetchTmdbJson<TmdbDiscoverResponse>(
      `movie/popular fallback ${idPrefix} p${page}`,
      url,
      signal
    );
    if (!res.ok) {
      break;
    }
    const results = res.data.results ?? [];
    const candidates = results.filter(
      (m) =>
        m.poster_path != null &&
        m.poster_path !== "" &&
        !excluded.has(m.id)
    );
    const mapped = rawDiscoverResultsToMatchItems(candidates, idPrefix, collected.length);
    const withProviders = await enrichEsFlatrateOnly(mapped, apiKey, null);
    for (const it of withProviders) {
      if (!collected.some((c) => c.tmdbId === it.tmdbId)) {
        collected.push(it);
      }
      if (collected.length >= targetCount) {
        break;
      }
    }
    page += 1;
  }

  return collected.slice(0, targetCount);
}

async function fetchParaTiMoviesWithFallback(
  gustos: GustosSelection,
  valoraciones: Ratings,
  plataformas: string[],
  apiKey: string,
  signal: AbortSignal,
  targetCount: number
): Promise<MatchItem[]> {
  let rows = await fetchMoviesForUser(gustos, valoraciones, plataformas, {}, apiKey, signal, {
    targetCount,
    idPrefix: "para-ti"
  });
  if (rows.length >= 3) {
    return rows;
  }

  rows = await fetchMoviesForUser(
    gustos,
    valoraciones,
    plataformas,
    { skipGenres: true },
    apiKey,
    signal,
    { targetCount, idPrefix: "para-ti-sin-generos" }
  );
  if (rows.length > 0) {
    return rows;
  }

  rows = await fetchPopularOnPlatformsDiscover(
    valoraciones,
    plataformas,
    apiKey,
    signal,
    targetCount,
    "para-ti-pop-plat"
  );
  if (rows.length > 0) {
    return rows;
  }

  return fetchPopularDiscoverGlobal(valoraciones, apiKey, signal, targetCount, "para-ti-global");
}

function isoDateMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

async function fetchNovedadesMovies(
  plataformas: string[],
  valoraciones: Ratings,
  apiKey: string,
  signal: AbortSignal,
  targetCount: number
): Promise<MatchItem[]> {
  const excluded = getExcludedTmdbIds(valoraciones);
  const providerPipe = buildWatchProvidersPipe(plataformas);
  const restrictPlatforms = plataformas.length > 0;
  const collected: MatchItem[] = [];
  let page = 1;

  while (collected.length < targetCount && page <= 10) {
    if (signal.aborted) {
      break;
    }
    const params = new URLSearchParams({
      api_key: apiKey,
      language: "es-ES",
      watch_region: "ES",
      sort_by: "release_date.desc",
      page: String(page),
      "primary_release_date.gte": isoDateMonthsAgo(3),
      "vote_count.gte": "20"
    });
    if (providerPipe) {
      params.set("with_watch_providers", providerPipe);
    }

    const url = `https://api.themoviedb.org/3/discover/movie?${params.toString()}`;
    const res = await fetchTmdbJson<TmdbDiscoverResponse>(`discover/novedades p${page}`, url, signal);
    if (!res.ok) {
      break;
    }
    const results = res.data.results ?? [];
    const candidates = results.filter(
      (m) =>
        m.poster_path != null &&
        m.poster_path !== "" &&
        !excluded.has(m.id)
    );
    const mapped = rawDiscoverResultsToMatchItems(candidates, "novedades", collected.length);
    const withProviders = await enrichEsFlatrateOnly(
      mapped,
      apiKey,
      restrictPlatforms ? plataformas : null
    );
    for (const it of withProviders) {
      if (collected.some((c) => c.tmdbId === it.tmdbId)) {
        continue;
      }
      collected.push(it);
      if (collected.length >= targetCount) {
        break;
      }
    }
    page += 1;
  }

  return collected.slice(0, targetCount);
}

function calcularPuntosMatch(
  pelicula: PeliculaMatchInput,
  gustos: GustosSelection,
  valoraciones: Ratings
): number {
  let score = 0;
  const movieGenres = new Set(pelicula.genreIds);

  for (const name of gustos.generos ?? []) {
    const gid = GENRE_IDS_BY_NAME[name];
    if (gid && movieGenres.has(gid)) {
      score += 25;
    }
  }

  for (const [ratedId, rv] of Object.entries(valoraciones)) {
    if (!rv || rv.unseen) {
      continue;
    }
    const stars = Math.round(Number(rv.rating));
    if (ratedId.startsWith("tmdb-")) {
      const gRated = rv.genreIds ?? [];
      if (!gRated.some((g) => movieGenres.has(g))) {
        continue;
      }
      if (stars >= 5) {
        score += 30;
      } else if (stars === 4) {
        score += 15;
      } else if (stars === 3) {
        score += 5;
      } else if (stars === 2) {
        score -= 15;
      } else if (stars === 1) {
        score -= 30;
      }
      continue;
    }
    const meta = MOVIE_META_BY_ID[ratedId];
    if (!meta) {
      continue;
    }
    const ratedGenreId = GENRE_LABEL_TO_TMDB_ID[meta.genre];
    if (!ratedGenreId || !movieGenres.has(ratedGenreId)) {
      continue;
    }
    if (stars >= 5) {
      score += 30;
    } else if (stars === 4) {
      score += 15;
    } else if (stars === 3) {
      score += 5;
    } else if (stars === 2) {
      score -= 15;
    } else if (stars === 1) {
      score -= 30;
    }
  }

  if (pelicula.voteAverage > 8) {
    score += 10;
  } else if (pelicula.voteAverage > 7) {
    score += 5;
  }

  if (pelicula.popularity > 50) {
    score += 5;
  }

  const idiomaPref = gustos.idioma?.[0];
  if (!idiomaPref || idiomaPref === "Me da igual") {
    score += 8;
  } else {
    const langs = LANGUAGE_FILTERS[idiomaPref];
    if (langs?.length && pelicula.originalLanguage && langs.includes(pelicula.originalLanguage)) {
      score += 8;
    }
  }

  const epocas = gustos.epoca ?? [];
  if (epocas.length > 0 && pelicula.releaseDate) {
    const rd = pelicula.releaseDate.slice(0, 10);
    const epocaOk = epocas.some((ep) => {
      if (ep === "Lo más reciente") {
        return fechaEnRangoEpoca(rd, { gte: isoDateYearsAgo(2) });
      }
      const range = EPOCA_FILTERS[ep];
      return range ? fechaEnRangoEpoca(rd, range) : false;
    });
    if (epocaOk) {
      score += 8;
    }
  }

  return score;
}

function normalizarMatch62699(raw: number, batchRaw: number[]): number {
  if (batchRaw.length === 0) {
    return 80;
  }
  const min = Math.min(...batchRaw);
  const max = Math.max(...batchRaw);
  if (max === min) {
    return 80;
  }
  return Math.round(62 + ((raw - min) / (max - min)) * (99 - 62));
}

/** Match 62–99 según gustos y valoraciones (normalización por lote en listas). */
function calcularMatch(
  pelicula: PeliculaMatchInput,
  gustos: GustosSelection,
  valoraciones: Ratings
): number {
  const raw = calcularPuntosMatch(pelicula, gustos, valoraciones);
  return normalizarMatch62699(raw, [raw]);
}

function scoreAndSortMatch(
  items: MatchItem[],
  gustos: GustosSelection,
  valoraciones: Ratings
): MatchItem[] {
  if (items.length === 0) {
    return [];
  }
  const raws = items.map((item) => calcularPuntosMatch(matchItemToPelicula(item), gustos, valoraciones));
  const decorated = items.map((item, i) => ({ item, raw: raws[i] }));
  decorated.sort((a, b) => b.raw - a.raw);
  return decorated.map((row) => ({
    ...row.item,
    match: normalizarMatch62699(row.raw, raws)
  }));
}

type MoodPick = { id: string; label: string; withGenres: string; sortBy: string };

const MOOD_CHOICES: MoodPick[] = [
  { id: "reir", label: "Quiero reír", withGenres: "35", sortBy: "vote_average.desc" },
  { id: "emocionarme", label: "Quiero emocionarme", withGenres: "18", sortBy: "vote_average.desc" },
  { id: "sorprenderme", label: "Quiero sorprenderme", withGenres: "878|14", sortBy: "vote_average.desc" },
  { id: "accion", label: "Quiero acción", withGenres: "28", sortBy: "popularity.desc" },
  { id: "pensar", label: "Quiero pensar", withGenres: "9648|53", sortBy: "vote_average.desc" }
];

type MoodMovie = {
  id: number;
  title: string;
  overview: string;
  posterPath: string | null;
  genreIds: number[];
};

async function fetchMoodRecommendation(pick: MoodPick, apiKey: string, signal: AbortSignal): Promise<MoodMovie | null> {
  const page = 1 + (pick.id.length % 4);
  const params = new URLSearchParams({
    api_key: apiKey,
    language: "es-ES",
    with_genres: pick.withGenres,
    sort_by: pick.sortBy,
    page: String(page),
    "vote_count.gte": "150",
    include_adult: "false"
  });
  const url = `https://api.themoviedb.org/3/discover/movie?${params.toString()}`;
  const res = await fetchTmdbJson<TmdbDiscoverResponse>("discover/mood", url, signal);
  if (!res.ok) {
    return null;
  }
  const list = res.data.results ?? [];
  const withPoster = list.find((m) => m.poster_path != null && m.poster_path !== "");
  const chosen = withPoster ?? list[0];
  if (!chosen) {
    return null;
  }
  return {
    id: chosen.id,
    title: chosen.title ?? chosen.name ?? "Sin título",
    overview: (chosen.overview ?? "").trim() || "Sin sinopsis disponible.",
    posterPath: chosen.poster_path,
    genreIds: chosen.genre_ids ?? []
  };
}

const dashboardRowContainerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.06
    }
  }
};

const dashboardMovieCardVariants: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] }
  }
};

function getGreetingByHour(hour: number) {
  if (hour >= 6 && hour <= 13) {
    return "Buenos días";
  }

  if (hour >= 14 && hour <= 20) {
    return "Buenas tardes";
  }

  return "Buenas noches";
}

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path
        d="M7 5.5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 17 5.5V20l-5-3-5 3V5.5Z"
        stroke="#000"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path
        d="m6.5 12.5 3.4 3.4 7.6-7.6"
        stroke="#000"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MovieCard({
  item,
  isSaved,
  onToggleWatchlist,
  onRateMovie,
  onMarkSeenUnrated,
  onOpenDetail
}: {
  item: MatchItem;
  isSaved: boolean;
  onToggleWatchlist: (id: string) => void;
  onRateMovie?: (item: MatchItem, stars: number) => void;
  /** Marcar como vista sin valorar (excluye de recomendaciones). */
  onMarkSeenUnrated?: (item: MatchItem) => void;
  onOpenDetail?: (item: MatchItem) => void;
}) {
  const [seenPanelOpen, setSeenPanelOpen] = useState(false);

  const handleOpenDetail = () => {
    onOpenDetail?.(item);
  };

  return (
    <motion.article variants={dashboardMovieCardVariants} className="w-[140px] flex-shrink-0">
      <motion.div
        role={onOpenDetail ? "button" : undefined}
        tabIndex={onOpenDetail ? 0 : undefined}
        onClick={onOpenDetail ? handleOpenDetail : undefined}
        onKeyDown={
          onOpenDetail
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleOpenDetail();
                }
              }
            : undefined
        }
        className={`relative h-[190px] w-full overflow-hidden rounded-xl border border-[#2a2a2a] ${
          onOpenDetail ? "cursor-pointer" : ""
        }`}
        whileHover={onOpenDetail ? { scale: 0.97 } : undefined}
        whileTap={onOpenDetail ? { scale: 0.97 } : undefined}
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
      >
        {item.posterPath != null && item.posterPath !== "" ? (
          <Image
            src={`https://image.tmdb.org/t/p/w342${item.posterPath}`}
            alt={`Póster de ${item.title}`}
            width={342}
            height={513}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(180deg, ${item.gradient[0]} 0%, ${item.gradient[1]} 100%)`
            }}
          />
        )}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleWatchlist(item.id);
          }}
          className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-white transition hover:bg-neutral-200"
          aria-label="Guardar en watchlist"
        >
          {isSaved ? <CheckIcon /> : <BookmarkIcon />}
        </button>
      </motion.div>
      <p
        className={`mt-2 truncate text-sm font-medium text-white ${onOpenDetail ? "cursor-pointer" : ""}`}
        onClick={onOpenDetail ? handleOpenDetail : undefined}
      >
        {item.title}
      </p>
      <p className="text-xs font-medium text-[#22c55e]">{item.match}% match</p>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-neutral-400">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: item.platformColor }}
        />
        <span className="truncate">{item.platform}</span>
      </div>
      {onRateMovie ? (
        <div className="mt-2">
          <MotionButton
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setSeenPanelOpen((open) => !open);
            }}
            className="w-full rounded-md border border-[#333] bg-[#161616] px-2 py-1 text-[10px] font-medium text-neutral-300 transition hover:border-neutral-500 hover:text-white"
          >
            ✓ Ya la vi
          </MotionButton>
          {seenPanelOpen ? (
            <div className="mt-2 rounded-lg border border-[#2a2a2a] bg-[#121212] p-2">
              <p className="mb-1.5 text-center text-[10px] text-neutral-500">Valoración</p>
              <div className="flex justify-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <motion.button
                    key={star}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRateMovie(item, star);
                      setSeenPanelOpen(false);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-[#2a2a2a] text-sm text-neutral-400 transition hover:bg-[#fbbf24] hover:text-black"
                    aria-label={`Valorar ${star} estrellas`}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  >
                    ★
                  </motion.button>
                ))}
              </div>
              {onMarkSeenUnrated ? (
                <MotionButton
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onMarkSeenUnrated(item);
                    setSeenPanelOpen(false);
                  }}
                  className="mt-2 w-full rounded-md border border-dashed border-neutral-600 py-1 text-[10px] text-neutral-500 transition hover:border-neutral-500 hover:text-neutral-300"
                >
                  Solo marcar como vista
                </MotionButton>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </motion.article>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [name, setName] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [gustos, setGustos] = useState<GustosSelection>({});
  const [ratings, setRatings] = useState<Ratings>({});
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [popularMovies, setPopularMovies] = useState<MatchItem[]>([]);
  const [isLoadingPopular, setIsLoadingPopular] = useState(true);
  const [becauseYouLikedMovies, setBecauseYouLikedMovies] = useState<MatchItem[]>([]);
  const [isLoadingBecauseYouLiked, setIsLoadingBecauseYouLiked] = useState(true);
  const [tonightMovies, setTonightMovies] = useState<MatchItem[]>([]);
  const [isLoadingTonightMovies, setIsLoadingTonightMovies] = useState(true);
  const [nowPlayingMovies, setNowPlayingMovies] = useState<MatchItem[]>([]);
  const [isLoadingNowPlayingMovies, setIsLoadingNowPlayingMovies] = useState(true);
  const [becauseLikedFilmTitle, setBecauseLikedFilmTitle] = useState("tu favorita");

  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [detailMovie, setDetailMovie] = useState<MovieDetail | null>(null);
  const [detailTv, setDetailTv] = useState<TvDetail | null>(null);
  const [providers, setProviders] = useState<string[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [starsPanelOpen, setStarsPanelOpen] = useState(false);
  const [streakDays, setStreakDays] = useState(0);
  const [streakBanner, setStreakBanner] = useState<string | null>(null);
  const [moodOpen, setMoodOpen] = useState(false);
  const [moodLoading, setMoodLoading] = useState(false);
  const [moodMovie, setMoodMovie] = useState<MoodMovie | null>(null);
  const [moodPick, setMoodPick] = useState<MoodPick | null>(null);
  const moodAbortRef = useRef<AbortController | null>(null);
  const lastRecDepsSigRef = useRef<string | null>(null);
  const [dashboardRecVisEpoch, setDashboardRecVisEpoch] = useState(0);

  const persistTmdbRating = (item: MatchItem, stars: number) => {
    const key = `tmdb-${item.tmdbId}`;
    setRatings((prev) => {
      const next: Ratings = {
        ...prev,
        [key]: {
          rating: stars,
          unseen: false,
          title: item.title,
          genreIds: item.genreIds ?? []
        }
      };
      window.localStorage.setItem("valoraciones", JSON.stringify(next));
      return next;
    });
    const bump = bumpMovieStreak();
    setStreakDays(bump.count);
    const streakMsg = claimStreakMilestoneAfterBump(bump);
    if (streakMsg) {
      setStreakBanner(streakMsg);
    }
    void logUserActivity({
      type: "rated",
      movieId: item.tmdbId,
      movieTitle: item.title,
      posterPath: item.posterPath ?? null,
      rating: stars
    });
  };

  const persistTmdbSeenUnrated = useCallback((item: MatchItem) => {
    const key = `tmdb-${item.tmdbId}`;
    setRatings((prev) => {
      const next: Ratings = {
        ...prev,
        [key]: {
          rating: 0,
          unseen: true,
          title: item.title,
          genreIds: item.genreIds ?? []
        }
      };
      window.localStorage.setItem("valoraciones", JSON.stringify(next));
      return next;
    });
    const bump = bumpMovieStreak();
    setStreakDays(bump.count);
    const streakMsg = claimStreakMilestoneAfterBump(bump);
    if (streakMsg) {
      setStreakBanner(streakMsg);
    }
    void logUserActivity({
      type: "watched",
      movieId: item.tmdbId,
      movieTitle: item.title,
      posterPath: item.posterPath ?? null
    });
  }, []);

  useEffect(() => {
    if (pathname !== "/dashboard") {
      return;
    }
    const bumpIfStale = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      const ok = Number(window.sessionStorage.getItem(DASHBOARD_RECS_OK_MS_KEY) || "0");
      if (Date.now() - ok >= 30 * 60 * 1000) {
        setDashboardRecVisEpoch((n) => n + 1);
      }
    };
    bumpIfStale();
    document.addEventListener("visibilitychange", bumpIfStale);
    return () => document.removeEventListener("visibilitychange", bumpIfStale);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) {
        return;
      }
      if (!user) {
        router.replace("/");
        return;
      }

      const fromMeta =
        typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
      const display = fromMeta || user.email || "";
      if (display) {
        window.localStorage.setItem("nombre", display);
        setName(display);
      }
      void syncProfileFromLocal(user);
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    setStreakDays(readEffectiveMovieStreak());
    const pending = claimPendingStreakMilestoneOnVisit();
    if (pending) {
      setStreakBanner(pending);
    }
  }, []);

  useEffect(() => {
    if (!streakBanner) {
      return undefined;
    }
    const t = window.setTimeout(() => setStreakBanner(null), 4000);
    return () => window.clearTimeout(t);
  }, [streakBanner]);

  useEffect(
    () => () => {
      moodAbortRef.current?.abort();
    },
    []
  );

  useEffect(() => {
    const storedName = window.localStorage.getItem("nombre");
    const storedPlatforms = window.localStorage.getItem("plataformas");
    const storedGustos = window.localStorage.getItem("gustos");
    const storedRatings = window.localStorage.getItem("valoraciones");
    const storedWatchlist = window.localStorage.getItem("watchlist");

    if (storedName) {
      setName((prev) => (prev ? prev : storedName));
    }

    if (storedPlatforms) {
      try {
        const parsed = JSON.parse(storedPlatforms);
        if (Array.isArray(parsed)) {
          const platformLabelsById: Record<string, string> = {
            netflix: "Netflix",
            disney_plus: "Disney+",
            max: "Max",
            prime: "Prime",
            apple_tv_plus: "Apple TV+",
            filmin: "Filmin"
          };
          const labels = parsed
            .filter((item): item is string => typeof item === "string")
            .map((id) => platformLabelsById[id] ?? id)
            .filter((label): label is string => Boolean(label))
            .filter((label, index, arr) => arr.indexOf(label) === index);

          setSelectedPlatforms(labels);
        }
      } catch {
        // Ignore malformed localStorage data.
      }
    }

    if (storedGustos) {
      try {
        const parsed = JSON.parse(storedGustos) as Record<string, unknown>;
        const next: GustosSelection = {};
        Object.entries(parsed).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            next[key] = value.filter((v): v is string => typeof v === "string");
          }
        });
        setGustos(next);
      } catch {
        // Ignore malformed localStorage data.
      }
    }

    if (storedRatings) {
      try {
        const parsedRatings = JSON.parse(storedRatings) as Record<string, unknown>;
        const normalizedRatings: Ratings = {};

        Object.entries(parsedRatings).forEach(([movieId, value]) => {
          if (!value || typeof value !== "object") {
            return;
          }

          const candidate = value as {
            rating?: unknown;
            unseen?: unknown;
            genreIds?: unknown;
            title?: unknown;
          };
          const rating =
            typeof candidate.rating === "number" && Number.isFinite(candidate.rating)
              ? candidate.rating
              : 0;

          const genreIds = Array.isArray(candidate.genreIds)
            ? candidate.genreIds.filter((g): g is number => typeof g === "number" && Number.isFinite(g))
            : undefined;

          const title =
            typeof candidate.title === "string" && candidate.title.trim().length > 0
              ? candidate.title.trim()
              : undefined;

          normalizedRatings[movieId] = {
            rating,
            unseen: Boolean(candidate.unseen),
            ...(genreIds && genreIds.length > 0 ? { genreIds } : {}),
            ...(title ? { title } : {})
          };
        });

        setRatings(normalizedRatings);
      } catch {
        // Ignore malformed localStorage data.
      }
    }

    if (storedWatchlist) {
      try {
        const parsedWatchlist = JSON.parse(storedWatchlist);
        if (Array.isArray(parsedWatchlist)) {
          setWatchlist(parsedWatchlist.filter((item): item is string => typeof item === "string"));
        }
      } catch {
        // Ignore malformed localStorage data.
      }
    }
  }, []);

  useEffect(() => {
    const depsSig = JSON.stringify({
      gustos,
      ratings,
      platforms: selectedPlatforms
    });
    const prefsChanged = lastRecDepsSigRef.current !== depsSig;
    if (prefsChanged) {
      lastRecDepsSigRef.current = depsSig;
    }
    const lastOk = Number(
      typeof window !== "undefined" ? window.sessionStorage.getItem(DASHBOARD_RECS_OK_MS_KEY) || "0" : "0"
    );
    const visitStale = Date.now() - lastOk >= 30 * 60 * 1000;
    if (!prefsChanged && !visitStale) {
      setIsLoadingPopular(false);
      setIsLoadingBecauseYouLiked(false);
      setIsLoadingTonightMovies(false);
      setIsLoadingNowPlayingMovies(false);
      return;
    }

    const ac = new AbortController();
    let cancelled = false;

    const loadRecommendations = async () => {
      setIsLoadingPopular(true);
      setIsLoadingBecauseYouLiked(true);
      setIsLoadingTonightMovies(true);
      setIsLoadingNowPlayingMovies(true);

      const apiKey = getTmdbApiKey();

      let bestId = "";
      let bestRating = -1;
      Object.entries(ratings).forEach(([movieId, value]) => {
        if (
          value &&
          !value.unseen &&
          typeof value.rating === "number" &&
          value.rating >= 3 &&
          value.rating > bestRating
        ) {
          bestRating = value.rating;
          bestId = movieId;
        }
      });
      if (!bestId) {
        bestRating = -1;
        Object.entries(ratings).forEach(([movieId, value]) => {
          if (
            value &&
            !value.unseen &&
            typeof value.rating === "number" &&
            value.rating >= 1 &&
            value.rating > bestRating
          ) {
            bestRating = value.rating;
            bestId = movieId;
          }
        });
      }

      let porqueGenreIds: number[] = [];
      const storedBestTitle =
        bestId && ratings[bestId]?.title?.trim() ? ratings[bestId].title!.trim() : null;
      let porqueTitle: string | null = storedBestTitle;
      const storedGenres = ratings[bestId]?.genreIds?.filter((g) => Number.isFinite(g)) ?? [];
      if (bestId) {
        const detail = await fetchRatedBestMovieGenresAndTitle(bestId, apiKey, ac.signal);
        if (!cancelled) {
          const merged = new Set<number>([...storedGenres, ...detail.genreIds]);
          porqueGenreIds = Array.from(merged);
          porqueTitle = storedBestTitle ?? detail.title;
        }
      }

      if (!cancelled) {
        if (porqueTitle) {
          setBecauseLikedFilmTitle(porqueTitle);
        } else if (bestId && MOVIE_META_BY_ID[bestId]) {
          setBecauseLikedFilmTitle(MOVIE_META_BY_ID[bestId].title);
        } else {
          setBecauseLikedFilmTitle("tu favorita");
        }
      }

      const now = new Date();
      const dow = now.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const before21 = now.getHours() < 21;
      const tonightExtra: DiscoverExtraFilters =
        !isWeekend && before21 ? { withRuntimeLte: 100 } : { withRuntimeGte: 100 };

      try {
        const [paraTiRaw, porqueRaw, nocheRaw, novedadesRaw] = await Promise.all([
          fetchParaTiMoviesWithFallback(gustos, ratings, selectedPlatforms, apiKey, ac.signal, 14),
          porqueGenreIds.length > 0
            ? fetchMoviesForUser(
                gustos,
                ratings,
                selectedPlatforms,
                {
                  forcedGenreIds: porqueGenreIds,
                  onlyForcedGenres: true,
                  skipOriginalLanguage: true,
                  skipEpoca: true
                },
                apiKey,
                ac.signal,
                { targetCount: 14, idPrefix: "porque" }
              )
            : Promise.resolve<MatchItem[]>([]),
          fetchMoviesForUser(gustos, ratings, selectedPlatforms, tonightExtra, apiKey, ac.signal, {
            targetCount: 14,
            idPrefix: "noche"
          }),
          fetchNovedadesMovies(selectedPlatforms, ratings, apiKey, ac.signal, 12)
        ]);

        if (cancelled) {
          return;
        }

        setPopularMovies(paraTiRaw);
        setBecauseYouLikedMovies(porqueRaw);
        setTonightMovies(nocheRaw);
        setNowPlayingMovies(novedadesRaw);
        window.sessionStorage.setItem(DASHBOARD_RECS_OK_MS_KEY, String(Date.now()));
      } finally {
        if (!cancelled) {
          setIsLoadingPopular(false);
          setIsLoadingBecauseYouLiked(false);
          setIsLoadingTonightMovies(false);
          setIsLoadingNowPlayingMovies(false);
        }
      }
    };

    void loadRecommendations();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [gustos, ratings, selectedPlatforms, dashboardRecVisEpoch]);

  const excludedTmdbIds = useMemo(() => getExcludedTmdbIds(ratings), [ratings]);

  const moviesForToday = useMemo(() => {
    const visible = popularMovies.filter((m) => !excludedTmdbIds.has(m.tmdbId));
    return scoreAndSortMatch(visible, gustos, ratings).slice(0, 10);
  }, [popularMovies, gustos, ratings, excludedTmdbIds]);

  const becauseYouLikedItems = useMemo(() => {
    const visible = becauseYouLikedMovies.filter((m) => !excludedTmdbIds.has(m.tmdbId));
    return scoreAndSortMatch(visible, gustos, ratings).slice(0, 10);
  }, [becauseYouLikedMovies, gustos, ratings, excludedTmdbIds]);

  const tonightMoviesSorted = useMemo(() => {
    const visible = tonightMovies.filter((m) => !excludedTmdbIds.has(m.tmdbId));
    return scoreAndSortMatch(visible, gustos, ratings).slice(0, 10);
  }, [tonightMovies, gustos, ratings, excludedTmdbIds]);

  const visibleNews = useMemo(() => {
    const visible = nowPlayingMovies.filter((m) => !excludedTmdbIds.has(m.tmdbId));
    return scoreAndSortMatch(visible, gustos, ratings).slice(0, 10);
  }, [nowPlayingMovies, gustos, ratings, excludedTmdbIds]);

  const greeting = useMemo(() => getGreetingByHour(new Date().getHours()), []);

  const allCardItems = useMemo(() => {
    const uniqueById = new Map<string, MatchItem>();
    [...moviesForToday, ...becauseYouLikedItems, ...tonightMoviesSorted, ...visibleNews].forEach((item) => {
      uniqueById.set(item.id, item);
    });

    return Array.from(uniqueById.values());
  }, [moviesForToday, becauseYouLikedItems, tonightMoviesSorted, visibleNews]);

  const ratedMovies = useMemo(
    () =>
      Object.entries(ratings).filter(
        ([, value]) => value && !value.unseen && typeof value.rating === "number" && value.rating > 0
      ),
    [ratings]
  );

  const avgRating = useMemo(() => {
    if (ratedMovies.length === 0) {
      return 0;
    }
    const total = ratedMovies.reduce((acc, [, value]) => acc + value.rating, 0);
    return total / ratedMovies.length;
  }, [ratedMovies]);

  const favoriteGenre = useMemo(() => {
    if (ratedMovies.length === 0) {
      return "—";
    }

    const highestRating = ratedMovies.reduce((max, [, value]) => Math.max(max, value.rating), 0);
    const highestRatedMovies = ratedMovies.filter(([, value]) => value.rating === highestRating);
    const genreCounts: Record<string, number> = {};

    highestRatedMovies.forEach(([movieId]) => {
      const genre = MOVIE_META_BY_ID[movieId]?.genre ?? "Otros";
      genreCounts[genre] = (genreCounts[genre] ?? 0) + 1;
    });

    return Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0][0];
  }, [ratedMovies]);

  const watchlistItems = useMemo(() => {
    const byId = new Map(allCardItems.map((item) => [item.id, item] as const));
    const unique = Array.from(new Set(watchlist));
    return unique
      .map((id) => byId.get(id))
      .filter((item): item is MatchItem => Boolean(item));
  }, [allCardItems, watchlist]);

  const toggleWatchlist = (id: string) => {
    const item = allCardItems.find((row) => row.id === id);
    setWatchlist((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((item) => item !== id) : [...prev, id];
      const deduped = Array.from(new Set(next));
      window.localStorage.setItem("watchlist", JSON.stringify(deduped));
      if (!exists && item) {
        void logUserActivity({
          type: "watchlist",
          movieId: item.tmdbId,
          movieTitle: item.title,
          posterPath: item.posterPath ?? null
        });
      }
      return deduped;
    });
  };

  const openSheet = useCallback((item: MatchItem) => {
    router.push(`/pelicula/${item.tmdbId}`);
  }, [router]);

  const openMoodModal = useCallback((pick: MoodPick) => {
    moodAbortRef.current?.abort();
    const ac = new AbortController();
    moodAbortRef.current = ac;
    setMoodPick(pick);
    setMoodOpen(true);
    setMoodLoading(true);
    setMoodMovie(null);
    void (async () => {
      const mv = await fetchMoodRecommendation(pick, getTmdbApiKey(), ac.signal);
      if (ac.signal.aborted) {
        return;
      }
      setMoodMovie(mv);
      setMoodLoading(false);
    })();
  }, []);

  const closeMoodModal = useCallback(() => {
    moodAbortRef.current?.abort();
    moodAbortRef.current = null;
    setMoodOpen(false);
    setMoodLoading(false);
    setMoodMovie(null);
    setMoodPick(null);
  }, []);

  useEffect(() => {
    if (!sheet) {
      return;
    }

    const ac = new AbortController();
    const base = `https://api.themoviedb.org/3`;
    const key = TMDB_API_KEY;
    const { item, media } = sheet;

    async function loadDetail() {
      setDetailLoading(true);
      if (media === "movie") {
        const [mov, prov] = await Promise.all([
          fetchJson<MovieDetail>(
            `${base}/movie/${item.id}?api_key=${key}&language=es-ES`,
            ac.signal
          ),
          fetchJson<WatchProvidersResponse>(
            `${base}/movie/${item.id}/watch/providers?api_key=${key}`,
            ac.signal
          )
        ]);
        if (!ac.signal.aborted) {
          setDetailMovie(mov);
          setDetailTv(null);
          setProviders(collectProviderNames(prov));
        }
      } else {
        const [tv, prov] = await Promise.all([
          fetchJson<TvDetail>(`${base}/tv/${item.id}?api_key=${key}&language=es-ES`, ac.signal),
          fetchJson<WatchProvidersResponse>(
            `${base}/tv/${item.id}/watch/providers?api_key=${key}`,
            ac.signal
          )
        ]);
        if (!ac.signal.aborted) {
          setDetailTv(tv);
          setDetailMovie(null);
          setProviders(collectProviderNames(prov));
        }
      }
      if (!ac.signal.aborted) {
        setDetailLoading(false);
      }
    }

    loadDetail();
    return () => ac.abort();
  }, [sheet]);

  const toggleWatchlistFromSheet = useCallback(() => {
    if (!sheet) {
      return;
    }
    const id = watchlistId(sheet.media, sheet.item.id);
    const title = sheet.media === "movie" ? sheet.item.title : sheet.item.name;
    setWatchlist((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((x) => x !== id) : [...prev, id];
      const deduped = Array.from(new Set(next));
      window.localStorage.setItem("watchlist", JSON.stringify(deduped));
      if (!exists) {
        void logUserActivity({
          type: "watchlist",
          movieId: sheet.item.id,
          movieTitle: title ?? undefined,
          posterPath: sheet.item.poster_path ?? null
        });
      }
      return deduped;
    });
  }, [sheet]);

  const persistRating = useCallback(
    (stars: number) => {
      if (!sheet) {
        return;
      }
      const key = ratingStorageKey(sheet.media, sheet.item.id);
      const fromDetail =
        sheet.media === "movie"
          ? detailMovie?.genres?.map((g) => g.id) ?? []
          : detailTv?.genres?.map((g) => g.id) ?? [];
      const genreIds =
        fromDetail.length > 0
          ? fromDetail
          : sheet.item.genre_ids?.filter((n) => Number.isFinite(n)) ?? [];
      const title =
        sheet.media === "movie"
          ? detailMovie?.title ?? sheet.item.title ?? ""
          : detailTv?.name ?? sheet.item.name ?? "";

      try {
        const raw = window.localStorage.getItem("valoraciones");
        const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        const next = {
          ...prev,
          [key]: { rating: stars, unseen: false, genreIds, title }
        };
        window.localStorage.setItem("valoraciones", JSON.stringify(next));
      } catch {
        window.localStorage.setItem(
          "valoraciones",
          JSON.stringify({ [key]: { rating: stars, unseen: false, genreIds, title } })
        );
      }

      setRatings((prev) => ({
        ...prev,
        [key]: {
          rating: stars,
          unseen: false,
          genreIds,
          title
        }
      }));

      setStarsPanelOpen(false);
      setSheet(null);
      const bump = bumpMovieStreak();
      setStreakDays(bump.count);
      const streakMsg = claimStreakMilestoneAfterBump(bump);
      if (streakMsg) {
        setStreakBanner(streakMsg);
      }
      if (sheet.media === "movie") {
        void logUserActivity({
          type: "rated",
          movieId: sheet.item.id,
          movieTitle: title,
          posterPath: sheet.item.poster_path ?? null,
          rating: stars
        });
      }
    },
    [sheet, detailMovie, detailTv]
  );

  return (
    <main className="flex min-h-screen justify-center bg-[#0a0a0a] px-6 text-white">
      <AnimatePresence>
        {streakBanner ? (
          <motion.div
            key={streakBanner}
            role="status"
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="fixed left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] z-[70] w-[min(calc(100%-2rem),22rem)] -translate-x-1/2 rounded-2xl border border-[#333] bg-[#141414] px-4 py-3 text-center text-sm font-semibold text-white shadow-xl"
          >
            {streakBanner}
          </motion.div>
        ) : null}
      </AnimatePresence>
      <section className="relative w-full max-w-[400px] pt-10 pb-28">
        <p className="mb-6 w-full text-center text-xs uppercase tracking-[0.35em] text-neutral-500 select-none">
          WhatNext?
        </p>

        <header className="mb-8">
          <h1 className="text-3xl font-semibold leading-tight text-white">
            {greeting}, {name || "..."}
          </h1>
          <article className="mt-4 rounded-xl border border-[#2a2a2a] bg-[#101010] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Racha de películas</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-white">{streakDays}</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-400">
              {streakDays === 0
                ? "Valora o marca pelis como vistas cada día para subir tu racha."
                : streakDays === 1
                  ? "1 día seguido con actividad."
                  : `${streakDays} días seguidos con actividad.`}
            </p>
          </article>
          <p className="mt-6 text-sm text-neutral-400">Tu lista de hoy:</p>
        </header>

        <motion.section
          className="mb-8"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, delay: 0, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="mb-3 text-base font-semibold text-white">Para ti hoy:</h2>
          <p className="mb-2 text-xs text-neutral-400">
            Basado en tus gustos · {selectedPlatforms.length > 0 ? selectedPlatforms.join(", ") : "Todas las plataformas"}
          </p>
          <motion.div
            className="flex flex-row gap-3 overflow-x-scroll pb-2"
            variants={dashboardRowContainerVariants}
            initial="hidden"
            animate="show"
          >
            {isLoadingPopular ? (
              Array.from({ length: 4 }).map((_, index) => (
                <motion.div
                  key={`popular-skeleton-${index}`}
                  variants={dashboardMovieCardVariants}
                  className="w-[140px] flex-shrink-0"
                >
                  <SkeletonMovieCard />
                </motion.div>
              ))
            ) : moviesForToday.length > 0 ? (
              moviesForToday.map((item) => (
                <MovieCard
                  key={item.id}
                  item={item}
                  isSaved={watchlist.includes(item.id)}
                  onToggleWatchlist={toggleWatchlist}
                  onRateMovie={persistTmdbRating}
                  onMarkSeenUnrated={persistTmdbSeenUnrated}
                  onOpenDetail={openSheet}
                />
              ))
            ) : (
              Array.from({ length: 4 }).map((_, index) => (
                <motion.div
                  key={`para-ti-fallback-${index}`}
                  variants={dashboardMovieCardVariants}
                  className="w-[140px] flex-shrink-0"
                >
                  <SkeletonMovieCard />
                </motion.div>
              ))
            )}
          </motion.div>
        </motion.section>

        <motion.section
          className="mb-8"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, delay: 0.07, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="mb-3 text-base font-semibold text-white">Modo pareja</h2>
          <p className="mb-3 text-xs text-neutral-400">Encuentra una película que os guste a los dos</p>
          <MotionLink
            href="/pareja"
            className="block w-full rounded-xl bg-white py-3 text-center text-sm font-semibold text-black transition hover:bg-neutral-100"
          >
            Busquemos una peli juntos
          </MotionLink>
        </motion.section>

        <motion.section
          className="mb-8"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="mb-3 text-base font-semibold text-white">
            Porque te gustó {becauseLikedFilmTitle}
          </h2>
          <motion.div
            className="flex flex-row gap-3 overflow-x-scroll pb-2"
            variants={dashboardRowContainerVariants}
            initial="hidden"
            animate="show"
          >
            {isLoadingBecauseYouLiked ? (
              Array.from({ length: 4 }).map((_, index) => (
                <motion.div
                  key={`similar-skeleton-${index}`}
                  variants={dashboardMovieCardVariants}
                  className="w-[140px] flex-shrink-0"
                >
                  <SkeletonMovieCard />
                </motion.div>
              ))
            ) : becauseYouLikedItems.length > 0 ? (
              becauseYouLikedItems.map((item) => (
                <MovieCard
                  key={item.id}
                  item={item}
                  isSaved={watchlist.includes(item.id)}
                  onToggleWatchlist={toggleWatchlist}
                  onRateMovie={persistTmdbRating}
                  onMarkSeenUnrated={persistTmdbSeenUnrated}
                  onOpenDetail={openSheet}
                />
              ))
            ) : (
              <p className="min-w-0 shrink-0 px-1 py-4 text-xs text-neutral-500">
                No hay títulos disponibles por ahora.
              </p>
            )}
          </motion.div>
        </motion.section>

        <motion.section
          className="mb-8"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="mb-2 text-base font-semibold text-white">Ya sé lo que quiero ver</h2>
          <p className="mb-3 text-xs text-neutral-500">Una recomendación al instante según tu mood.</p>
          <div className="flex flex-col gap-2">
            {MOOD_CHOICES.map((m) => (
              <MotionButton
                key={m.id}
                type="button"
                onClick={() => openMoodModal(m)}
                className="w-full rounded-xl border border-[#2a2a2a] bg-[#101010] px-4 py-3.5 text-left text-sm font-medium text-white transition hover:border-neutral-500"
              >
                {m.label}
              </MotionButton>
            ))}
          </div>
        </motion.section>

        <motion.section
          className="mb-8"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="mb-2 text-base font-semibold text-white">Perfecto para esta noche</h2>
          <motion.div
            className="flex flex-row gap-3 overflow-x-scroll pb-2"
            variants={dashboardRowContainerVariants}
            initial="hidden"
            animate="show"
          >
            {isLoadingTonightMovies ? (
              Array.from({ length: 4 }).map((_, index) => (
                <motion.div
                  key={`tonight-skeleton-${index}`}
                  variants={dashboardMovieCardVariants}
                  className="w-[140px] flex-shrink-0"
                >
                  <SkeletonMovieCard />
                </motion.div>
              ))
            ) : tonightMoviesSorted.length > 0 ? (
              tonightMoviesSorted.map((item) => (
                <MovieCard
                  key={item.id}
                  item={item}
                  isSaved={watchlist.includes(item.id)}
                  onToggleWatchlist={toggleWatchlist}
                  onRateMovie={persistTmdbRating}
                  onMarkSeenUnrated={persistTmdbSeenUnrated}
                  onOpenDetail={openSheet}
                />
              ))
            ) : (
              <p className="min-w-0 shrink-0 px-1 py-4 text-xs text-neutral-500">
                No hay títulos disponibles por ahora.
              </p>
            )}
          </motion.div>
        </motion.section>

        <motion.section
          className="mb-8"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="mb-3 text-base font-semibold text-white">Novedades en tus plataformas</h2>
          <motion.div
            className="flex flex-row gap-3 overflow-x-scroll pb-2"
            variants={dashboardRowContainerVariants}
            initial="hidden"
            animate="show"
          >
            {isLoadingNowPlayingMovies ? (
              Array.from({ length: 4 }).map((_, index) => (
                <motion.div
                  key={`nowplaying-skeleton-${index}`}
                  variants={dashboardMovieCardVariants}
                  className="w-[140px] flex-shrink-0"
                >
                  <SkeletonMovieCard />
                </motion.div>
              ))
            ) : visibleNews.length > 0 ? (
              visibleNews.map((item) => (
                <MovieCard
                  key={item.id}
                  item={item}
                  isSaved={watchlist.includes(item.id)}
                  onToggleWatchlist={toggleWatchlist}
                  onRateMovie={persistTmdbRating}
                  onMarkSeenUnrated={persistTmdbSeenUnrated}
                  onOpenDetail={openSheet}
                />
              ))
            ) : (
              <p className="min-w-0 shrink-0 px-1 py-4 text-xs text-neutral-500">
                No hay títulos disponibles por ahora.
              </p>
            )}
          </motion.div>
        </motion.section>

        <motion.section
          className="mb-8"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, delay: 0.34, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="mb-3 text-base font-semibold text-white">Tu watchlist</h2>
          {watchlistItems.length === 0 ? (
            <p className="rounded-xl border border-[#2a2a2a] bg-[#101010] px-4 py-4 text-sm text-neutral-400">
              Guarda películas para verlas después...
            </p>
          ) : (
            <motion.div
              className="flex flex-row gap-3 overflow-x-scroll pb-2"
              variants={dashboardRowContainerVariants}
              initial="hidden"
              animate="show"
            >
              {watchlistItems.map((item) => (
                <MovieCard
                  key={item.id}
                  item={item}
                  isSaved={watchlist.includes(item.id)}
                  onToggleWatchlist={toggleWatchlist}
                  onRateMovie={persistTmdbRating}
                  onMarkSeenUnrated={persistTmdbSeenUnrated}
                  onOpenDetail={openSheet}
                />
              ))}
            </motion.div>
          )}
        </motion.section>

        <motion.section
          className="mb-8"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="mb-3 text-base font-semibold text-white">Tu año en números</h2>
          {ratedMovies.length === 0 && (
            <p className="mb-3 text-xs text-neutral-400">Completa el test para ver tus estadísticas</p>
          )}
          <div className="grid grid-cols-3 gap-2">
            <article className="flex h-[116px] flex-col items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#101010] px-3 py-3 text-center">
              <p className="text-3xl font-bold text-[#4A90D9]">{ratedMovies.length}</p>
              <p className="mt-1 text-[11px] text-neutral-400">valoradas</p>
            </article>
            <article className="flex h-[116px] flex-col items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#101010] px-3 py-3 text-center">
              <p className="text-3xl font-bold text-[#00A550]">{avgRating.toFixed(1)}</p>
              <p className="mt-1 text-[11px] text-neutral-400">media</p>
            </article>
            <article className="flex h-[116px] flex-col items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#101010] px-2 py-3 text-center">
              <p className="w-full text-sm font-bold leading-tight text-[#9370DB] sm:text-xl">
                {favoriteGenre}
              </p>
              <p className="mt-1 text-[11px] text-neutral-400">género favorito</p>
            </article>
          </div>
        </motion.section>

        <motion.article
          className="mb-8 rounded-xl border border-[#2a2a2a] bg-[#101010] px-4 py-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-sm leading-relaxed text-neutral-400">
            Agrega amigos para ver sus recomendaciones y comparar gustos
          </p>
          <MotionLink
            href="/amigos"
            className="mt-4 flex w-full items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#141414] py-3 text-center text-sm font-semibold text-white transition hover:border-neutral-500"
          >
            Ir a amigos
          </MotionLink>
        </motion.article>

        <TmdbDetailSheet
          sheet={sheet}
          onClose={() => {
            setSheet(null);
          }}
          detailMovie={detailMovie}
          detailTv={detailTv}
          detailLoading={detailLoading}
          providers={providers}
          watchlist={watchlist}
          onToggleWatchlist={toggleWatchlistFromSheet}
          starsPanelOpen={starsPanelOpen}
          onToggleStarsPanel={() => setStarsPanelOpen((o) => !o)}
          persistRating={persistRating}
        />

        <AnimatePresence>
          {moodOpen ? (
            <>
              <motion.button
                key="mood-backdrop"
                type="button"
                aria-label="Cerrar"
                className="fixed inset-0 z-30 bg-black/70"
                onClick={closeMoodModal}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
              />
              <motion.div
                key="mood-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="mood-modal-title"
                className="fixed bottom-0 left-1/2 z-40 max-h-[90vh] w-full max-w-[400px] -translate-x-1/2 overflow-y-auto rounded-t-2xl border border-[#2a2a2a] border-b-0 bg-[#111]"
                initial={{ y: "105%" }}
                animate={{ y: 0 }}
                exit={{ y: "105%", transition: { duration: 0.34, ease: [0.32, 0.72, 0, 1] } }}
                transition={{ type: "spring", stiffness: 300, damping: 32, mass: 0.88 }}
              >
              <div className="sticky top-0 z-10 mx-auto mt-2 h-1 w-10 rounded-full bg-[#3f3f46]" />
              <div className="px-5 pb-8 pt-4">
                <h2 id="mood-modal-title" className="text-center text-sm font-semibold text-neutral-400">
                  {moodPick?.label ?? "Tu mood"}
                </h2>
                {moodLoading ? (
                  <div className="mt-8 flex flex-col items-center gap-3 px-2">
                    <SkeletonShimmer className="h-64 w-full max-w-[220px]" rounded="xl" />
                    <SkeletonShimmer className="h-3 w-3/4 max-w-[200px]" rounded="md" />
                    <p className="text-center text-sm text-neutral-500">Buscando tu peli perfecta…</p>
                  </div>
                ) : moodMovie ? (
                  <>
                    <div className="mx-auto mb-4 mt-4 max-w-[220px] overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]">
                      {moodMovie.posterPath ? (
                        <Image
                          src={`https://image.tmdb.org/t/p/w500${moodMovie.posterPath}`}
                          alt=""
                          width={500}
                          height={750}
                          className="w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-[2/3] items-center justify-center text-sm text-neutral-600">
                          Sin imagen
                        </div>
                      )}
                    </div>
                    <h3 className="text-center text-xl font-semibold text-white">{moodMovie.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-neutral-300">{moodMovie.overview}</p>
                    <MotionButton
                      type="button"
                      disabled={watchlist.includes(watchlistId("movie", moodMovie.id))}
                      onClick={() => {
                        const wid = watchlistId("movie", moodMovie.id);
                        setWatchlist((prev) => {
                          if (prev.includes(wid)) {
                            return prev;
                          }
                          const next = [...prev, wid];
                          const deduped = Array.from(new Set(next));
                          window.localStorage.setItem("watchlist", JSON.stringify(deduped));
                          void logUserActivity({
                            type: "watchlist",
                            movieId: moodMovie.id,
                            movieTitle: moodMovie.title,
                            posterPath: moodMovie.posterPath
                          });
                          return deduped;
                        });
                      }}
                      className="mt-6 w-full rounded-xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {watchlist.includes(watchlistId("movie", moodMovie.id))
                        ? "Ya está en tu watchlist"
                        : "Añadir a watchlist"}
                    </MotionButton>
                  </>
                ) : (
                  <p className="mt-8 text-center text-sm text-neutral-500">No hay resultado ahora mismo.</p>
                )}
                <MotionButton
                  type="button"
                  onClick={closeMoodModal}
                  className="mt-4 w-full rounded-xl border border-[#333] bg-[#1a1a1a] py-3 text-sm font-medium text-neutral-200 transition hover:border-neutral-500"
                >
                  Cerrar
                </MotionButton>
              </div>
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>

        <BottomNav />
      </section>
    </main>
  );
}
