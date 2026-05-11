"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  collectProviderNames,
  fetchJson,
  TMDB_API_KEY,
  type MediaType,
  type WatchProvidersResponse
} from "@/components/TmdbDetailSheet";

type WatchlistRow = {
  watchlistId: string;
  title: string;
  posterPath: string | null;
  media: MediaType;
  platform: string;
  platformColor: string;
};

const PROVIDER_COLOR_BY_NAME: Record<string, string> = {
  Netflix: "#E50914",
  "Disney+": "#0063e5",
  Max: "#5822B4",
  Prime: "#00A8E0",
  "Amazon Prime Video": "#00A8E0",
  "Apple TV+": "#555555",
  Filmin: "#e8175d"
};

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

function normalizeProviderName(name: string): string {
  return name === "Amazon Prime Video" ? "Prime" : name;
}

export default function PerfilWatchlistPage() {
  const router = useRouter();
  const [rows, setRows] = useState<WatchlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [watchlist, setWatchlist] = useState<string[]>([]);

  useEffect(() => {
    try {
      const w = window.localStorage.getItem("watchlist");
      if (w) {
        const parsed = JSON.parse(w);
        if (Array.isArray(parsed)) {
          setWatchlist(parsed.filter((x): x is string => typeof x === "string"));
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();

    async function load() {
      const unique = Array.from(new Set(watchlist));
      if (unique.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const base = `https://api.themoviedb.org/3`;
      const key = TMDB_API_KEY;

      const fetched = await Promise.all(
        unique.map(async (wid): Promise<WatchlistRow | null> => {
          const parsed = parseWatchlistToTmdb(wid);
          if (!parsed) {
            return {
              watchlistId: wid,
              title: wid,
              posterPath: null,
              media: "movie",
              platform: "No disponible",
              platformColor: "#737373"
            };
          }

          const detailUrl =
            parsed.media === "movie"
              ? `${base}/movie/${parsed.id}?api_key=${key}&language=es-ES`
              : `${base}/tv/${parsed.id}?api_key=${key}&language=es-ES`;
          const providersUrl =
            parsed.media === "movie"
              ? `${base}/movie/${parsed.id}/watch/providers?api_key=${key}`
              : `${base}/tv/${parsed.id}/watch/providers?api_key=${key}`;

          const [detail, providers] = await Promise.all([
            fetchJson<{ title?: string; name?: string; poster_path?: string | null }>(detailUrl, ac.signal),
            fetchJson<WatchProvidersResponse>(providersUrl, ac.signal)
          ]);

          if (ac.signal.aborted) {
            return null;
          }

          const providerNames = collectProviderNames(providers);
          const firstRaw = providerNames[0];
          const platform = firstRaw ? normalizeProviderName(firstRaw) : "No disponible";
          const platformColor = PROVIDER_COLOR_BY_NAME[platform] ?? "#737373";

          return {
            watchlistId: wid,
            title: detail?.title ?? detail?.name ?? `TMDB ${parsed.id}`,
            posterPath: detail?.poster_path ?? null,
            media: parsed.media,
            platform,
            platformColor
          };
        })
      );

      if (!ac.signal.aborted) {
        setRows(fetched.filter((row): row is WatchlistRow => row != null));
        setLoading(false);
      }
    }

    void load();
    return () => ac.abort();
  }, [watchlist]);

  const removeItem = useCallback((wid: string) => {
    setWatchlist((prev) => {
      const next = prev.filter((id) => id !== wid);
      const deduped = Array.from(new Set(next));
      window.localStorage.setItem("watchlist", JSON.stringify(deduped));
      return deduped;
    });
  }, []);

  return (
    <main className="flex min-h-screen justify-center bg-[#0a0a0a] px-6 pb-10 text-white">
      <div className="relative w-full max-w-[400px] pt-8">
        <button
          type="button"
          onClick={() => router.push("/perfil")}
          className="mb-6 inline-flex items-center rounded-lg border border-[#2a2a2a] bg-[#101010] px-3 py-2 text-sm font-medium text-neutral-200 transition hover:border-neutral-500 hover:text-white"
        >
          ← Volver
        </button>

        <p className="mb-6 w-full text-center text-xs uppercase tracking-[0.35em] text-neutral-500">WhatNext?</p>

        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-white">Tu watchlist</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Todo lo que tienes guardado para ver más adelante.
          </p>
        </header>

        {loading ? (
          <p className="text-sm text-neutral-500">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-[#2a2a2a] bg-[#101010] px-4 py-6 text-center text-sm text-neutral-400">
            Tu watchlist está vacía
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-3">
            {rows.map((row) => (
              <li key={row.watchlistId} className="flex flex-col">
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]">
                  {row.posterPath ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w342${row.posterPath}`}
                      alt={`Póster de ${row.title}`}
                      width={342}
                      height={513}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] text-neutral-600">
                      Sin imagen
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeItem(row.watchlistId)}
                    aria-label={`Quitar ${row.title} de la watchlist`}
                    className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-black/70 text-xs text-white transition hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
                <p className="mt-2 line-clamp-2 text-xs font-medium leading-tight text-white">{row.title}</p>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-neutral-400">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: row.platformColor }}
                  />
                  <span className="truncate">{row.platform}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
