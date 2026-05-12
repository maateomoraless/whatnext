"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchJson, TMDB_API_KEY } from "@/components/TmdbDetailSheet";
import type { MediaType } from "@/components/TmdbDetailSheet";
import { supabase } from "@/lib/supabase";
import {
  readUserDataCache,
  readUserDataCacheJson,
  saveUserData,
  setActiveStorageUserId,
  syncAllUserData
} from "@/lib/userStorage";
import { parseRatedAtMs, sortHistoryByRecency, type HistoryRow } from "@/lib/historyValoraciones";
import { BottomNav } from "@/components/BottomNav";

type GustosSelection = Record<string, string[]>;

type WatchlistRow = {
  watchlistId: string;
  title: string;
  posterPath: string | null;
  media: MediaType;
};

type PlatformDef = { id: string; name: string; color: string };

const PLATFORMS: PlatformDef[] = [
  { id: "netflix", name: "Netflix", color: "#E50914" },
  { id: "disney_plus", name: "Disney+", color: "#0063e5" },
  { id: "max", name: "Max", color: "#5822B4" },
  { id: "prime", name: "Prime", color: "#00A8E0" },
  { id: "apple_tv_plus", name: "Apple TV+", color: "#555555" },
  { id: "filmin", name: "Filmin", color: "#e8175d" }
];

const GUSTOS_SECTION_ORDER = [
  "generos",
  "tematica",
  "tiempo",
  "ambiente",
  "formato",
  "epoca",
  "idioma"
] as const;

const PILL_COLORS: Record<string, Record<string, string>> = {
  generos: {
    Acción: "#FF4500",
    Drama: "#4A90D9",
    Comedia: "#FFD700",
    Terror: "#8B0000",
    "Sci-fi": "#00CED1",
    Documental: "#808080",
    Thriller: "#800080",
    Animación: "#FF69B4",
    Romance: "#FF1493",
    Fantasía: "#9370DB"
  },
  tematica: {
    "Mafia y crimen": "#8B0000",
    Superhéroes: "#FF4500",
    "Política y poder": "#1C3A6B",
    "Moda y lujo": "#FFD700",
    Deportes: "#00A550",
    Espías: "#333333",
    "Cocina y gastronomía": "#FF8C00",
    "Guerras e historia": "#8B7355",
    "Música y cultura": "#9400D3",
    "True crime": "#DC143C",
    "Viajes y naturaleza": "#228B22",
    "Startups y tecnología": "#00BFFF"
  },
  tiempo: {
    "Menos de 1h 30": "#00CED1",
    "1h 30 — 2h": "#4A90D9",
    "Más de 2h": "#9370DB",
    "Me da igual": "#808080"
  },
  ambiente: {
    "Para desconectar": "#228B22",
    "Para pensar": "#4A90D9",
    "Para reír": "#FFD700",
    "Para emocionarme": "#FF1493",
    "Adrenalina pura": "#FF4500",
    "Ver en familia": "#FF8C00"
  },
  formato: {
    "Solo películas": "#E50914",
    "Solo series": "#00A8E0",
    "Las dos": "#9370DB"
  },
  epoca: {
    Clásicos: "#8B7355",
    "2000s": "#FF69B4",
    "Últimos 5 años": "#00CED1",
    "Lo más reciente": "#00A550"
  },
  idioma: {
    Español: "#AA151B",
    Inglés: "#00247D",
    "Cine europeo": "#FFD700",
    Asiático: "#DC143C",
    "Me da igual": "#808080"
  }
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

const MOVIE_META_BY_ID: Record<string, { genre: string }> = {
  "el-padrino": { genre: "Crimen" },
  "pulp-fiction": { genre: "Thriller" },
  inception: { genre: "Sci-fi" },
  interstellar: { genre: "Sci-fi" },
  "the-dark-knight": { genre: "Acción" },
  "forrest-gump": { genre: "Drama" },
  titanic: { genre: "Romance" },
  matrix: { genre: "Sci-fi" },
  gladiator: { genre: "Acción" },
  oppenheimer: { genre: "Drama" }
};

const TMDB_GENRE_BY_ID: Record<number, string> = {
  28: "Acción",
  12: "Aventura",
  16: "Animación",
  35: "Comedia",
  80: "Crimen",
  99: "Documental",
  18: "Drama",
  10751: "Familia",
  14: "Fantasía",
  36: "Historia",
  27: "Terror",
  10402: "Música",
  9648: "Misterio",
  10749: "Romance",
  878: "Ciencia ficción",
  10770: "Película de TV",
  53: "Suspense",
  10752: "Bélica",
  37: "Western"
};

type RatingValue = {
  rating: number;
  unseen?: boolean;
  genreIds?: number[];
  title?: string;
  ratedAt?: string;
};

function sanitizeUsernameInput(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 20);
}

