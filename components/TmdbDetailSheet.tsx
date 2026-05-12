"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MotionButton } from "@/components/ui/MotionButton";
import { SkeletonShimmer } from "@/components/ui/SkeletonShimmer";

export const TMDB_API_KEY =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_TMDB_API_KEY?.trim()
    ? process.env.NEXT_PUBLIC_TMDB_API_KEY.trim()
    : "2de8d3ecfb29fc4efda4d7fa09d0920e";

export type MediaType = "movie" | "tv";

export type MultiSearchResult = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
};

export type SheetState = { item: MultiSearchResult; media: MediaType };

type Genre = { id: number; name: string };

export type MovieDetail = {
  title?: string;
  runtime?: number;
  release_date?: string;
  overview?: string;
  genres?: Genre[];
  poster_path?: string | null;
};

export type TvDetail = {
  name?: string;
  episode_run_time?: number[];
  first_air_date?: string;
  overview?: string;
  genres?: Genre[];
  poster_path?: string | null;
};

export type WatchProvidersResponse = {
  results?: {
    ES?: {
      flatrate?: Array<{ provider_name: string }>;
      rent?: Array<{ provider_name: string }>;
      buy?: Array<{ provider_name: string }>;
    };
  };
};

export function yearFromItem(item: MultiSearchResult, media: MediaType): string {
  const raw = media === "movie" ? item.release_date : item.first_air_date;
  if (!raw || raw.length < 4) {
    return "—";
  }
  return raw.slice(0, 4);
}

