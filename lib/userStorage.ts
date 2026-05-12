"use client";

import { supabase } from "@/lib/supabase";

/** Prefijo de caché local por usuario (evita mezclar cuentas en el mismo navegador). */
export const USER_CACHE_PREFIX = "whatnext:u:";

export function cacheKey(userId: string, key: string): string {
  return `${USER_CACHE_PREFIX}${userId}:${key}`;
}

const JSON_COLUMN_KEYS = new Set([
  "plataformas",
  "valoraciones",
  "watchlist",
  "racha",
  "gustos",
  "perfil_meta"
]);

const META_FIELDS = new Set(["nombre", "apellidos", "email", "peliculas_mes"]);

const LEGACY_META_KEYS = ["nombre", "apellidos", "email", "peliculas_mes"] as const;

const LEGACY_JSON_KEYS = ["plataformas", "valoraciones", "watchlist", "gustos", "username"] as const;

export type RachaPayload = {
  daily?: { lastActiveDate: string; count: number } | null;
  milestonesShown?: number[];
};

let activeStorageUserId: string | null = null;

export function setActiveStorageUserId(userId: string | null): void {
  activeStorageUserId = userId;
}

export function getActiveStorageUserId(): string | null {
  return activeStorageUserId;
}

type ProfileRow = {
  plataformas: unknown;
  valoraciones: unknown;
  watchlist: unknown;
  racha: unknown;
  gustos: unknown;
  perfil_meta: unknown;
  username: string | null;
  full_name: string | null;
};

let profileRowCache: { userId: string; row: ProfileRow | null; at: number } | null = null;
const PROFILE_ROW_TTL_MS = 2500;

/** Logs temporales para depurar sync / escrituras (quitar cuando estabilice). */
const LOG_PREFIX = "[userStorage]";

function invalidateProfileRowCache(): void {
  profileRowCache = null;
}

function isServerJsonColumnEmpty(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === "object") {
    return Object.keys(value as object).length === 0;
  }
  return false;
}

// plataformas: siempre array de ids string en Supabase (p. ej. ["netflix","prime"]).
export function normalizePlataformasForDb(data: unknown): string[] | null {
  if (data === null || data === undefined) {
    return null;
  }
  let raw: unknown = data;
  if (typeof data === "string") {
    raw = parseJsonSafe<unknown>(data);
  }
  if (!Array.isArray(raw)) {
    return null;
  }
  const ids = raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  return ids.length > 0 ? ids : null;
}

function normalizeValoracionesForDb(data: unknown): Record<string, unknown> | null {
  if (data === null || data === undefined) {
    return null;
  }
  let raw: unknown = data;
  if (typeof data === "string") {
    raw = parseJsonSafe<unknown>(data);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  return Object.keys(o).length > 0 ? o : null;
}

function normalizeWatchlistForDb(data: unknown): string[] | null {
  if (data === null || data === undefined) {
    return null;
  }
  let raw: unknown = data;
  if (typeof data === "string") {
    raw = parseJsonSafe<unknown>(data);
  }
  if (!Array.isArray(raw)) {
    return null;
  }
  const ids = raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  return ids.length > 0 ? ids : null;
}

function readLocalJsonColumn(userId: string, column: string): unknown {
  if (typeof window === "undefined") {
    return null;
  }
  const namespaced = window.localStorage.getItem(cacheKey(userId, column));
  if (namespaced) {
    const p = parseJsonSafe<unknown>(namespaced);
    console.log(LOG_PREFIX, "readLocalJsonColumn namespaced", column, "rawLen", namespaced.length, "parsed", p);
    return p ?? namespaced;
  }
  const legacy = window.localStorage.getItem(column);
  if (legacy) {
    const p = parseJsonSafe<unknown>(legacy);
    console.log(LOG_PREFIX, "readLocalJsonColumn legacy", column, "parsed", p);
    return p ?? legacy;
  }
  console.log(LOG_PREFIX, "readLocalJsonColumn empty", column);
  return null;
}

function toCacheString(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }
  return JSON.stringify(data);
}

