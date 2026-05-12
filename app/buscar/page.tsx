"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
import { logUserActivity, syncProfileFromLocal } from "@/lib/social";
import { supabase } from "@/lib/supabase";

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

function SearchIcon({ active = false }: { active?: boolean }) {
  const stroke = active ? "#fff" : "#737373";
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke={stroke} strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function FriendsIcon({ active = false }: { active?: boolean }) {
  const stroke = active ? "#fff" : "#737373";
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="3" stroke={stroke} strokeWidth="1.8" />
      <circle cx="16.5" cy="10.5" r="2.5" stroke={stroke} strokeWidth="1.8" />
      <path d="M4.5 19a4.5 4.5 0 0 1 9 0" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14.5 19a3.5 3.5 0 0 1 5 0" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
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
            <button
              key={`${displayMedia}-${item.id}`}
              type="button"
              onClick={() => onPick(item, displayMedia)}
              className="w-[100px] flex-shrink-0 text-left"
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
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function BuscarPage() {
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

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        void syncProfileFromLocal(user);
      }
    });
  }, []);

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
      window.localStorage.setItem("watchlist", JSON.stringify(Array.from(new Set(next))));
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
      setStarsPanelOpen(false);
      setSheet(null);
      bumpMovieStreak();
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
              <p className="text-center text-sm text-neutral-500">Buscando…</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {searchResults.map((item) => {
                  const media = item.media_type === "tv" ? "tv" : "movie";
                  const label = media === "movie" ? item.title ?? "—" : item.name ?? "—";
                  const year = yearFromItem(item, media);
                  return (
                    <button
                      key={`${media}-${item.id}`}
                      type="button"
                      onClick={() => openSheet(item, media)}
                      className="text-left"
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
                    </button>
                  );
                })}
              </div>
            )}
            {!searchLoading && searchResults.length === 0 ? (
              <p className="mt-6 text-center text-sm text-neutral-500">Sin resultados.</p>
            ) : null}
          </section>
        ) : browseLoading ? (
          <p className="text-center text-sm text-neutral-500">Cargando…</p>
        ) : (
          <>
            <HorizontalPosterRow
              title="Tendencias hoy"
              defaultMedia="movie"
              items={trendingMovies}
              onPick={(item, media) => openSheet(item, media)}
            />
            <HorizontalPosterRow
              title="Mejor valoradas"
              defaultMedia="movie"
              items={topRatedMovies}
              onPick={(item, media) => openSheet(item, media)}
            />
            <HorizontalPosterRow
              title="Series populares"
              defaultMedia="tv"
              items={trendingTv}
              onPick={(item, media) => openSheet(item, media)}
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
              className="flex flex-col items-center gap-1 text-[11px] font-medium text-white"
            >
              <SearchIcon active />
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
            <Link
              href="/perfil"
              className="flex flex-col items-center gap-1 text-[11px] font-medium text-neutral-500 transition hover:text-neutral-300"
            >
              <ProfileIcon />
              <span>Perfil</span>
            </Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}
