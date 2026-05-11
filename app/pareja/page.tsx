"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchJson, TMDB_API_KEY } from "@/components/TmdbDetailSheet";

const GENRE_OPTIONS = [
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
] as const;

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

const PROVIDER_ID_BY_PLATFORM: Record<string, number> = {
  Netflix: 8,
  "Disney+": 337,
  Max: 1899,
  Prime: 119,
  "Apple TV+": 350,
  Filmin: 55
};

const DEFAULT_WATCH_PROVIDER_IDS_PIPE = "8|337|1899|119|350";

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

function buildWatchProvidersPipe(plataformasLabels: string[]): string {
  const ids = plataformasLabels
    .map((p) => PROVIDER_ID_BY_PLATFORM[p])
    .filter((id): id is number => typeof id === "number");
  if (ids.length === 0) {
    return DEFAULT_WATCH_PROVIDER_IDS_PIPE;
  }
  return ids.join("|");
}

type DiscoverMovie = {
  id: number;
  title?: string;
  poster_path: string | null;
  genre_ids?: number[];
  vote_average: number;
  overview?: string;
};

type DiscoverResponse = { results?: DiscoverMovie[] };

type TmdbWatchProvidersResponse = {
  results?: { ES?: { flatrate?: Array<{ provider_name: string }> } };
};

type ResultRow = {
  id: number;
  title: string;
  overview: string;
  posterPath: string | null;
  matchPct: number;
  platform: string;
  platformColor: string;
};

function idsFromLabels(labels: string[]): number[] {
  const out: number[] = [];
  for (const n of labels) {
    const id = GENRE_IDS_BY_NAME[n];
    if (id) {
      out.push(id);
    }
  }
  return Array.from(new Set(out));
}

function coupleMatchPercent(movieGenreIds: number[], idsA: number[], idsB: number[]): number {
  const setM = new Set(movieGenreIds);
  const hitA = idsA.filter((id) => setM.has(id)).length;
  const hitB = idsB.filter((id) => setM.has(id)).length;
  const denom = Math.max(1, idsA.length + idsB.length);
  return Math.min(99, Math.round(((hitA + hitB) / denom) * 100));
}

async function firstEsFlatrateProvider(movieId: number, apiKey: string): Promise<{
  name: string;
  color: string;
}> {
  const data = await fetchJson<TmdbWatchProvidersResponse>(
    `https://api.themoviedb.org/3/movie/${movieId}/watch/providers?api_key=${apiKey}`
  );
  const flat = data?.results?.ES?.flatrate;
  const raw = flat?.[0]?.provider_name ?? "No disponible";
  const normalized = raw === "Amazon Prime Video" ? "Prime" : raw;
  const color =
    PROVIDER_COLOR_BY_NAME[normalized] ?? PROVIDER_COLOR_BY_NAME[raw] ?? PROVIDER_COLOR_BY_NAME["No disponible"];
  return { name: normalized, color };
}