type GustosModalSection = {
  id: string;
  title: string;
  options: string[];
  single?: boolean;
};

const GUSTOS_MODAL_SECTIONS: GustosModalSection[] = [
  {
    id: "generos",
    title: "Géneros",
    options: [
      "Acción",
      "Drama",
      "Comedia",
      "Terror",
      "Sci-fi",
      "Documental",
      "Thriller",
      "Animación",
      "Romance",
      "Fantasía"
    ]
  },
  {
    id: "tematica",
    title: "Temática",
    options: [
      "Mafia y crimen",
      "Superhéroes",
      "Política y poder",
      "Moda y lujo",
      "Deportes",
      "Espías",
      "Cocina y gastronomía",
      "Guerras e historia",
      "Música y cultura",
      "True crime",
      "Viajes y naturaleza",
      "Startups y tecnología"
    ]
  },
  {
    id: "ambiente",
    title: "Ambiente",
    options: [
      "Para desconectar",
      "Para pensar",
      "Para reír",
      "Para emocionarme",
      "Adrenalina pura",
      "Ver en familia"
    ]
  },
  {
    id: "epoca",
    title: "Época",
    options: ["Clásicos", "2000s", "Últimos 5 años", "Lo más reciente"]
  },
  {
    id: "idioma",
    title: "Idioma original",
    options: ["Español", "Inglés", "Cine europeo", "Asiático", "Me da igual"]
  }
];

function createEmptyGustosModalDraft(): GustosSelection {
  return GUSTOS_MODAL_SECTIONS.reduce<GustosSelection>((acc, section) => {
    acc[section.id] = [];
    return acc;
  }, {});
}

async function persistGustosToSupabase(userId: string, taste: GustosSelection): Promise<void> {
  const parsed = readUserDataCacheJson<string[]>(userId, "plataformas");
  const plataformas = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  await supabase.from("profiles").update({ gustos: { ...taste, plataformas } }).eq("id", userId);
}

function slugFromNombre(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return s.length > 0 ? s : "usuario";
}

