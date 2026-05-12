"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { BottomNav } from "@/components/BottomNav";
import { SkeletonShimmer } from "@/components/ui/SkeletonShimmer";
import {
  TmdbDetailSheet,
  TMDB_API_KEY,
  collectProviderNames,
  fetchJson,
  ratingStorageKey,
  watchlistId,
  yearFromItem,
  type MediaType,
  type MovieDetail,
  type MultiSearchResult,
  type SheetState,
  type TvDetail,
  type WatchProvidersResponse
} from "@/components/TmdbDetailSheet";
import { bumpMovieStreak } from "@/lib/movieStreak";
import { freshRatedAtIso } from "@/lib/historyValoraciones";
import { logUserActivity, syncProfileFromLocal } from "@/lib/social";
import { supabase } from "@/lib/supabase";
import {
  readUserDataCacheJson,
  saveUserData,
  setActiveStorageUserId,
  syncAllUserData
} from "@/lib/userStorage";

const buscarGridContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.055,
      delayChildren: 0.04
    }
  }
};

const buscarGridItem: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] }
  }
};

function MagnifyingGlassIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-neutral-500" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function HorizontalPosterRow({
  title,
  items,
  defaultMedia,
  onPick
}: {
  title: string;
  items: MultiSearchResult[];
  defaultMedia: MediaType;
  onPick: (item: MultiSearchResult, media: MediaType) => void;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-base font-semibold text-white">{title}</h2>
      <div className="flex flex-row gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const displayMedia: MediaType =
            item.media_type === "tv" ? "tv" : item.media_type === "movie" ? "movie" : defaultMedia;
          const label = displayMedia === "movie" ? item.title ?? "Sin título" : item.name ?? "Sin título";
          const year = yearFromItem(item, displayMedia);
          return (
            <motion.button
              key={`${displayMedia}-${item.id}`}
              type="button"
              onClick={() => onPick(item, displayMedia)}
              className="w-[100px] flex-shrink-0 text-left"
              whileHover={{ scale: 0.97 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
            >
              <div className="aspect-[2/3] w-full overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]">
                {item.poster_path ? (
                  <Image
                    src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                    alt=""
                    width={342}
                    height={513}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] text-neutral-600">
                    Sin imagen
                  </div>
                )}
              </div>
              <p className="mt-2 line-clamp-2 text-xs font-medium text-white">{label}</p>
              <p className="text-[11px] text-neutral-500">{year}</p>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

export default function BuscarPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MultiSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [trendingMovies, setTrendingMovies] = useState<MultiSearchResult[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<MultiSearchResult[]>([]);
  const [trendingTv, setTrendingTv] = useState<MultiSearchResult[]>([]);
  const [browseLoading, setBrowseLoading] = useState(true);

  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [detailMovie, setDetailMovie] = useState<MovieDetail | null>(null);
  const [detailTv, setDetailTv] = useState<TvDetail | null>(null);
  const [providers, setProviders] = useState<string[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [starsPanelOpen, setStarsPanelOpen] = useState(false);
  const storageUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    void (async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        return;
      }
      const uid = user.id;
      storageUserIdRef.current = uid;
      setActiveStorageUserId(uid);
      await syncAllUserData(uid);
      void syncProfileFromLocal(user);
      const wl = readUserDataCacheJson<string[]>(uid, "watchlist");
      if (wl && Array.isArray(wl)) {
        setWatchlist(wl.filter((x): x is string => typeof x === "string"));
      }
    })();
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    async function loadBrowse() {
      setBrowseLoading(true);
      const base = `https://api.themoviedb.org/3`;
      const key = TMDB_API_KEY;

      const [td, tr, tt] = await Promise.all([
        fetchJson<{ results?: MultiSearchResult[] }>(
          `${base}/trending/movie/day?api_key=${key}&language=es-ES`,
          ac.signal
        ),
        fetchJson<{ results?: MultiSearchResult[] }>(
          `${base}/movie/top_rated?api_key=${key}&language=es-ES&page=1`,
          ac.signal
        ),
        fetchJson<{ results?: MultiSearchResult[] }>(
          `${base}/trending/tv/day?api_key=${key}&language=es-ES`,
          ac.signal
        )
      ]);

      if (!ac.signal.aborted) {
        setTrendingMovies(td?.results ?? []);
        setTopRatedMovies(tr?.results ?? []);
        setTrendingTv(tt?.results ?? []);
        setBrowseLoading(false);
      }
    }
    loadBrowse();
    return () => ac.abort();
  }, []);

  useEffect(() => {
    if (!debouncedQuery) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const ac = new AbortController();
    const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&language=es-ES&query=${encodeURIComponent(debouncedQuery)}`;

    async function run() {
      setSearchLoading(true);
      const data = await fetchJson<{ results?: MultiSearchResult[] }>(url, ac.signal);
      if (!ac.signal.aborted) {
        const filtered =
          data?.results?.filter((r) => r.media_type === "movie" || r.media_type === "tv") ?? [];
        setSearchResults(filtered);
        setSearchLoading(false);
      }
    }
    run();
    return () => ac.abort();
  }, [debouncedQuery]);

  const openSheet = useCallback((item: MultiSearchResult, media: MediaType) => {
    setSheet({ item, media });
    setStarsPanelOpen(false);
    setDetailMovie(null);
    setDetailTv(null);
    setProviders([]);
  }, []);

  const handlePick = useCallback(
    (item: MultiSearchResult, media: MediaType) => {
      if (media === "movie") {
        router.push(`/pelicula/${item.id}`);
        return;
      }
      if (media === "tv") {
        router.push(`/serie/${item.id}`);
        return;
      }
      openSheet(item, media);
    },
    [openSheet, router]
  );

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

  const toggleWatchlist = useCallback(() => {
    if (!sheet) {
      return;
    }
    const id = watchlistId(sheet.media, sheet.item.id);
    const title = sheet.media === "movie" ? sheet.item.title : sheet.item.name;
    setWatchlist((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((x) => x !== id) : [...prev, id];
      const deduped = Array.from(new Set(next));
      const uid = storageUserIdRef.current;
      if (uid) {
        void saveUserData(uid, "watchlist", deduped);
      }
      if (!exists) {
        void logUserActivity({
          type: "watchlist",
          movieId: sheet.item.id,
          movieTitle: title ?? undefined,
          posterPath: sheet.item.poster_path
        });
      }
      return Array.from(new Set(next));
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
        fromDetail.length > 0 ? fromDetail : sheet.item.genre_ids?.filter((n) => Number.isFinite(n)) ?? [];
      const title =
        sheet.media === "movie"
          ? detailMovie?.title ?? sheet.item.title ?? ""
          : detailTv?.name ?? sheet.item.name ?? "";
      const ratedAt = freshRatedAtIso();
      const uid = storageUserIdRef.current;
      const prev =
        (uid && readUserDataCacheJson<Record<string, unknown>>(uid, "valoraciones")) || {};
      const next = {
        ...prev,
        [key]: { rating: stars, unseen: false, genreIds, title, ratedAt }
      };
      if (uid) {
        void saveUserData(uid, "valoraciones", next);
      }
      setStarsPanelOpen(false);
      setSheet(null);
      void bumpMovieStreak();
      if (sheet.media === "movie") {
        void logUserActivity({
          type: "rated",
          movieId: sheet.item.id,
          movieTitle: title,
          posterPath: sheet.item.poster_path,
          rating: stars
        });
      }
    },
    [sheet, detailMovie, detailTv]
  );

  const searching = debouncedQuery.length > 0;

  return (
    <main className="flex min-h-screen justify-center bg-[#0a0a0a] px-6 pb-28 text-white">
      <div className="relative w-full max-w-[400px] pt-10">
        <p className="mb-6 w-full text-center text-xs uppercase tracking-[0.35em] text-neutral-500 select-none">WhatNext?</p>

        <label className="mb-6 block">
          <span className="sr-only">Buscar</span>
          <div className="flex items-center gap-3 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3">
            <MagnifyingGlassIcon />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar películas, series..."
              className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-neutral-500"
              autoComplete="off"
            />
          </div>
        </label>

        {searching ? (
          <section>
            {searchLoading ? (
              <div className="mx-auto max-w-[220px] space-y-3 py-8">
                <SkeletonShimmer className="h-14 w-full" rounded="xl" />
                <p className="text-center text-sm text-neutral-500">Buscando…</p>
              </div>
            ) : (
              <motion.div
                variants={buscarGridContainer}
                initial="hidden"
                animate="show"
                className="grid grid-cols-3 gap-2"
              >
                {searchResults.map((item) => {
                  const media = item.media_type === "tv" ? "tv" : "movie";
                  const label = media === "movie" ? item.title ?? "—" : item.name ?? "—";
                  const year = yearFromItem(item, media);
                  return (
                    <motion.button
                      key={`${media}-${item.id}`}
                      type="button"
                      variants={buscarGridItem}
                      onClick={() => handlePick(item, media)}
                      className="text-left"
                      whileHover={{ scale: 0.97 }}
                      whileTap={{ scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 450, damping: 28 }}
                    >
                      <div className="aspect-[2/3] w-full overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#141414]">
                        {item.poster_path ? (
                          <Image
                            src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                            alt=""
                            width={342}
                            height={513}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center p-1 text-center text-[9px] text-neutral-600">
                            —
                          </div>
                        )}
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-tight text-white">{label}</p>
                      <p className="text-[10px] text-neutral-500">{year}</p>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
            {!searchLoading && searchResults.length === 0 ? (
              <p className="mt-6 text-center text-sm text-neutral-500">Sin resultados.</p>
            ) : null}
          </section>
        ) : browseLoading ? (
          <div className="space-y-6">
            {[0, 1, 2].map((row) => (
              <div key={row} className="space-y-3">
                <SkeletonShimmer className="h-4 w-36" rounded="md" />
                <div className="flex gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonShimmer key={i} className="h-[150px] w-[100px] flex-shrink-0" rounded="xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <HorizontalPosterRow
              title="Tendencias hoy"
              defaultMedia="movie"
              items={trendingMovies}
              onPick={handlePick}
            />
            <HorizontalPosterRow
              title="Mejor valoradas"
              defaultMedia="movie"
              items={topRatedMovies}
              onPick={handlePick}
            />
            <HorizontalPosterRow
              title="Series populares"
              defaultMedia="tv"
              items={trendingTv}
              onPick={handlePick}
            />
          </>
        )}
      </div>

      <TmdbDetailSheet
        sheet={sheet}
        onClose={() => setSheet(null)}
        detailMovie={detailMovie}
        detailTv={detailTv}
        detailLoading={detailLoading}
        providers={providers}
        watchlist={watchlist}
        onToggleWatchlist={toggleWatchlist}
        starsPanelOpen={starsPanelOpen}
        onToggleStarsPanel={() => setStarsPanelOpen((o) => !o)}
        persistRating={persistRating}
      />

      <BottomNav />
    </main>
  );
}