function parseJsonSafe<T>(raw: string | null): T | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Solo lectura de caché (tras syncAll / save). */
export function readUserDataCache(userId: string | null, key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (!userId) {
    return window.localStorage.getItem(key);
  }
  return window.localStorage.getItem(cacheKey(userId, key));
}

export function readUserDataCacheJson<T>(userId: string | null, key: string): T | null {
  return parseJsonSafe<T>(readUserDataCache(userId, key));
}

function normalizeGustosForDb(data: unknown): Record<string, unknown> | null {
  return normalizeValoracionesForDb(data);
}

function normalizeColumnForDbUpload(column: string, raw: unknown): unknown {
  switch (column) {
    case "plataformas":
      return normalizePlataformasForDb(raw);
    case "valoraciones":
      return normalizeValoracionesForDb(raw);
    case "watchlist":
      return normalizeWatchlistForDb(raw);
    case "gustos":
      return normalizeGustosForDb(raw);
    case "racha":
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        return Object.keys(raw as object).length > 0 ? raw : null;
      }
      return null;
    case "perfil_meta":
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        return Object.keys(raw as object).length > 0 ? raw : null;
      }
      return null;
    default:
      return null;
  }
}

/**
 * Tras sync, fuerza escritura a Supabase de plataformas / valoraciones / watchlist
 * si la caché con prefijo de usuario tiene datos (p. ej. tras migrate desde legacy).
 */
export async function pushPlataformasValoracionesWatchlistFromCache(userId: string): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }
  const pl = normalizePlataformasForDb(readUserDataCacheJson<unknown>(userId, "plataformas"));
  const val = normalizeValoracionesForDb(readUserDataCacheJson<unknown>(userId, "valoraciones"));
  const wl = normalizeWatchlistForDb(readUserDataCacheJson<unknown>(userId, "watchlist"));

  console.log(LOG_PREFIX, "pushFromCache", userId, {
    plataformas: pl,
    valoracionesKeys: val ? Object.keys(val).length : 0,
    watchlistLen: wl?.length ?? 0
  });

  if (pl) {
    await saveUserData(userId, "plataformas", pl);
  }
  if (val) {
    await saveUserData(userId, "valoraciones", val);
  }
  if (wl) {
    await saveUserData(userId, "watchlist", wl);
  }
}

function parseLegacyStreakToRacha(): RachaPayload | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const dailyRaw = window.localStorage.getItem("whatnext-daily-movie-streak");
    const mileRaw = window.localStorage.getItem("whatnext-streak-milestone-banners-shown");
    const out: RachaPayload = {};
    if (dailyRaw) {
      const p = JSON.parse(dailyRaw) as unknown;
      if (
        p &&
        typeof p === "object" &&
        typeof (p as { lastActiveDate?: unknown }).lastActiveDate === "string" &&
        typeof (p as { count?: unknown }).count === "number"
      ) {
        out.daily = p as { lastActiveDate: string; count: number };
      }
    }
    if (mileRaw) {
      const arr = JSON.parse(mileRaw) as unknown;
      if (Array.isArray(arr)) {
        out.milestonesShown = arr.filter((n): n is number => n === 3 || n === 7 || n === 30);
      }
    }
    if (out.daily || (out.milestonesShown && out.milestonesShown.length > 0)) {
      return out;
    }
    return null;
  } catch {
    return null;
  }
}

