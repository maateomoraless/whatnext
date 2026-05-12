"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { readUserDataCacheJson, setActiveStorageUserId, syncAllUserData } from "@/lib/userStorage";
import { motion } from "framer-motion";
import { MotionButton } from "@/components/ui/MotionButton";
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

const GENRE_PILL_COLORS: Record<string, string> = {
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
};

function brightenHexColor(hex: string, amount = 0.28) {
  const parsed = hex.replace("#", "");
  const r = Number.parseInt(parsed.slice(0, 2), 16);
  const g = Number.parseInt(parsed.slice(2, 4), 16);
  const b = Number.parseInt(parsed.slice(4, 6), 16);
  const brighten = (value: number) => Math.min(255, Math.round(value + (255 - value) * amount));
  return `rgb(${brighten(r)} ${brighten(g)} ${brighten(b)})`;
}

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
  gradient: [string, string];
};

function gradientForMovieId(id: number): [string, string] {
  return id % 2 === 0 ? ["#1f1f1f", "#0b0b0b"] : ["#2a241a", "#0f0d09"];
}

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

const resultRowVariants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const } }
};

const resultListVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.06 }
  }
};

function CoupleResultCard({ row, onOpen }: { row: ResultRow; onOpen: (id: number) => void }) {
  return (
    <motion.article variants={resultRowVariants} className="w-[140px] flex-shrink-0">
      <motion.div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(row.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen(row.id);
          }
        }}
        className="relative h-[190px] w-full cursor-pointer overflow-hidden rounded-xl border border-[#2a2a2a]"
        whileHover={{ scale: 0.97 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
      >
        {row.posterPath ? (
          <Image
            src={`https://image.tmdb.org/t/p/w342${row.posterPath}`}
            alt={`Póster de ${row.title}`}
            width={342}
            height={513}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(180deg, ${row.gradient[0]} 0%, ${row.gradient[1]} 100%)`
            }}
          />
        )}
      </motion.div>
      <p className="mt-2 cursor-pointer truncate text-sm font-medium text-white" onClick={() => onOpen(row.id)}>
        {row.title}
      </p>
      <p className="text-xs font-medium text-[#22c55e]">{row.matchPct}% match</p>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-neutral-400">
        <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: row.platformColor }} />
        <span className="truncate">{row.platform}</span>
      </div>
    </motion.article>
  );
}

export default function ParejaPage() {
  const router = useRouter();
  const [a, setA] = useState<string[]>([]);
  const [b, setB] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [plataformas, setPlataformas] = useState<string[]>([]);

  useEffect(() => {
    void (async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        try {
          const raw = typeof window !== "undefined" ? window.localStorage.getItem("plataformas") : null;
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
          /* ignore */
        }
        return;
      }
      setActiveStorageUserId(user.id);
      await syncAllUserData(user.id);
      const parsed = readUserDataCacheJson<string[]>(user.id, "plataformas");
      if (!parsed || !Array.isArray(parsed)) {
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
    })();
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
        const params = new URLSearchParams();
        params.set("api_key", apiKey);
        params.set("language", "es-ES");
        params.set("watch_region", "ES");
        params.set("with_watch_providers", providerPipe);
        params.set("with_genres", withGenres);
        params.set("sort_by", "vote_average.desc");
        params.set("page", String(page));
        params.set("vote_count.gte", "80");

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
            platformColor: prov.color,
            gradient: gradientForMovieId(m.id)
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

  const GenrePill = ({
    label,
    selected,
    onToggle
  }: {
    label: string;
    selected: boolean;
    onToggle: () => void;
  }) => {
    const baseColor = GENRE_PILL_COLORS[label];
    const borderColor = selected ? (baseColor ?? "#ffffff") : "#2a2a2a";
    const backgroundColor = selected ? (baseColor ? `${baseColor}26` : "#ffffff") : "transparent";
    const textColor = selected ? (baseColor ? brightenHexColor(baseColor) : "#000000") : "#a3a3a3";
    return (
      <motion.button
        type="button"
        layout
        onClick={onToggle}
        className="rounded-full border border-[#2a2a2a] px-3 py-1.5 text-sm transition"
        whileTap={{ scale: 0.9 }}
        animate={
          selected
            ? {
                scale: [1, 1.08, 1],
                boxShadow: [
                  "0 0 0 0 rgba(0,0,0,0)",
                  `0 0 10px 0 ${baseColor ?? "#ffffff66"}`,
                  "0 0 0 0 rgba(0,0,0,0)"
                ]
              }
            : { scale: 1, boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
        }
        transition={{ duration: 0.32, ease: "easeOut" }}
        style={{
          borderColor,
          backgroundColor,
          color: textColor
        }}
      >
        {label}
      </motion.button>
    );
  };

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
      <div className="flex flex-wrap gap-2">
        {GENRE_OPTIONS.map((label) => (
          <GenrePill
            key={`${who}-${label}`}
            label={label}
            selected={selected.includes(label)}
            onToggle={() => toggle(who, label)}
          />
        ))}
      </div>
    </div>
  );

  const openMovie = useCallback(
    (id: number) => {
      router.push(`/pelicula/${id}`);
    },
    [router]
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

        {loading ? (
          <div className="mb-4 space-y-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#2a2a2a]">
              <motion.div
                className="h-full max-w-full rounded-full bg-white"
                initial={{ width: "8%" }}
                animate={{ width: ["12%", "38%", "62%", "88%", "94%"] }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  repeatType: "mirror"
                }}
              />
            </div>
            <p className="text-center text-xs text-neutral-500">Buscando recomendaciones en común…</p>
          </div>
        ) : null}

        <MotionButton
          type="button"
          disabled={loading}
          onClick={() => void runSearch()}
          className="mb-8 w-full rounded-xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Buscando…" : "Ver 5 mejores en común"}
        </MotionButton>

        {error ? (
          <p className="mb-6 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {results.length > 0 ? (
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">Top en común</h2>
            <motion.div
              className="flex flex-row gap-3 overflow-x-auto pb-2"
              variants={resultListVariants}
              initial="hidden"
              animate="show"
            >
              {results.map((row) => (
                <CoupleResultCard key={row.id} row={row} onOpen={openMovie} />
              ))}
            </motion.div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