export default function ParejaPage() {
  const [a, setA] = useState<string[]>([]);
  const [b, setB] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [plataformas, setPlataformas] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("plataformas");
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return;
      }
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
        .filter((label, index, arr) => arr.indexOf(label) === index);
      setPlataformas(labels);
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback((who: "a" | "b", label: string) => {
    const setter = who === "a" ? setA : setB;
    setter((prev) => (prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]));
  }, []);

  const runSearch = useCallback(async () => {
    setError(null);
    setResults([]);
    const idsA = idsFromLabels(a);
    const idsB = idsFromLabels(b);
    if (idsA.length === 0 || idsB.length === 0) {
      setError("Cada persona debe elegir al menos un género.");
      return;
    }

    const common = idsA.filter((id) => idsB.includes(id));
    const union = Array.from(new Set([...idsA, ...idsB]));
    const withGenres = common.length > 0 ? common.join(",") : union.join("|");

    setLoading(true);
    try {
      const providerPipe = buildWatchProvidersPipe(plataformas);
      const collected: DiscoverMovie[] = [];
      let page = 1;
      const apiKey = TMDB_API_KEY;

      while (collected.length < 40 && page <= 8) {
        const params = new URLSearchParams({
          api_key: apiKey,
          language: "es-ES",
          watch_region: "ES",
          with_watch_providers: providerPipe,
          with_genres: withGenres,
          sort_by: "vote_average.desc",
          page: String(page),
          "vote_count.gte": "80"
        });
        const url = `https://api.themoviedb.org/3/discover/movie?${params.toString()}`;
        const data = await fetchJson<DiscoverResponse>(url);
        const batch = data?.results ?? [];
        for (const m of batch) {
          if (m.poster_path && !collected.some((c) => c.id === m.id)) {
            collected.push(m);
          }
        }
        if (batch.length === 0) {
          break;
        }
        page += 1;
      }

      if (collected.length === 0) {
        setError("No encontramos películas con esos criterios. Prueba otros géneros.");
        setLoading(false);
        return;
      }

      const scored = await Promise.all(
        collected.map(async (m) => {
          const prov = await firstEsFlatrateProvider(m.id, apiKey);
          const matchPct = coupleMatchPercent(m.genre_ids ?? [], idsA, idsB);
          return {
            id: m.id,
            title: m.title ?? "Sin título",
            overview: (m.overview ?? "").trim() || "Sin sinopsis.",
            posterPath: m.poster_path,
            matchPct,
            vote: m.vote_average ?? 0,
            platform: prov.name,
            platformColor: prov.color
          };
        })
      );

      scored.sort((x, y) => {
        if (y.matchPct !== x.matchPct) {
          return y.matchPct - x.matchPct;
        }
        return y.vote - x.vote;
      });

      const top = scored.slice(0, 5).map(({ vote: _v, ...rest }) => rest);
      setResults(top);
    } catch {
      setError("No se pudo cargar TMDB. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [a, b, plataformas]);

  const GenreColumn = ({
    title,
    who,
    selected
  }: {
    title: string;
    who: "a" | "b";
    selected: string[];
  }) => (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#101010] p-4">
      <p className="mb-3 text-sm font-semibold text-white">{title}</p>
      <ul className="flex flex-col gap-2">
        {GENRE_OPTIONS.map((label) => {
          const on = selected.includes(label);
          return (
            <li key={`${who}-${label}`}>
              <button
                type="button"
                onClick={() => toggle(who, label)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                  on
                    ? "border-white bg-white text-black"
                    : "border-[#333] bg-[#161616] text-neutral-200 hover:border-neutral-500"
                }`}
              >
                <span>{label}</span>
                <span className="text-xs">{on ? "✓" : ""}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <main className="flex min-h-screen justify-center bg-[#0a0a0a] px-6 pb-28 pt-10 text-white">
      <section className="w-full max-w-[400px]">
        <p className="mb-6 w-full select-none text-center text-xs uppercase tracking-[0.35em] text-neutral-500">
          WhatNext?
        </p>

        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-neutral-400 transition hover:text-white"
          >
            ← Volver
          </Link>
        </div>

        <h1 className="mb-2 text-2xl font-semibold leading-tight text-white">Modo pareja 💑</h1>
        <p className="mb-6 text-sm text-neutral-400">
          Elegid vuestros géneros favoritos y descubrid películas en común en vuestras plataformas.
        </p>

        <div className="mb-6 grid gap-4">
          <GenreColumn title="Persona 1" who="a" selected={a} />
          <GenreColumn title="Persona 2" who="b" selected={b} />
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => void runSearch()}
          className="mb-8 w-full rounded-xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Buscando…" : "Ver 5 mejores en común"}
        </button>

        {error ? (
          <p className="mb-6 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {results.length > 0 ? (
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">Top en común</h2>
            <ul className="space-y-4">
              {results.map((row) => (
                <li
                  key={row.id}
                  className="flex gap-3 rounded-xl border border-[#2a2a2a] bg-[#101010] p-3"
                >
                  <div className="relative h-[120px] w-[80px] flex-shrink-0 overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#1a1a1a]">
                    {row.posterPath ? (
                      <Image
                        src={`https://image.tmdb.org/t/p/w342${row.posterPath}`}
                        alt=""
                        width={342}
                        height={513}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-neutral-600">
                        Sin póster
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{row.title}</p>
                    <p className="mt-1 text-lg font-bold text-emerald-400">{row.matchPct}% match</p>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-neutral-400">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.platformColor }} />
                      <span className="truncate">{row.platform}</span>
                    </div>
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-neutral-500">{row.overview}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </section>
    </main>
  );
}