/** Copia claves legacy sin prefijo a la caché con prefijo de usuario (solo si falta en caché). */
export function migrateLegacyLocalStorageToUser(userId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const ckMeta = cacheKey(userId, "perfil_meta");
  if (!window.localStorage.getItem(ckMeta)) {
    const meta: Record<string, string> = {};
    for (const k of LEGACY_META_KEYS) {
      const v = window.localStorage.getItem(k);
      if (v) {
        meta[k] = v;
      }
    }
    if (Object.keys(meta).length > 0) {
      window.localStorage.setItem(ckMeta, JSON.stringify(meta));
    }
  }
  for (const key of LEGACY_JSON_KEYS) {
    const v = window.localStorage.getItem(key);
    if (!v) {
      continue;
    }
    const ck = cacheKey(userId, key);
    if (!window.localStorage.getItem(ck)) {
      window.localStorage.setItem(ck, v);
    }
  }
  const streakRacha = parseLegacyStreakToRacha();
  if (streakRacha && !window.localStorage.getItem(cacheKey(userId, "racha"))) {
    window.localStorage.setItem(cacheKey(userId, "racha"), JSON.stringify(streakRacha));
  }
}

function applyProfileRowToCache(userId: string, row: ProfileRow): void {
  if (typeof window === "undefined") {
    return;
  }
  const set = (key: string, v: unknown) => {
    if (v === null || v === undefined) {
      return;
    }
    window.localStorage.setItem(cacheKey(userId, key), toCacheString(v));
  };

  set("plataformas", row.plataformas);
  set("valoraciones", row.valoraciones);
  set("watchlist", row.watchlist);
  set("racha", row.racha);
  set("gustos", row.gustos);
  set("perfil_meta", row.perfil_meta);

  if (row.username && typeof row.username === "string" && row.username.trim().length > 0) {
    const u = row.username.trim().replace(/^@/, "");
    window.localStorage.setItem(cacheKey(userId, "username"), `@${u}`);
  }

  if (row.full_name && typeof row.full_name === "string" && row.full_name.trim().length > 0) {
    const metaRaw = window.localStorage.getItem(cacheKey(userId, "perfil_meta"));
    let meta: Record<string, string> = {};
    try {
      if (metaRaw) {
        const parsed = JSON.parse(metaRaw) as Record<string, unknown>;
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === "string") {
            meta[k] = v;
          }
        }
      }
    } catch {
      meta = {};
    }
    if (!meta.nombre?.trim()) {
      const parts = row.full_name.trim().split(/\s+/).filter(Boolean);
      meta.nombre = parts[0] ?? "";
      meta.apellidos = parts.slice(1).join(" ");
      window.localStorage.setItem(cacheKey(userId, "perfil_meta"), JSON.stringify(meta));
    }
  }
}

