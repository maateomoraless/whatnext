"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchJson, TMDB_API_KEY } from "@/components/TmdbDetailSheet";
import type { MediaType } from "@/components/TmdbDetailSheet";
import {
  groupHistoryByMonthYear,
  parseRatedAtMs,
  sortHistoryByRecency,
  type HistoryRow
} from "@/lib/historyValoraciones";
import { supabase } from "@/lib/supabase";
import { readUserDataCacheJson, setActiveStorageUserId, syncAllUserData } from "@/lib/userStorage";

type RatingValue = {
  rating: number;
  unseen?: boolean;
  title?: string;
  ratedAt?: string;
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

function starsDisplay(n: number): string {
  const r = Math.min(5, Math.max(0, Math.round(n)));
  return `${"★".repeat(r)}${"☆".repeat(5 - r)}`;
}

export default function PerfilHistorialPage() {
  const router = useRouter();
  const [historyGroups, setHistoryGroups] = useState<{ heading: string; rows: HistoryRow[] }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();

    async function loadHistory() {
      setHistoryLoading(true);

      const {
        data: { user }
      } = await supabase.auth.getUser();
      let valoraciones: Record<string, RatingValue> = {};
      if (user) {
        setActiveStorageUserId(user.id);
        await syncAllUserData(user.id);
        valoraciones = readUserDataCacheJson<Record<string, RatingValue>>(user.id, "valoraciones") ?? {};
      } else {
        try {
          const raw =
            typeof window !== "undefined" ? window.localStorage.getItem("valoraciones") : null;
          valoraciones = raw ? (JSON.parse(raw) as Record<string, RatingValue>) : {};
        } catch {
          valoraciones = {};
        }
      }

      const entries = Object.entries(valoraciones).filter(
        ([, v]) => v && !v.unseen && typeof v.rating === "number" && v.rating > 0
      );

      if (entries.length === 0) {
        setHistoryGroups([]);
        setHistoryLoading(false);
        return;
      }

      const base = `https://api.themoviedb.org/3`;
      const key = TMDB_API_KEY;

      const rows = await Promise.all(
        entries.map(async ([storageKey, value]): Promise<HistoryRow | null> => {
          let media: MediaType = "movie";
          let tmdbId: number | null = null;

          if (storageKey.startsWith("tmdb-")) {
            tmdbId = Number(storageKey.slice(5));
            media = "movie";
          } else if (storageKey.startsWith("tv-")) {
            tmdbId = Number(storageKey.slice(3));
            media = "tv";
          } else {
            tmdbId = TMDB_ID_BY_ONBOARDING[storageKey] ?? null;
            media = "movie";
          }

          if (tmdbId == null || !Number.isFinite(tmdbId)) {
            return null;
          }

          const url =
            media === "movie"
              ? `${base}/movie/${tmdbId}?api_key=${key}&language=es-ES`
              : `${base}/tv/${tmdbId}?api_key=${key}&language=es-ES`;
          const data = await fetchJson<{ title?: string; name?: string; poster_path?: string | null }>(
            url,
            ac.signal
          );

          if (ac.signal.aborted) {
            return null;
          }

          const title =
            (typeof value.title === "string" && value.title.trim().length > 0 ? value.title.trim() : null) ??
            data?.title ??
            data?.name ??
            "Sin título";

          return {
            key: storageKey,
            title,
            posterPath: data?.poster_path ?? null,
            stars: Math.round(value.rating),
            media,
            tmdbId,
            ratedAtMs: parseRatedAtMs(value.ratedAt)
          };
        })
      );

      if (!ac.signal.aborted) {
        const valid = rows.filter((row): row is HistoryRow => row != null);
        const sorted = sortHistoryByRecency(valid);
        setHistoryGroups(groupHistoryByMonthYear(sorted));
        setHistoryLoading(false);
      }
    }

    void loadHistory();
    return () => ac.abort();
  }, []);

  const goToTitle = (row: HistoryRow) => {
    if (row.media === "movie") {
      router.push(`/pelicula/${row.tmdbId}`);
    } else {
      router.push(`/serie/${row.tmdbId}`);
    }
  };

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

        <p className="mb-6 w-full text-center text-xs uppercase tracking-[0.35em] text-neutral-500 select-none">WhatNext?</p>

        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-white">Historial</h1>
          <p className="mt-2 text-sm text-neutral-400">Todas las películas y series que has valorado.</p>
        </header>

        {historyLoading ? (
          <p className="text-sm text-neutral-500">Cargando…</p>
        ) : historyGroups.length === 0 ? (
          <p className="rounded-xl border border-[#2a2a2a] bg-[#101010] px-4 py-4 text-sm text-neutral-400">
            Aún no has valorado ninguna película
          </p>
        ) : (
          <div className="space-y-8">
            {historyGroups.map((group) => (
              <section key={group.heading}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">{group.heading}</h2>
                <ul className="space-y-2">
                  {group.rows.map((row) => (
                    <li key={row.key}>
                      <button
                        type="button"
                        onClick={() => goToTitle(row)}
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
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