function initialsFromNombre(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function parseWatchlistToTmdb(watchlistId: string): { media: MediaType; id: number } | null {
  const moviePref = watchlistId.match(/^movie-(\d+)$/);
  if (moviePref) {
    return { media: "movie", id: Number(moviePref[1]) };
  }
  const tvPref = watchlistId.match(/^tv-(\d+)$/);
  if (tvPref) {
    return { media: "tv", id: Number(tvPref[1]) };
  }
  const suffix = watchlistId.split("-").pop();
  if (suffix && /^\d+$/.test(suffix)) {
    return { media: "movie", id: Number(suffix) };
  }
  return null;
}

function starsDisplay(n: number): string {
  const r = Math.min(5, Math.max(0, Math.round(n)));
  return `${"★".repeat(r)}${"☆".repeat(5 - r)}`;
}

type AuthProfile = {
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
};

export default function PerfilPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [apellidosLocal, setApellidosLocal] = useState("");
  const [emailLocal, setEmailLocal] = useState("");
  const [authProfile, setAuthProfile] = useState<AuthProfile | null>(null);
  const [platformIds, setPlatformIds] = useState<string[]>([]);
  const [gustos, setGustos] = useState<GustosSelection>({});
  const [valoraciones, setValoraciones] = useState<Record<string, RatingValue>>({});
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [watchlistRows, setWatchlistRows] = useState<WatchlistRow[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileUsername, setProfileUsername] = useState("");
  const [usernameEditing, setUsernameEditing] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameAvailability, setUsernameAvailability] = useState<
    "idle" | "checking" | "available" | "taken" | "error"
  >("idle");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [platformsModalOpen, setPlatformsModalOpen] = useState(false);
  const [platformDraft, setPlatformDraft] = useState<string[]>([]);
  const [gustosModalOpen, setGustosModalOpen] = useState(false);
  const [gustosModalDraft, setGustosModalDraft] = useState<GustosSelection>(() => createEmptyGustosModalDraft());
  const avatarFileRef = useRef<HTMLInputElement>(null);

  const reloadAuthProfile = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
      setAuthProfile(null);
      return;
    }
    const meta = user.user_metadata ?? {};
    const fullName = typeof meta.full_name === "string" ? meta.full_name : "";
    const firstName = typeof meta.first_name === "string" ? meta.first_name : "";
    const lastName = typeof meta.last_name === "string" ? meta.last_name : "";
    setAuthProfile({
      fullName,
      firstName,
      lastName,
      email: user.email ?? ""
    });
  }, []);

  const reloadStorage = useCallback((overrideUserId?: string | null) => {
    const id = overrideUserId ?? userId;
    if (!id) {
      return;
    }
    try {
      const meta = readUserDataCacheJson<{ nombre?: string; apellidos?: string; email?: string }>(
        id,
        "perfil_meta"
      );
      setNombre(meta?.nombre ?? "");
      setApellidosLocal(meta?.apellidos ?? "");
      setEmailLocal(meta?.email ?? "");
      const storedUser = readUserDataCache(id, "username");
      if (storedUser) {
        setProfileUsername(sanitizeUsernameInput(storedUser.replace(/^@/, "")));
      }
      const parsedPlatforms = readUserDataCacheJson<string[]>(id, "plataformas");
      if (parsedPlatforms && Array.isArray(parsedPlatforms)) {
        setPlatformIds(parsedPlatforms.filter((x): x is string => typeof x === "string"));
      }
      const parsedGustos = readUserDataCacheJson<Record<string, unknown>>(id, "gustos");
      if (parsedGustos) {
        const next: GustosSelection = {};
        Object.entries(parsedGustos).forEach(([k, v]) => {
          if (k === "plataformas" || !Array.isArray(v)) {
            return;
          }
          next[k] = v.filter((item): item is string => typeof item === "string");
        });
        setGustos(next);
      }
      const vParsed = readUserDataCacheJson<Record<string, RatingValue>>(id, "valoraciones");
      if (vParsed) {
        setValoraciones(vParsed);
      } else {
        setValoraciones({});
      }
      const wParsed = readUserDataCacheJson<string[]>(id, "watchlist");
      if (wParsed && Array.isArray(wParsed)) {
        setWatchlist(wParsed.filter((x): x is string => typeof x === "string"));
      } else {
        setWatchlist([]);
      }
    } catch {
      /* ignore */
    }
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        return;
      }
      setUserId(user.id);
      setActiveStorageUserId(user.id);
      await syncAllUserData(user.id);
      const { data: row } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) {
        return;
      }
      if (row?.username && typeof row.username === "string" && row.username.trim().length > 0) {
        setProfileUsername(row.username.trim());
      }
      if (row?.avatar_url && typeof row.avatar_url === "string") {
        setAvatarUrl(row.avatar_url.trim());
      }
      reloadStorage(user.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadStorage]);

  useEffect(() => {
    const u = usernameDraft.trim();
    if (u.length < 3) {
      setUsernameAvailability("idle");
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void (async () => {
        setUsernameAvailability("checking");
        const currentUserId = userId;
        const { data, error } = await supabase.from("profiles").select("id").eq("username", u).limit(1);
        if (cancelled) {
          return;
        }
        if (error) {
          setUsernameAvailability("error");
          return;
        }
        const row = data?.[0];
        if (!row) {
          setUsernameAvailability("available");
          return;
        }
        setUsernameAvailability(currentUserId && row.id === currentUserId ? "available" : "taken");
      })();
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [usernameDraft, userId]);

  useEffect(() => {
    reloadStorage();
    void reloadAuthProfile();
    const onFocus = () => {
      reloadStorage();
      void reloadAuthProfile();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reloadStorage, reloadAuthProfile]);

  const displayNombreCompleto = useMemo(() => {
    const fromParts = [authProfile?.firstName, authProfile?.lastName].filter(Boolean).join(" ").trim();
    if (fromParts.length > 0) {
      return fromParts;
    }
    if (authProfile?.fullName?.trim()) {
      return authProfile.fullName.trim();
    }
    return `${nombre.trim()} ${apellidosLocal.trim()}`.trim();
  }, [authProfile, nombre, apellidosLocal]);

  const displayEmail = useMemo(() => {
    const fromAuth = authProfile?.email?.trim();
    if (fromAuth) {
      return fromAuth;
    }
    return emailLocal.trim();
  }, [authProfile, emailLocal]);

  const displayHandle = useMemo(() => {
    const u = profileUsername.trim();
    if (u.length > 0) {
      return `@${u}`;
    }
    return `@${slugFromNombre(displayNombreCompleto || nombre)}`;
  }, [profileUsername, displayNombreCompleto, nombre]);

  const ratedEntries = useMemo(
    () =>
      Object.entries(valoraciones).filter(
        ([, row]) => row && !row.unseen && typeof row.rating === "number" && row.rating > 0
      ),
    [valoraciones]
  );

  const peliculasVistas = useMemo(
    () =>
      ratedEntries.filter(([key]) => key.startsWith("tmdb-") || TMDB_ID_BY_ONBOARDING[key] != null).length,
    [ratedEntries]
  );

  const seriesVistas = useMemo(() => ratedEntries.filter(([key]) => key.startsWith("tv-")).length, [ratedEntries]);

  const mediaValoracion = useMemo(() => {
    if (ratedEntries.length === 0) {
      return 0;
    }
    const sum = ratedEntries.reduce((acc, [, v]) => acc + v.rating, 0);
    return sum / ratedEntries.length;
  }, [ratedEntries]);

  const ratedMoviesForStats = ratedEntries;

  const avgRatingDashboard = mediaValoracion;

  const favoriteGenre = useMemo(() => {
    if (ratedMoviesForStats.length === 0) {
      return "—";
    }
    const highestRating = ratedMoviesForStats.reduce((max, [, value]) => Math.max(max, value.rating), 0);
    const highestRated = ratedMoviesForStats.filter(([, value]) => value.rating === highestRating);
    const genreCounts: Record<string, number> = {};

    highestRated.forEach(([movieId, value]) => {
      let label = "Otros";
      if (movieId.startsWith("tmdb-") || movieId.startsWith("tv-")) {
        const gid = value.genreIds?.[0];
        label = gid != null ? TMDB_GENRE_BY_ID[gid] ?? "Otros" : "Otros";
      } else if (MOVIE_META_BY_ID[movieId]) {
        label = MOVIE_META_BY_ID[movieId].genre;
      }
      genreCounts[label] = (genreCounts[label] ?? 0) + 1;
    });

    return Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  }, [ratedMoviesForStats]);

  const gustosPills = useMemo(() => {
    const out: { section: string; label: string; color: string }[] = [];
    for (const section of GUSTOS_SECTION_ORDER) {
      const opts = gustos[section] ?? [];
      const cmap = PILL_COLORS[section] ?? {};
      opts.forEach((label) => {
        out.push({ section, label, color: cmap[label] ?? "#737373" });
      });
    }
    return out;
  }, [gustos]);

  useEffect(() => {
    const ac = new AbortController();
    async function loadHistory() {
      const entries = Object.entries(valoraciones).filter(
        ([, v]) => v && !v.unseen && typeof v.rating === "number" && v.rating > 0
      );
      if (entries.length === 0) {
        setHistoryRows([]);
        setHistoryLoading(false);
        return;
      }
      setHistoryLoading(true);
      const base = `https://api.themoviedb.org/3`;
      const key = TMDB_API_KEY;

      const rows = await Promise.all(
        entries.map(async ([storageKey, v]): Promise<HistoryRow | null> => {
          let media: MediaType = "movie";
          let id: number | null = null;
          if (storageKey.startsWith("tmdb-")) {
            id = Number(storageKey.slice(5));
            media = "movie";
          } else if (storageKey.startsWith("tv-")) {
            id = Number(storageKey.slice(3));
            media = "tv";
          } else {
            id = TMDB_ID_BY_ONBOARDING[storageKey] ?? null;
            media = "movie";
          }
          if (id == null || !Number.isFinite(id)) {
            return null;
          }
          const url =
            media === "movie"
              ? `${base}/movie/${id}?api_key=${key}&language=es-ES`
              : `${base}/tv/${id}?api_key=${key}&language=es-ES`;
          const data = await fetchJson<{ title?: string; name?: string; poster_path?: string | null }>(
            url,
            ac.signal
          );
          if (ac.signal.aborted) {
            return null;
          }
          const title =
            (typeof v.title === "string" && v.title.trim().length > 0 ? v.title.trim() : null) ??
            data?.title ??
            data?.name ??
            "Sin título";
          return {
            key: storageKey,
            title,
            posterPath: data?.poster_path ?? null,
            stars: Math.round(v.rating),
            media,
            tmdbId: id,
            ratedAtMs: parseRatedAtMs(v.ratedAt)
          };
        })
      );
      if (!ac.signal.aborted) {
        const valid = rows.filter((x): x is HistoryRow => x != null);
        setHistoryRows(sortHistoryByRecency(valid).slice(0, 4));
        setHistoryLoading(false);
      }
    }
    loadHistory();
    return () => ac.abort();
  }, [valoraciones]);

  useEffect(() => {
    const ac = new AbortController();
    async function loadWl() {
      const unique = Array.from(new Set(watchlist));
      if (unique.length === 0) {
        setWatchlistRows([]);
        setWatchlistLoading(false);
        return;
      }
      setWatchlistLoading(true);
      const base = `https://api.themoviedb.org/3`;
      const key = TMDB_API_KEY;

      const rows = await Promise.all(
        unique.map(async (wid): Promise<WatchlistRow | null> => {
          const parsed = parseWatchlistToTmdb(wid);
          if (!parsed) {
            return { watchlistId: wid, title: wid, posterPath: null, media: "movie" };
          }
          const url =
            parsed.media === "movie"
              ? `${base}/movie/${parsed.id}?api_key=${key}&language=es-ES`
              : `${base}/tv/${parsed.id}?api_key=${key}&language=es-ES`;
          const data = await fetchJson<{ title?: string; name?: string; poster_path?: string | null }>(
            url,
            ac.signal
          );
          if (ac.signal.aborted) {
            return null;
          }
          return {
            watchlistId: wid,
            title: data?.title ?? data?.name ?? `TMDB ${parsed.id}`,
            posterPath: data?.poster_path ?? null,
            media: parsed.media
          };
        })
      );
      if (!ac.signal.aborted) {
        setWatchlistRows(rows.filter((x): x is WatchlistRow => x != null));
        setWatchlistLoading(false);
      }
    }
    loadWl();
    return () => ac.abort();
  }, [watchlist]);

  const openPlatformsModal = () => {
    setPlatformDraft([...platformIds]);
    setPlatformsModalOpen(true);
  };

  const togglePlatformInDraft = (id: string) => {
    setPlatformDraft((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const savePlatformsModal = async () => {
    const next = [...platformDraft];
    setPlatformIds(next);
    if (userId) {
      await saveUserData(userId, "plataformas", next);
      await persistGustosToSupabase(userId, gustos);
    }
    setPlatformsModalOpen(false);
  };

  const openGustosModal = () => {
    const draft = createEmptyGustosModalDraft();
    for (const section of GUSTOS_MODAL_SECTIONS) {
      draft[section.id] = [...(gustos[section.id] ?? [])];
    }
    setGustosModalDraft(draft);
    setGustosModalOpen(true);
  };

  const toggleGustosModalOption = (sectionId: string, option: string, single?: boolean) => {
    setGustosModalDraft((prev) => {
      const cur = prev[sectionId] ?? [];
      if (single) {
        return { ...prev, [sectionId]: cur.includes(option) ? [] : [option] };
      }
      const nextSel = cur.includes(option) ? cur.filter((x) => x !== option) : [...cur, option];
      return { ...prev, [sectionId]: nextSel };
    });
  };

  const saveGustosModal = async () => {
    const merged: GustosSelection = { ...gustos };
    for (const section of GUSTOS_MODAL_SECTIONS) {
      merged[section.id] = [...(gustosModalDraft[section.id] ?? [])];
    }
    setGustos(merged);
    if (userId) {
      await saveUserData(userId, "gustos", merged);
      await persistGustosToSupabase(userId, merged);
    }
    setGustosModalOpen(false);
  };

  const saveUsernameInline = async () => {
    if (usernameSaving) {
      return;
    }
    const clean = sanitizeUsernameInput(usernameDraft);
    if (
      clean.length < 3 ||
      usernameAvailability === "taken" ||
      usernameAvailability === "checking" ||
      usernameAvailability === "error" ||
      (clean.length >= 3 && usernameAvailability === "idle")
    ) {
      return;
    }
    setUsernameSaving(true);
    if (userId) {
      await saveUserData(userId, "username", `@${clean}`);
    }
    setProfileUsername(clean);
    setUsernameSaving(false);
    setUsernameEditing(false);
  };

  const onAvatarFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !userId || !file.type.startsWith("image/")) {
      return;
    }
    setAvatarUploading(true);
    const ext = (file.name.split(".").pop() ?? "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "jpg";
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
      contentType: file.type || "image/jpeg"
    });
    if (upErr) {
      setAvatarUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = pub.publicUrl;
    await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
    setAvatarUrl(url);
    setAvatarUploading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const shareApp = async () => {
    const url = typeof window !== "undefined" ? window.location.origin : "";
    const payload = {
      title: "WhatNext?",
      text: "Comparte la app con alguien que pierda tiempo buscando qué ver.",
      url: url || undefined
    };
    try {
      if (navigator.share) {
        await navigator.share(payload);
      } else if (navigator.clipboard?.writeText && url) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* user cancelled or unavailable */
    }
  };

  return (
    <main className="flex min-h-screen justify-center bg-[#0a0a0a] px-6 pb-28 text-white">
      <div className="relative w-full max-w-[400px] pt-10">
        <p className="mb-8 w-full text-center text-xs uppercase tracking-[0.35em] text-neutral-500 select-none">WhatNext?</p>

        <section className="mb-10 flex flex-col items-center">
          <div className="relative h-24 w-24 flex-shrink-0">
            <input
              ref={avatarFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => void onAvatarFileChange(e)}
            />
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#262626] text-2xl font-bold text-white">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL dinámico de Supabase Storage
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span>{initialsFromNombre(displayNombreCompleto || nombre)}</span>
              )}
            </div>
            <button
              type="button"
              disabled={!userId || avatarUploading}
              onClick={() => avatarFileRef.current?.click()}
              className="absolute inset-x-0 bottom-0 rounded-b-full bg-black/65 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white transition hover:bg-black/80 disabled:opacity-40"
            >
              {avatarUploading ? "Subiendo…" : "Subir foto"}
            </button>
          </div>
          <dl className="mt-4 w-full space-y-3 text-center">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-neutral-500">Nombre completo</dt>
              <dd className="mt-1 text-xl font-semibold text-white">
                {displayNombreCompleto || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-neutral-500">Email</dt>
              <dd className="mt-1 break-all text-sm text-neutral-300">{displayEmail || "—"}</dd>
            </div>
          </dl>

          {!usernameEditing ? (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <p className="text-sm text-neutral-500">{displayHandle}</p>
              <button
                type="button"
                onClick={() => {
                  const seed =
                    profileUsername.trim() || slugFromNombre(displayNombreCompleto || nombre);
                  setUsernameDraft(sanitizeUsernameInput(seed));
                  setUsernameEditing(true);
                }}
                className="rounded-lg border border-neutral-600 px-2.5 py-1 text-xs font-medium text-neutral-200 transition hover:border-neutral-400 hover:text-white"
              >
                Editar
              </button>
            </div>
          ) : (
            <div className="mt-3 w-full max-w-sm space-y-2 rounded-xl border border-[#2a2a2a] bg-[#101010] px-3 py-3">
              <label className="block text-[11px] uppercase tracking-wide text-neutral-500">Usuario</label>
              <div className="flex items-center gap-1 rounded-lg border border-neutral-600 bg-black px-2 py-2">
                <span className="text-neutral-400">@</span>
                <input
                  type="text"
                  inputMode="text"
                  autoComplete="username"
                  value={usernameDraft}
                  onChange={(e) => setUsernameDraft(sanitizeUsernameInput(e.target.value))}
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
                  maxLength={20}
                />
              </div>
              <p className="min-h-[18px] text-xs">
                {usernameDraft.trim().length < 3 ? (
                  <span className="text-neutral-500">Mínimo 3 caracteres</span>
                ) : usernameAvailability === "checking" ? (
                  <span className="text-neutral-400">Comprobando…</span>
                ) : usernameAvailability === "available" ? (
                  <span className="text-emerald-400">Disponible</span>
                ) : usernameAvailability === "taken" ? (
                  <span className="text-red-400">Ya está en uso</span>
                ) : usernameAvailability === "error" ? (
                  <span className="text-red-400">No se pudo comprobar</span>
                ) : null}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void saveUsernameInline()}
                  disabled={
                    usernameSaving ||
                    sanitizeUsernameInput(usernameDraft).length < 3 ||
                    usernameAvailability === "taken" ||
                    usernameAvailability === "checking" ||
                    usernameAvailability === "error" ||
                    (sanitizeUsernameInput(usernameDraft).length >= 3 && usernameAvailability === "idle")
                  }
                  className="flex-1 rounded-lg bg-white py-2 text-xs font-semibold text-black transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {usernameSaving ? "Guardando…" : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => setUsernameEditing(false)}
                  className="rounded-lg border border-neutral-600 px-3 py-2 text-xs font-medium text-neutral-200 hover:border-neutral-400 hover:text-white"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 grid w-full grid-cols-3 gap-2">
            <div className="rounded-xl border border-[#2a2a2a] bg-[#101010] px-2 py-3 text-center">
              <p className="text-xl font-bold text-[#4A90D9]">{peliculasVistas}</p>
              <p className="mt-1 text-[10px] leading-tight text-neutral-500">películas vistas</p>
            </div>
            <div className="rounded-xl border border-[#2a2a2a] bg-[#101010] px-2 py-3 text-center">
              <p className="text-xl font-bold text-[#00A550]">{seriesVistas}</p>
              <p className="mt-1 text-[10px] leading-tight text-neutral-500">series vistas</p>
            </div>
            <div className="rounded-xl border border-[#2a2a2a] bg-[#101010] px-2 py-3 text-center">
              <p className="text-xl font-bold text-[#fbbf24]">{ratedEntries.length === 0 ? "—" : mediaValoracion.toFixed(1)}</p>
              <p className="mt-1 text-[10px] leading-tight text-neutral-500">media valoración</p>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Tus plataformas</h2>
            <button
              type="button"
              onClick={() => openPlatformsModal()}
              className="text-sm font-medium text-neutral-400 underline-offset-2 hover:text-white hover:underline"
            >
              Editar
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {platformIds.length === 0 ? (
              <p className="text-sm text-neutral-500">No has elegido plataformas aún.</p>
            ) : (
              platformIds.map((pid) => {
                const p = PLATFORMS.find((x) => x.id === pid);
                if (!p) {
                  return (
                    <span key={pid} className="rounded-lg border border-[#333] px-3 py-2 text-xs text-neutral-300">
                      {pid}
                    </span>
                  );
                }
                return (
                  <span
                    key={pid}
                    className="rounded-lg border-2 bg-black px-3 py-2 text-xs font-semibold text-white"
                    style={{ borderColor: p.color }}
                  >
                    {p.name}
                  </span>
                );
              })
            )}
          </div>
        </section>

        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-white">Tus gustos</h2>
            <button
              type="button"
              onClick={() => openGustosModal()}
              className="flex-shrink-0 rounded-lg border border-neutral-600 px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:border-neutral-400 hover:text-white"
            >
              Editar gustos
            </button>
          </div>
          {gustosPills.length === 0 ? (
            <p className="text-sm text-neutral-500">Aún no definiste gustos.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {gustosPills.map((pill) => (
                <span
                  key={`${pill.section}-${pill.label}`}
                  className="rounded-full border px-3 py-1.5 text-xs font-medium text-white"
                  style={{
                    borderColor: pill.color,
                    backgroundColor: `${pill.color}33`
                  }}
                >
                  {pill.label}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-base font-semibold text-white">Tu año en números</h2>
          <div className="grid grid-cols-3 gap-2">
            <article className="flex min-h-[108px] flex-col items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#101010] px-2 py-3 text-center">
              <p className="text-2xl font-bold text-[#4A90D9]">{ratedMoviesForStats.length}</p>
              <p className="mt-1 text-[11px] text-neutral-400">valoradas</p>
            </article>
            <article className="flex min-h-[108px] flex-col items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#101010] px-2 py-3 text-center">
              <p className="text-2xl font-bold text-[#00A550]">
                {ratedMoviesForStats.length === 0 ? "—" : avgRatingDashboard.toFixed(1)}
              </p>
              <p className="mt-1 text-[11px] text-neutral-400">media</p>
            </article>
            <article className="flex min-h-[108px] flex-col items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#101010] px-2 py-3 text-center">
              <p className="w-full truncate text-sm font-bold leading-tight text-[#9370DB]">{favoriteGenre}</p>
              <p className="mt-1 text-[11px] text-neutral-400">género favorito</p>
            </article>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <article className="rounded-xl border border-[#2a2a2a] bg-[#101010] px-2 py-3 text-center">
              <p className="truncate text-xs font-semibold text-neutral-200">Christopher Nolan</p>
              <p className="mt-1 text-[10px] text-neutral-500">director favorito</p>
            </article>
            <article className="rounded-xl border border-[#2a2a2a] bg-[#101010] px-2 py-3 text-center">
              <p className="truncate text-xs font-semibold text-neutral-200">Florence Pugh</p>
              <p className="mt-1 text-[10px] text-neutral-500">actor favorito</p>
            </article>
            <article className="rounded-xl border border-[#2a2a2a] bg-[#101010] px-2 py-3 text-center">
              <p className="truncate text-xs font-semibold text-neutral-200">Estados Unidos</p>
              <p className="mt-1 text-[10px] text-neutral-500">país favorito</p>
            </article>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-base font-semibold text-white">Lo que has visto</h2>
          {historyLoading ? (
            <p className="text-sm text-neutral-500">Cargando…</p>
          ) : historyRows.length === 0 ? (
            <p className="rounded-xl border border-[#2a2a2a] bg-[#101010] px-4 py-4 text-sm text-neutral-400">
              Aún no has valorado ninguna película
            </p>
          ) : (
            <>
              <ul className="space-y-2">
                {historyRows.map((row) => (
                <li key={row.key}>
                  <button
                    type="button"
                    onClick={() =>
                      router.push(row.media === "movie" ? `/pelicula/${row.tmdbId}` : `/serie/${row.tmdbId}`)
                    }
                    className="flex w-full items-center gap-3 rounded-xl border border-[#2a2a2a] bg-[#101010] px-3 py-2.5 text-left transition hover:border-neutral-500 hover:bg-[#161616]"
                  >
                  <div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded-md border border-[#2a2a2a] bg-[#1a1a1a]">
                    {row.posterPath ? (
                      <Image
                        src={`https://image.tmdb.org/t/p/w92${row.posterPath}`}
                        alt=""
                        width={92}
                        height={138}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[8px] text-neutral-600">—</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{row.title}</p>
                    <p className="text-xs text-[#fbbf24]">{starsDisplay(row.stars)}</p>
                  </div>
                  <p className="flex-shrink-0 text-[10px] uppercase tracking-wide text-neutral-500">{row.media}</p>
                </button>
                </li>
                ))}
              </ul>
              <Link
                href="/perfil/historial"
                className="mt-4 flex w-full items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#101010] px-4 py-3 text-sm font-semibold text-white transition hover:border-neutral-500 hover:bg-[#161616]"
              >
                Ver todo →
              </Link>
            </>
          )}
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-base font-semibold text-white">Tu watchlist</h2>
          {watchlistLoading ? (
            <p className="text-sm text-neutral-500">Cargando…</p>
          ) : watchlistRows.length === 0 ? (
            <p className="rounded-xl border border-[#2a2a2a] bg-[#101010] px-4 py-4 text-sm text-neutral-400">
              No tienes nada guardado en la watchlist.
            </p>
          ) : (
            <>
              <div className="flex flex-row gap-3 overflow-x-scroll pb-2">
                {watchlistRows.slice(0, 4).map((row) => (
                  <article key={row.watchlistId} className="w-[140px] flex-shrink-0">
                    <div className="relative h-[190px] w-full overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]">
                      {row.posterPath ? (
                        <Image
                          src={`https://image.tmdb.org/t/p/w342${row.posterPath}`}
                          alt={`Póster de ${row.title}`}
                          width={342}
                          height={513}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-neutral-600">
                          Sin imagen
                        </div>
                      )}
                    </div>
                    <p className="mt-2 truncate text-sm font-medium text-white">{row.title}</p>
                    <p className="text-[10px] uppercase tracking-wide text-neutral-500">{row.media}</p>
                  </article>
                ))}
              </div>
              <Link
                href="/perfil/watchlist"
                className="mt-4 flex w-full items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#101010] px-4 py-3 text-sm font-semibold text-white transition hover:border-neutral-500 hover:bg-[#161616]"
              >
                Ver todo →
              </Link>
            </>
          )}
        </section>

        <section className="rounded-xl border border-[#2a2a2a] bg-[#101010] px-4 py-5">
          <p className="text-center text-lg font-semibold text-white">🎬 Recomienda WhatNext? a un amigo</p>
          <p className="mt-3 text-center text-sm leading-relaxed text-neutral-400">
            Comparte la app con alguien que pierda tiempo buscando qué ver
          </p>
          <button
            type="button"
            onClick={() => void shareApp()}
            className="mt-5 w-full rounded-xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-neutral-100"
          >
            Compartir
          </button>
        </section>

        <section className="mb-10 mt-6 rounded-xl border border-[#2a2a2a] bg-[#101010] px-4 py-4">
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full rounded-xl border border-red-900/60 bg-red-950/30 py-3 text-sm font-semibold text-red-200 transition hover:border-red-800 hover:bg-red-950/50"
          >
            Cerrar sesión
          </button>
        </section>
      </div>

      {platformsModalOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setPlatformsModalOpen(false);
            }
          }}
        >
          <div
            className="max-h-[85vh] w-full max-w-[400px] overflow-y-auto rounded-2xl border border-[#2a2a2a] bg-[#101010] p-4 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="platforms-modal-title"
          >
            <h2 id="platforms-modal-title" className="text-lg font-semibold text-white">
              Tus plataformas
            </h2>
            <p className="mt-1 text-xs text-neutral-500">Marca las que usas (como en el onboarding).</p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {PLATFORMS.map((platform) => {
                const sel = platformDraft.includes(platform.id);
                return (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => togglePlatformInDraft(platform.id)}
                    className="relative flex h-24 items-center justify-center rounded-xl border-2 bg-black px-2 text-center transition"
                    style={{
                      borderColor: sel ? platform.color : "#2a2a2a",
                      backgroundColor: sel ? `${platform.color}22` : "#0a0a0a"
                    }}
                  >
                    {sel ? (
                      <span className="absolute right-2 top-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-black">
                        ✓
                      </span>
                    ) : null}
                    <span className="text-sm font-semibold text-white">{platform.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => void savePlatformsModal()}
                className="flex-1 rounded-xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-neutral-100"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setPlatformsModalOpen(false)}
                className="rounded-xl border border-neutral-600 px-4 py-3 text-sm font-medium text-neutral-200 hover:border-neutral-400 hover:text-white"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {gustosModalOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setGustosModalOpen(false);
            }
          }}
        >
          <div
            className="max-h-[85vh] w-full max-w-[400px] overflow-y-auto rounded-2xl border border-[#2a2a2a] bg-[#101010] p-4 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gustos-modal-title"
          >
            <h2 id="gustos-modal-title" className="text-lg font-semibold text-white">
              Tus gustos
            </h2>
            <p className="mt-1 text-xs text-neutral-500">Géneros, temática, ambiente, época e idioma.</p>
            <div className="mt-4 space-y-5">
              {GUSTOS_MODAL_SECTIONS.map((section) => {
                const cmap = PILL_COLORS[section.id] ?? {};
                return (
                  <div key={section.id}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      {section.title}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {section.options.map((option) => {
                        const sel = (gustosModalDraft[section.id] ?? []).includes(option);
                        const color = cmap[option] ?? "#737373";
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => toggleGustosModalOption(section.id, option, section.single)}
                            className="rounded-full border px-2.5 py-1 text-[11px] font-medium transition"
                            style={{
                              borderColor: sel ? color : "#333",
                              backgroundColor: sel ? `${color}33` : "transparent",
                              color: sel ? "#fff" : "#a3a3a3"
                            }}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => void saveGustosModal()}
                className="flex-1 rounded-xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-neutral-100"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setGustosModalOpen(false)}
                className="rounded-xl border border-neutral-600 px-4 py-3 text-sm font-medium text-neutral-200 hover:border-neutral-400 hover:text-white"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <BottomNav />
    </main>
  );
}