export function formatMovieRuntime(minutes?: number): string {
  if (minutes == null || minutes <= 0) {
    return "—";
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) {
    return `${m} min`;
  }
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

export function formatTvRuntime(runTimes?: number[]): string {
  if (!runTimes?.length) {
    return "—";
  }
  const avg = Math.round(runTimes.reduce((a, b) => a + b, 0) / runTimes.length);
  return `${avg} min/ep`;
}

export function watchlistId(media: MediaType, id: number) {
  return `${media}-${id}`;
}

export function ratingStorageKey(media: MediaType, id: number) {
  return media === "movie" ? `tmdb-${id}` : `tv-${id}`;
}

export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function collectProviderNames(data: WatchProvidersResponse | null): string[] {
  const es = data?.results?.ES;
  if (!es) {
    return [];
  }
  const names = new Set<string>();
  es.flatrate?.forEach((p) => names.add(p.provider_name));
  es.rent?.forEach((p) => names.add(p.provider_name));
  es.buy?.forEach((p) => names.add(p.provider_name));
  return Array.from(names);
}

type DetailSheetInnerProps = {
  sheet: SheetState;
  onClose: () => void;
  detailMovie: MovieDetail | null;
  detailTv: TvDetail | null;
  detailLoading: boolean;
  providers: string[];
  watchlist: string[];
  onToggleWatchlist: () => void;
  starsPanelOpen: boolean;
  onToggleStarsPanel: () => void;
  persistRating: (stars: number) => void;
  onShare: () => void;
};

function renderDetailSheetNodes({
  sheet,
  onClose,
  detailMovie,
  detailTv,
  detailLoading,
  providers,
  watchlist,
  onToggleWatchlist,
  starsPanelOpen,
  onToggleStarsPanel,
  persistRating,
  onShare
}: DetailSheetInnerProps) {
  const { item, media } = sheet;

  const posterPath =
    media === "movie"
      ? detailMovie?.poster_path ?? item.poster_path
      : detailTv?.poster_path ?? item.poster_path;

  const sheetTitle =
    media === "movie" ? detailMovie?.title ?? item.title ?? "Sin título" : detailTv?.name ?? item.name ?? "Sin título";

  const sheetYear =
    media === "movie"
      ? yearFromItem({ ...item, release_date: detailMovie?.release_date ?? item.release_date }, "movie")
      : yearFromItem({ ...item, first_air_date: detailTv?.first_air_date ?? item.first_air_date }, "tv");

  const sheetRuntime =
    media === "movie" ? formatMovieRuntime(detailMovie?.runtime) : formatTvRuntime(detailTv?.episode_run_time);

  const sheetGenres =
    media === "movie"
      ? detailMovie?.genres?.map((g) => g.name).join(", ") ?? "—"
      : detailTv?.genres?.map((g) => g.name).join(", ") ?? "—";

  const sheetOverview =
    media === "movie"
      ? detailMovie?.overview ?? item.overview ?? ""
      : detailTv?.overview ?? item.overview ?? "";

  const inWatchlist = watchlist.includes(watchlistId(media, item.id));

  const k = `${sheet.media}-${sheet.item.id}`;

  return [
    <motion.button
      key={`${k}-backdrop`}
      type="button"
      aria-label="Cerrar"
      className="fixed inset-0 z-30 bg-black/70"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.22 } }}
    />,
    <motion.div
      key={`${k}-panel`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-title"
      className="fixed bottom-0 left-1/2 z-40 max-h-[88vh] w-full max-w-[400px] -translate-x-1/2 overflow-y-auto rounded-t-2xl border border-[#2a2a2a] border-b-0 bg-[#111]"
      initial={{ y: "108%" }}
      animate={{ y: 0 }}
      exit={{ y: "108%", transition: { duration: 0.34, ease: [0.32, 0.72, 0, 1] } }}
      transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.85 }}
    >
        <div className="sticky top-0 z-10 mx-auto mt-2 h-1 w-10 rounded-full bg-[#3f3f46]" />
        <div className="px-5 pb-8 pt-4">
          <div className="mx-auto mb-4 flex max-w-[200px] justify-center overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]">
            {posterPath ? (
              <Image
                src={`https://image.tmdb.org/t/p/w500${posterPath}`}
                alt=""
                width={500}
                height={750}
                className="w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[2/3] w-full items-center justify-center text-neutral-600">Sin imagen</div>
            )}
          </div>

          {detailLoading ? (
            <div className="space-y-3 py-2">
              <SkeletonShimmer className="mx-auto h-6 w-3/4" rounded="lg" />
              <SkeletonShimmer className="h-3 w-1/2" rounded="md" />
              <SkeletonShimmer className="h-20 w-full" rounded="lg" />
              <SkeletonShimmer className="h-10 w-full" rounded="xl" />
              <p className="text-center text-sm text-neutral-500">Cargando detalles…</p>
            </div>
          ) : (
            <>
              <h2 id="sheet-title" className="text-xl font-semibold leading-snug text-white">
                {sheetTitle}
              </h2>
              <p className="mt-1 text-sm text-neutral-400">
                {sheetYear} · {sheetRuntime}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-neutral-500">{sheetGenres}</p>
              <p className="mt-4 text-sm leading-relaxed text-neutral-300">
                {sheetOverview.trim() || "Sin sinopsis disponible."}
              </p>

              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Dónde verla (España)
                </p>
                {providers.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {providers.map((name) => (
                      <span
                        key={name}
                        className="rounded-lg border border-[#333] bg-[#1a1a1a] px-2.5 py-1 text-xs text-neutral-300"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">Sin información de plataformas.</p>
                )}
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <MotionButton
                  type="button"
                  onClick={onToggleWatchlist}
                  className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-neutral-100"
                >
                  {inWatchlist ? "Quitar de watchlist" : "Añadir a watchlist"}
                </MotionButton>

                <MotionButton
                  type="button"
                  onClick={() => void onShare()}
                  className="w-full rounded-xl border border-[#333] bg-[#1a1a1a] py-3 text-sm font-medium text-neutral-200 transition hover:border-neutral-500"
                >
                  Recomendar
                </MotionButton>

                <div>
                  <MotionButton
                    type="button"
                    onClick={onToggleStarsPanel}
                    className="w-full rounded-xl border border-[#333] bg-[#1a1a1a] py-3 text-sm font-medium text-neutral-200 transition hover:border-neutral-500"
                  >
                    ✓ Ya la vi
                  </MotionButton>
                  {starsPanelOpen ? (
                    <div className="mt-3 rounded-xl border border-[#2a2a2a] bg-[#161616] p-4">
                      <p className="mb-3 text-center text-xs text-neutral-500">Tu valoración</p>
                      <div className="flex justify-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <motion.button
                            key={star}
                            type="button"
                            onClick={() => persistRating(star)}
                            className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2a2a2a] text-lg text-neutral-400 transition hover:bg-[#fbbf24] hover:text-black"
                            aria-label={`${star} estrellas`}
                            whileTap={{ scale: 0.88 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          >
                            ★
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
  ];
}

export function TmdbDetailSheet({
  sheet,
  onClose,
  detailMovie,
  detailTv,
  detailLoading,
  providers,
  watchlist,
  onToggleWatchlist,
  starsPanelOpen,
  onToggleStarsPanel,
  persistRating
}: {
  sheet: SheetState | null;
  onClose: () => void;
  detailMovie: MovieDetail | null;
  detailTv: TvDetail | null;
  detailLoading: boolean;
  providers: string[];
  watchlist: string[];
  onToggleWatchlist: () => void;
  starsPanelOpen: boolean;
  onToggleStarsPanel: () => void;
  persistRating: (stars: number) => void;
}) {
  const [copyToast, setCopyToast] = useState(false);

  useEffect(() => {
    if (!copyToast) {
      return undefined;
    }
    const t = window.setTimeout(() => setCopyToast(false), 3000);
    return () => window.clearTimeout(t);
  }, [copyToast]);

  const buildSharePayload = useCallback(() => {
    if (!sheet) {
      return null;
    }
    const { item, media } = sheet;
    const title =
      media === "movie" ? detailMovie?.title ?? item.title ?? "Sin título" : detailTv?.name ?? item.name ?? "Sin título";
    const platform = providers[0] ?? "streaming";
    const text = `Te recomiendo ${title} — disponible en ${platform} 🎬 Descúbrela en WhatNext? whatnext-gray.vercel.app`;
    const base = "https://whatnext-gray.vercel.app";
    const url = media === "movie" ? `${base}/pelicula/${item.id}` : `${base}/serie/${item.id}`;
    return { title: "WhatNext?", text, url };
  }, [sheet, detailMovie, detailTv, providers]);

  const handleShare = useCallback(async () => {
    const payload = buildSharePayload();
    if (!payload) {
      return;
    }
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: payload.title,
          text: payload.text,
          url: payload.url
        });
        return;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
    }
    const clip = `${payload.text}\n${payload.url}`;
    try {
      await navigator.clipboard.writeText(clip);
    } catch {
      try {
        await navigator.clipboard.writeText(payload.text);
      } catch {
        // ignore
      }
    }
    setCopyToast(true);
  }, [buildSharePayload]);

  return (
    <>
      <AnimatePresence>
        {sheet
          ? renderDetailSheetNodes({
              sheet,
              onClose,
              detailMovie,
              detailTv,
              detailLoading,
              providers,
              watchlist,
              onToggleWatchlist,
              starsPanelOpen,
              onToggleStarsPanel,
              persistRating,
              onShare: handleShare
            })
          : null}
      </AnimatePresence>
      <AnimatePresence>
        {copyToast ? (
          <motion.div
            key="copy-toast"
            role="status"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[#333] bg-[#1a1a1a] px-4 py-2 text-sm text-white shadow-lg"
          >
            ¡Enlace copiado!
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
