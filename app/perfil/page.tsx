"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchJson, TMDB_API_KEY } from "@/components/TmdbDetailSheet";
import type { MediaType } from "@/components/TmdbDetailSheet";

type GustosSelection = Record<string, string[]>;

type RatingRow = {
  key: string;
  title: string;
  posterPath: string | null;
  stars: number;
  media: MediaType;
};

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
};

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

function HomeIcon({ active = false }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.8v-6h-4.4v6H5a1 1 0 0 1-1-1v-8.5Z"
        stroke={active ? "#fff" : "#737373"}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="#737373" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="#737373" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function FriendsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="3" stroke="#737373" strokeWidth="1.8" />
      <circle cx="16.5" cy="10.5" r="2.5" stroke="#737373" strokeWidth="1.8" />
      <path d="M4.5 19a4.5 4.5 0 0 1 9 0" stroke="#737373" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14.5 19a3.5 3.5 0 0 1 5 0" stroke="#737373" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ProfileIcon({ active = false }: { active?: boolean }) {
  const stroke = active ? "#fff" : "#737373";
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke={stroke} strokeWidth="1.8" />
      <path d="M5 20a7 7 0 0 1 14 0" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function PerfilPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [platformIds, setPlatformIds] = useState<string[]>([]);
  const [gustos, setGustos] = useState<GustosSelection>({});
  const [valoraciones, setValoraciones] = useState<Record<string, RatingValue>>({});
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [platformsEditing, setPlatformsEditing] = useState(false);
  const [historyRows, setHistoryRows] = useState<RatingRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [watchlistRows, setWatchlistRows] = useState<WatchlistRow[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  const reloadStorage = useCallback(() => {
    try {
      const n = window.localStorage.getItem("nombre");
      setNombre(n ?? "");
      const p = window.localStorage.getItem("plataformas");
      if (p) {
        const parsed = JSON.parse(p);
        if (Array.isArray(parsed)) {
          setPlatformIds(parsed.filter((x): x is string => typeof x === "string"));
        }
      }
      const g = window.localStorage.getItem("gustos");
      if (g) {
        const parsed = JSON.parse(g) as Record<string, unknown>;
        const next: GustosSelection = {};
        Object.entries(parsed).forEach(([k, v]) => {
          if (Array.isArray(v)) {
            next[k] = v.filter((item): item is string => typeof item === "string");
          }
        });
        setGustos(next);
      }
      const v = window.localStorage.getItem("valoraciones");
      if (v) {
        try {
          setValoraciones(JSON.parse(v) as Record<string, RatingValue>);
        } catch {
          setValoraciones({});
        }
      } else {
        setValoraciones({});
      }
      const w = window.localStorage.getItem("watchlist");
      if (w) {
        const parsed = JSON.parse(w);
        if (Array.isArray(parsed)) {
          setWatchlist(parsed.filter((x): x is string => typeof x === "string"));
        }
      } else {
        setWatchlist([]);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    reloadStorage();
    const onFocus = () => reloadStorage();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reloadStorage]);

  const handle = useMemo(() => `@${slugFromNombre(nombre)}`, [nombre]);

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
        entries.map(async ([storageKey, v]): Promise<RatingRow | null> => {
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
            media
          };
        })
      );
      if (!ac.signal.aborted) {
        setHistoryRows(rows.filter((x): x is RatingRow => x != null));
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

  const togglePlatformDraft = (id: string) => {
    setPlatformIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      window.localStorage.setItem("plataformas", JSON.stringify(next));
      return next;
    });
  };

  const removeWatchlistItem = (watchlistId: string) => {
    setWatchlist((prev) => {
      const next = prev.filter((x) => x !== watchlistId);
      window.localStorage.setItem("watchlist", JSON.stringify(Array.from(new Set(next))));
      return Array.from(new Set(next));
    });
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
        <p className="mb-8 w-full text-center text-xs uppercase tracking-[0.35em] text-neutral-500">WhatNext?</p>

        <section className="mb-10 flex flex-col items-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#262626] text-2xl font-bold text-white">
            {initialsFromNombre(nombre)}
          </div>
          <h1 className="mt-4 text-center text-2xl font-semibold text-white">{nombre.trim() || "Tu nombre"}</h1>
          <p className="mt-1 text-sm text-neutral-500">{handle}</p>

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
              onClick={() => setPlatformsEditing((e) => !e)}
              className="text-sm font-medium text-neutral-400 underline-offset-2 hover:text-white hover:underline"
            >
              {platformsEditing ? "Listo" : "Editar"}
            </button>
          </div>

          {!platformsEditing ? (
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
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {PLATFORMS.map((platform) => {
                const sel = platformIds.includes(platform.id);
                return (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => togglePlatformDraft(platform.id)}
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
          )}
        </section>

        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-white">Tus gustos</h2>
            <button
              type="button"
              onClick={() => router.push("/onboarding/gustos")}
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
            <ul className="space-y-2">
              {historyRows.map((row) => (
                <li
                  key={row.key}
                  className="flex items-center gap-3 rounded-xl border border-[#2a2a2a] bg-[#101010] px-3 py-2.5"
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
                </li>
              ))}
            </ul>
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
            <ul className="space-y-2">
              {watchlistRows.map((row) => (
                <li
                  key={row.watchlistId}
                  className="flex items-center gap-3 rounded-xl border border-[#2a2a2a] bg-[#101010] px-3 py-2.5"
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
                    <p className="text-[10px] uppercase tracking-wide text-neutral-500">{row.media}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeWatchlistItem(row.watchlistId)}
                    className="flex-shrink-0 rounded-lg border border-neutral-600 px-2.5 py-1 text-xs font-medium text-neutral-300 transition hover:border-red-500 hover:text-red-400"
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
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
      </div>

      <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-[400px] -translate-x-1/2 border-t border-[#1f1f1f] bg-[#0a0a0a]/95 px-5 py-3 backdrop-blur">
        <ul className="grid grid-cols-4 gap-2">
          <li>
            <Link
              href="/dashboard"
              className="flex flex-col items-center gap-1 text-[11px] font-medium text-neutral-500 transition hover:text-neutral-300"
            >
              <HomeIcon />
              <span>Inicio</span>
            </Link>
          </li>
          <li>
            <Link
              href="/buscar"
              className="flex flex-col items-center gap-1 text-[11px] font-medium text-neutral-500 transition hover:text-neutral-300"
            >
              <SearchIcon />
              <span>Buscar</span>
            </Link>
          </li>
          <li>
            <Link
              href="/amigos"
              className="flex flex-col items-center gap-1 text-[11px] font-medium text-neutral-500 transition hover:text-neutral-300"
            >
              <FriendsIcon />
              <span>Amigos</span>
            </Link>
          </li>
          <li>
            <Link href="/perfil" className="flex flex-col items-center gap-1 text-[11px] font-medium text-white">
              <ProfileIcon active />
              <span>Perfil</span>
            </Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}