async function fetchProfileRowCached(userId: string): Promise<ProfileRow | null> {
  const now = Date.now();
  if (
    profileRowCache &&
    profileRowCache.userId === userId &&
    now - profileRowCache.at < PROFILE_ROW_TTL_MS
  ) {
    return profileRowCache.row;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("plataformas, valoraciones, watchlist, racha, gustos, perfil_meta, username, full_name")
    .eq("id", userId)
    .maybeSingle();

  console.log(LOG_PREFIX, "fetchProfileRowCached", { userId, error: error?.message, hasData: Boolean(data) });

  if (error) {
    profileRowCache = { userId, row: null, at: now };
    return null;
  }

  const row = (data ?? null) as ProfileRow | null;
  profileRowCache = { userId, row, at: now };
  return row;
}

/**
 * Descarga perfil → caché local; migra legacy; si Supabase tiene columnas JSON vacías,
 * sube datos desde localStorage (namespaced o legacy).
 */
export async function syncAllUserData(userId: string): Promise<void> {
  console.log(LOG_PREFIX, "syncAllUserData start", userId);
  const row = await fetchProfileRowCached(userId);
  if (row) {
    console.log(LOG_PREFIX, "server row snapshot", {
      plataformas: row.plataformas,
      valoracionesType: typeof row.valoraciones,
      valoracionesKeys:
        row.valoraciones && typeof row.valoraciones === "object" && !Array.isArray(row.valoraciones)
          ? Object.keys(row.valoraciones as object).length
          : row.valoraciones,
      watchlist: row.watchlist
    });
    applyProfileRowToCache(userId, row);
  } else {
    console.warn(LOG_PREFIX, "no profile row (offline o sin fila)");
  }

  migrateLegacyLocalStorageToUser(userId);
  console.log(LOG_PREFIX, "after migrateLegacy", {
    plataformasCache: readUserDataCache(userId, "plataformas")?.slice(0, 120),
    watchlistCache: readUserDataCache(userId, "watchlist")?.slice(0, 120)
  });

  const jsonCols = ["plataformas", "valoraciones", "watchlist", "gustos", "racha", "perfil_meta"] as const;

  const tryBackfill = async (col: (typeof jsonCols)[number]) => {
    const serverVal = row ? (row as Record<string, unknown>)[col] : undefined;
    if (!isServerJsonColumnEmpty(serverVal)) {
      console.log(LOG_PREFIX, "backfill skip (server has data)", col);
      return;
    }
    const raw = readLocalJsonColumn(userId, col);
    const normalized = normalizeColumnForDbUpload(col, raw);
    if (normalized === null || normalized === undefined) {
      console.log(LOG_PREFIX, "backfill skip (no local)", col);
      return;
    }
    console.log(LOG_PREFIX, "backfill UPLOAD", col, normalized);
    invalidateProfileRowCache();
    const { error: upErr } = await supabase.from("profiles").update({ [col]: normalized }).eq("id", userId);
    if (upErr) {
      console.error(LOG_PREFIX, "backfill update error", col, upErr);
      return;
    }
    window.localStorage.setItem(cacheKey(userId, col), JSON.stringify(normalized));
    console.log(LOG_PREFIX, "backfill OK + cache updated", col);
  };

  for (const col of jsonCols) {
    await tryBackfill(col);
  }

  invalidateProfileRowCache();
  console.log(LOG_PREFIX, "syncAllUserData end");
}

function pickValueFromRow(row: ProfileRow | null, key: string): string | null {
  if (!row) {
    return null;
  }
  if (key === "username" && row.username) {
    return `@${String(row.username).replace(/^@/, "")}`;
  }
  if (META_FIELDS.has(key)) {
    const meta = row.perfil_meta;
    if (meta && typeof meta === "object" && key in (meta as object)) {
      const v = (meta as Record<string, unknown>)[key];
      if (typeof v === "string") {
        return v;
      }
      if (v !== null && v !== undefined) {
        return String(v);
      }
    }
    return null;
  }
  if (JSON_COLUMN_KEYS.has(key)) {
    const v = (row as Record<string, unknown>)[key];
    if (v === null || v === undefined) {
      return null;
    }
    return toCacheString(v);
  }
  return null;
}

/**
 * Intenta Supabase primero; si falla o no hay fila, usa caché local (o claves legacy si no hay userId).
 */
export async function loadUserData(userId: string | null, key: string): Promise<string | null> {
  if (typeof window === "undefined") {
    return null;
  }

  if (!userId) {
    return window.localStorage.getItem(key);
  }

  const row = await fetchProfileRowCached(userId);
  if (row) {
    const fromServer = pickValueFromRow(row, key);
    if (fromServer !== null && fromServer !== undefined && fromServer !== "") {
      if (key === "username") {
        window.localStorage.setItem(cacheKey(userId, "username"), fromServer);
        return fromServer;
      }
      if (META_FIELDS.has(key)) {
        const meta = (row.perfil_meta && typeof row.perfil_meta === "object"
          ? (row.perfil_meta as Record<string, unknown>)
          : {}) as Record<string, unknown>;
        window.localStorage.setItem(cacheKey(userId, "perfil_meta"), JSON.stringify(meta));
        const v = meta[key];
        return typeof v === "string" ? v : v != null ? String(v) : null;
      }
      if (JSON_COLUMN_KEYS.has(key)) {
        window.localStorage.setItem(cacheKey(userId, key), fromServer);
        return fromServer;
      }
    }
  }

  if (META_FIELDS.has(key)) {
    const meta = readUserDataCacheJson<Record<string, string>>(userId, "perfil_meta");
    return meta?.[key] ?? null;
  }

  return readUserDataCache(userId, key);
}

export async function loadUserDataJson<T>(userId: string | null, key: string): Promise<T | null> {
  const raw = await loadUserData(userId, key);
  return parseJsonSafe<T>(raw);
}

/**
 * Guarda en caché local y persiste en Supabase cuando hay userId.
 */
export async function saveUserData(userId: string | null, key: string, data: unknown): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  const serial = toCacheString(data);

  if (!userId) {
    window.localStorage.setItem(key, serial);
    return;
  }

  if (key === "username") {
    const s = typeof data === "string" ? data : serial;
    const display = s.startsWith("@") ? s : `@${s}`;
    window.localStorage.setItem(cacheKey(userId, "username"), display);
    const clean = display.replace(/^@/, "").trim();
    invalidateProfileRowCache();
    await supabase.from("profiles").upsert({ id: userId, username: clean }, { onConflict: "id" });
    return;
  }

  if (META_FIELDS.has(key)) {
    const row = await fetchProfileRowCached(userId);
    let prev: Record<string, string> = {};
    const rawMeta = readUserDataCache(userId, "perfil_meta");
    if (rawMeta) {
      try {
        const p = JSON.parse(rawMeta) as Record<string, unknown>;
        for (const [k, v] of Object.entries(p)) {
          if (typeof v === "string") {
            prev[k] = v;
          }
        }
      } catch {
        prev = {};
      }
    }
    if (Object.keys(prev).length === 0 && row?.perfil_meta && typeof row.perfil_meta === "object") {
      for (const [k, v] of Object.entries(row.perfil_meta as Record<string, unknown>)) {
        if (typeof v === "string") {
          prev[k] = v;
        }
      }
    }
    const nextMeta = { ...prev, [key]: typeof data === "string" ? data : String(data) };
    window.localStorage.setItem(cacheKey(userId, "perfil_meta"), JSON.stringify(nextMeta));
    invalidateProfileRowCache();
    await supabase.from("profiles").update({ perfil_meta: nextMeta }).eq("id", userId);
    return;
  }

  if (JSON_COLUMN_KEYS.has(key)) {
    let payload: unknown = typeof data === "string" ? parseJsonSafe<unknown>(data) ?? data : data;
    if (key === "plataformas") {
      payload = normalizePlataformasForDb(payload);
    } else if (key === "valoraciones") {
      payload = normalizeValoracionesForDb(payload);
    } else if (key === "watchlist") {
      payload = normalizeWatchlistForDb(payload);
    } else if (key === "gustos") {
      payload = normalizeGustosForDb(payload);
    }
    if (
      (key === "plataformas" || key === "watchlist") &&
      (payload === null || (Array.isArray(payload) && payload.length === 0))
    ) {
      console.warn(LOG_PREFIX, "saveUserData skip empty array column", key);
      return;
    }
    if (key === "valoraciones" || key === "gustos") {
      if (!payload || typeof payload !== "object" || Array.isArray(payload) || Object.keys(payload).length === 0) {
        console.warn(LOG_PREFIX, "saveUserData skip empty object column", key);
        return;
      }
    }

    const serialOut = typeof payload === "string" ? payload : JSON.stringify(payload);
    window.localStorage.setItem(cacheKey(userId, key), serialOut);
    invalidateProfileRowCache();
    console.log(LOG_PREFIX, "saveUserData UPDATE", key, "payload", payload);
    const { error: upErr } = await supabase.from("profiles").update({ [key]: payload }).eq("id", userId);
    if (upErr) {
      console.error(LOG_PREFIX, "saveUserData update error", key, upErr);
    } else {
      console.log(LOG_PREFIX, "saveUserData update ok", key);
    }
    return;
  }

  window.localStorage.setItem(cacheKey(userId, key), serial);
}
