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
  type MediaType,
  type MovieDetail,
  type MultiSearchResult,
  type SheetState,
  type TvDetail,
  type WatchProvidersResponse
} from "@/components/TmdbDetailSheet";

type ActivityKind = "watched" | "watchlist" | "recommend";

type ActivityMock = {
  id: string;
  userLabel: string;
  initials: string;
  avatarBg: string;
  kind: ActivityKind;
  stars?: number;
  movieLabel: string;
  timeLabel: string;
  tmdbId: number;
  media: MediaType;
};

const ACTIVITY_MOCK: ActivityMock[] = [
  {
    id: "act-1",
    userLabel: "María G.",
    initials: "MG",
    avatarBg: "#7c3aed",
    kind: "watched",
    stars: 5,
    movieLabel: "Succession",
    timeLabel: "hace 2h",
    tmdbId: 76331,
    media: "tv"
  },
  {
    id: "act-2",
    userLabel: "Javier R.",
    initials: "JR",
    avatarBg: "#2563eb",
    kind: "watchlist",
    movieLabel: "Dune 2",
    timeLabel: "hace 5h",
    tmdbId: 693134,
    media: "movie"
  },
  {
    id: "act-3",
    userLabel: "Ana L.",
    initials: "AL",
    avatarBg: "#db2777",
    kind: "recommend",
    movieLabel: "The Bear",
    timeLabel: "hace 1d",
    tmdbId: 136315,
    media: "tv"
  },
  {
    id: "act-4",
    userLabel: "Carlos M.",
    initials: "CM",
    avatarBg: "#059669",
    kind: "watched",
    stars: 4,
    movieLabel: "Oppenheimer",
    timeLabel: "hace 2d",
    tmdbId: 872585,
    media: "movie"
  },
  {
    id: "act-5",
    userLabel: "Lucía P.",
    initials: "LP",
    avatarBg: "#d97706",
    kind: "watchlist",
    movieLabel: "Severance",
    timeLabel: "hace 3d",
    tmdbId: 95396,
    media: "tv"
  }
];

type FriendMock = {
  id: string;
  initials: string;
  avatarColor: string;
  name: string;
  handle: string;
  statusKind: "watching" | "last";
  statusMovie: string;
  statusTime?: string;
  compatPct: number;
  compatColor: string;
  watchedCount: number;
  favGenre: string;
  avgRating: number;
  commonMedia: { tmdbId: number; media: MediaType }[];
  recoHighRatedMovieIds: number[];
};

const FRIENDS_MOCK: FriendMock[] = [
  {
    id: "f1",
    initials: "LP",
    avatarColor: "#4A90D9",
    name: "Laura P.",
    handle: "@laura_p",
    statusKind: "watching",
    statusMovie: "Breaking Bad",
    compatPct: 92,
    compatColor: "#4A90D9",
    watchedCount: 184,
    favGenre: "Drama",
    avgRating: 4.3,
    commonMedia: [
      { tmdbId: 693134, media: "movie" },
      { tmdbId: 872585, media: "movie" },
      { tmdbId: 76331, media: "tv" }
    ],
    recoHighRatedMovieIds: [545611, 496243, 376867]
  },
  {
    id: "f2",
    initials: "DM",
    avatarColor: "#00A550",
    name: "Diego M.",
    handle: "@diegom",
    statusKind: "last",
    statusMovie: "Poor Things",
    statusTime: "hace 4d",
    compatPct: 86,
    compatColor: "#00A550",
    watchedCount: 96,
    favGenre: "Sci-fi",
    avgRating: 4.1,
    commonMedia: [
      { tmdbId: 27205, media: "movie" },
      { tmdbId: 603, media: "movie" },
      { tmdbId: 335984, media: "movie" }
    ],
    recoHighRatedMovieIds: [76600, 324857, 284054]
  },
  {
    id: "f3",
    initials: "SR",
    avatarColor: "#9370DB",
    name: "Sara R.",
    handle: "@sararu",
    statusKind: "watching",
    statusMovie: "Past Lives",
    compatPct: 78,
    compatColor: "#9370DB",
    watchedCount: 142,
    favGenre: "Romance",
    avgRating: 4.6,
    commonMedia: [
      { tmdbId: 872585, media: "movie" },
      { tmdbId: 575265, media: "movie" },
      { tmdbId: 99770, media: "tv" }
    ],
    recoHighRatedMovieIds: [569094, 615457, 575265]
  }
];

const APP_URL = "https://whatnext-gray.vercel.app";
const WHATSAPP_INVITE_TEXT =
  "Oye, estoy usando WhatNext? para encontrar películas perfectas para mí. Pruébalo en whatnext-gray.vercel.app";

function stubMultiResult(id: number, media: MediaType, posterPath?: string | null): MultiSearchResult {
  return {
    id,
    media_type: media,
    poster_path: posterPath ?? undefined,
    title: media === "movie" ? " " : undefined,
    name: media === "tv" ? " " : undefined,
    overview: ""
  };
}

function starsText(n: number): string {
  const filled = Math.min(5, Math.max(0, Math.round(n)));
  return `${"★".repeat(filled)}${"☆".repeat(5 - filled)}`;
}

function ActivityDescription({ act }: { act: ActivityMock }) {
  const tail = (
    <>
      {" "}
      · <span className="text-neutral-500">{act.timeLabel}</span>
    </>
  );

  if (act.kind === "watched") {
    return (
      <p className="text-xs leading-snug text-neutral-300">
        <span className="font-medium text-white">{act.userLabel}</span> acaba de ver{" "}
        <span className="text-white">{act.movieLabel}</span>
        {act.stars != null ? (
          <>
            {" "}
            <span className="text-[#fbbf24]">{starsText(act.stars)}</span>
          </>
        ) : null}
        {tail}
      </p>
    );
  }

  if (act.kind === "watchlist") {
    return (
      <p className="text-xs leading-snug text-neutral-300">
        <span className="font-medium text-white">{act.userLabel}</span> añadió{" "}
        <span className="text-white">{act.movieLabel}</span> a su watchlist
        {tail}
      </p>
    );
  }

  return (
    <p className="text-xs leading-snug text-neutral-300">
      <span className="font-medium text-white">{act.userLabel}</span> recomienda{" "}
      <span className="text-white">{act.movieLabel}</span>
      {tail}
    </p>
  );
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

function filterRecoNotSeenByUser(movieIds: number[]): number[] {
  try {
    const raw = window.localStorage.getItem("valoraciones");
    const val = raw ? (JSON.parse(raw) as Record<string, { rating?: number }>) : {};
    return movieIds.filter((id) => {
      const row = val[`tmdb-${id}`];
      return !(row && typeof row.rating === "number" && row.rating > 0);
    });
  } catch {
    return movieIds;
  }
}

type PosterSlot = { key: string; path: string | null };
type RecoPosterSlot = { movieId: number; path: string | null };

function FriendProfileSheet({
  friend,
  onClose,
  commonPosters,
  recoPosters,
  onOpenRecoMovie
}: {
  friend: FriendMock | null;
  onClose: () => void;
  commonPosters: PosterSlot[];
  recoPosters: RecoPosterSlot[];
  onOpenRecoMovie: (movieId: number) => void;
}) {
  if (!friend) {
    return null;
  }

  return (
    <>
      <button type="button" aria-label="Cerrar perfil" className="fixed inset-0 z-[48] bg-black/70" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="friend-profile-title"
        className="fixed bottom-0 left-1/2 z-[50] max-h-[90vh] w-full max-w-[400px] -translate-x-1/2 overflow-y-auto rounded-t-2xl border border-[#2a2a2a] border-b-0 bg-[#111]"
      >
        <div className="sticky top-0 z-10 mx-auto mt-2 h-1 w-10 rounded-full bg-[#3f3f46]" />
        <div className="px-5 pb-10 pt-6">
          <div className="mb-4 flex flex-col items-center">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full text-xl font-bold text-white"
              style={{ backgroundColor: friend.avatarColor }}
            >
              {friend.initials}
            </div>
            <h2 id="friend-profile-title" className="mt-4 text-xl font-semibold text-white">
              {friend.name}
            </h2>
            <p className="text-sm text-neutral-500">{friend.handle}</p>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-[#2a2a2a] bg-[#161616] px-2 py-3">
              <p className="text-lg font-bold text-white">{friend.watchedCount}</p>
              <p className="text-[10px] text-neutral-500">películas vistas</p>
            </div>
            <div className="rounded-xl border border-[#2a2a2a] bg-[#161616] px-2 py-3">
              <p className="text-sm font-bold leading-tight text-[#9370DB]">{friend.favGenre}</p>
              <p className="text-[10px] text-neutral-500">género favorito</p>
            </div>
            <div className="rounded-xl border border-[#2a2a2a] bg-[#161616] px-2 py-3">
              <p className="text-lg font-bold text-[#fbbf24]">{friend.avgRating.toFixed(1)}</p>
              <p className="text-[10px] text-neutral-500">media</p>
            </div>
          </div>

          <div className="mb-5 rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-3">
            <p className="text-xs text-neutral-400">Compatibilidad contigo</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#2a2a2a]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${friend.compatPct}%`, backgroundColor: friend.compatColor }}
                />
              </div>
              <span className="text-sm font-semibold text-white">{friend.compatPct}%</span>
            </div>
          </div>

          <div className="mb-5">
            <p className="mb-2 text-sm font-semibold text-white">Películas en común</p>
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {commonPosters.map((p) => (
                <div
                  key={p.key}
                  className="h-[110px] w-[73px] flex-shrink-0 overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#1a1a1a]"
                >
                  {p.path ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w185${p.path}`}
                      alt=""
                      width={185}
                      height={278}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-neutral-600">—</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <p className="mb-2 text-sm font-semibold text-white">Sus recomendaciones para ti</p>
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {recoPosters.map((p) => (
                  <button
                    key={p.movieId}
                    type="button"
                    onClick={() => onOpenRecoMovie(p.movieId)}
                    className="text-left"
                  >
                    <div className="h-[110px] w-[73px] flex-shrink-0 overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#1a1a1a]">
                      {p.path ? (
                        <Image
                          src={`https://image.tmdb.org/t/p/w185${p.path}`}
                          alt=""
                          width={185}
                          height={278}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-neutral-600">—</div>
                      )}
                    </div>
                  </button>
              ))}
            </div>
            {recoPosters.length === 0 ? (
              <p className="text-xs text-neutral-500">Ya has valorado sus mejores picks.</p>
            ) : null}
          </div>

          <button
            type="button"
            className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-neutral-100"
          >
            Recomendar película
          </button>
        </div>
      </div>
    </>
  );
}

export default function AmigosPage() {
  const [friendSearch, setFriendSearch] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [activityPosters, setActivityPosters] = useState<Record<string, string | null>>({});
  const [friendSheet, setFriendSheet] = useState<FriendMock | null>(null);
  const [commonPosterPaths, setCommonPosterPaths] = useState<PosterSlot[]>([]);
  const [recoPosterPaths, setRecoPosterPaths] = useState<RecoPosterSlot[]>([]);
  const [recoEpoch, setRecoEpoch] = useState(0);

  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [detailMovie, setDetailMovie] = useState<MovieDetail | null>(null);
  const [detailTv, setDetailTv] = useState<TvDetail | null>(null);
  const [providers, setProviders] = useState<string[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [starsPanelOpen, setStarsPanelOpen] = useState(false);

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
    const key = TMDB_API_KEY;
    const base = `https://api.themoviedb.org/3`;

    async function loadActivityPosters() {
      const entries = await Promise.all(
        ACTIVITY_MOCK.map(async (act) => {
          const url =
            act.media === "movie"
              ? `${base}/movie/${act.tmdbId}?api_key=${key}&language=es-ES`
              : `${base}/tv/${act.tmdbId}?api_key=${key}&language=es-ES`;
          const data = await fetchJson<{ poster_path?: string | null }>(url, ac.signal);
          return [act.id, data?.poster_path ?? null] as const;
        })
      );
      if (!ac.signal.aborted) {
        setActivityPosters(Object.fromEntries(entries));
      }
    }
    loadActivityPosters();
    return () => ac.abort();
  }, []);

  useEffect(() => {
    if (!friendSheet) {
      setCommonPosterPaths([]);
      setRecoPosterPaths([]);
      return;
    }

    const ac = new AbortController();
    const key = TMDB_API_KEY;
    const base = `https://api.themoviedb.org/3`;

    async function loadFriendVisuals() {
      const common = await Promise.all(
        friendSheet.commonMedia.map(async (m, i) => {
          const url =
            m.media === "movie"
              ? `${base}/movie/${m.tmdbId}?api_key=${key}&language=es-ES`
              : `${base}/tv/${m.tmdbId}?api_key=${key}&language=es-ES`;
          const data = await fetchJson<{ poster_path?: string | null }>(url, ac.signal);
          return { key: `common-${friendSheet.id}-${i}`, path: data?.poster_path ?? null } satisfies PosterSlot;
        })
      );

      const filteredReco = filterRecoNotSeenByUser(friendSheet.recoHighRatedMovieIds).slice(0, 3);
      const reco = await Promise.all(
        filteredReco.map(async (movieId) => {
          const url = `${base}/movie/${movieId}?api_key=${key}&language=es-ES`;
          const data = await fetchJson<{ poster_path?: string | null }>(url, ac.signal);
          return { movieId, path: data?.poster_path ?? null } satisfies RecoPosterSlot;
        })
      );

      if (!ac.signal.aborted) {
        setCommonPosterPaths(common);
        setRecoPosterPaths(reco);
      }
    }
    loadFriendVisuals();
    return () => ac.abort();
  }, [friendSheet, recoEpoch]);

  const openTmdbSheet = useCallback((item: MultiSearchResult, media: MediaType) => {
    setFriendSheet(null);
    setSheet({ item, media });
    setStarsPanelOpen(false);
    setDetailMovie(null);
    setDetailTv(null);
    setProviders([]);
  }, []);

  const openFriendSheet = useCallback((f: FriendMock) => {
    setSheet(null);
    setStarsPanelOpen(false);
    setFriendSheet(f);
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
          fetchJson<MovieDetail>(`${base}/movie/${item.id}?api_key=${key}&language=es-ES`, ac.signal),
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
          fetchJson<WatchProvidersResponse>(`${base}/tv/${item.id}/watch/providers?api_key=${key}`, ac.signal)
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
    setWatchlist((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      window.localStorage.setItem("watchlist", JSON.stringify(Array.from(new Set(next))));
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
        const next = { ...prev, [key]: { rating: stars, unseen: false, genreIds, title } };
        window.localStorage.setItem("valoraciones", JSON.stringify(next));
      } catch {
        window.localStorage.setItem(
          "valoraciones",
          JSON.stringify({ [key]: { rating: stars, unseen: false, genreIds, title } })
        );
      }
      setStarsPanelOpen(false);
      setSheet(null);
      setRecoEpoch((e) => e + 1);
    },
    [sheet, detailMovie, detailTv]
  );

  const openWhatsAppInvite = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(WHATSAPP_INVITE_TEXT)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyAppLink = () => {
    void navigator.clipboard.writeText(APP_URL).then(() => {
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const openRecoFromProfile = (movieId: number) => {
    setFriendSheet(null);
    openTmdbSheet(stubMultiResult(movieId, "movie"), "movie");
  };

  return (
    <main className="flex min-h-screen justify-center bg-[#0a0a0a] px-6 pb-28 text-white">
      <div className="relative w-full max-w-[400px] pt-10">
        <p className="mb-6 w-full text-center text-xs uppercase tracking-[0.35em] text-neutral-500">WhatNext?</p>

        <section className="mb-8">
          <div className="flex gap-2">
            <label className="block min-w-0 flex-1">
              <span className="sr-only">Buscar amigos</span>
              <div className="flex items-center gap-3 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3">
                <MagnifyingGlassIcon />
                <input
                  type="search"
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  placeholder="Buscar amigos..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-neutral-500"
                />
              </div>
            </label>
            <button
              type="button"
              className="flex-shrink-0 rounded-xl border border-neutral-600 px-4 py-3 text-sm font-medium text-neutral-200 transition hover:border-neutral-400 hover:text-white"
            >
              Invitar
            </button>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-white">Actividad reciente</h2>
          <ul className="space-y-2.5">
            {ACTIVITY_MOCK.map((act) => (
              <li key={act.id}>
                <button
                  type="button"
                  onClick={() =>
                    openTmdbSheet(
                      stubMultiResult(act.tmdbId, act.media, activityPosters[act.id]),
                      act.media
                    )
                  }
                  className="flex w-full items-center gap-3 rounded-xl border border-[#2a2a2a] bg-[#101010] px-3 py-3 text-left transition hover:border-neutral-600"
                >
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: act.avatarBg }}
                  >
                    {act.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <ActivityDescription act={act} />
                  </div>
                  <div className="h-[52px] w-[35px] flex-shrink-0 overflow-hidden rounded-md border border-[#2a2a2a] bg-[#1a1a1a]">
                    {activityPosters[act.id] ? (
                      <Image
                        src={`https://image.tmdb.org/t/p/w92${activityPosters[act.id]}`}
                        alt=""
                        width={92}
                        height={138}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[8px] text-neutral-600">···</div>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-white">Tus amigos</h2>
          <ul className="space-y-3">
            {FRIENDS_MOCK.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => openFriendSheet(f)}
                  className="w-full rounded-xl border border-[#2a2a2a] bg-[#101010] px-3 py-3 text-left transition hover:border-neutral-600"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: f.avatarColor }}
                    >
                      {f.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white">{f.name}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {f.statusKind === "watching"
                          ? `Viendo ahora: ${f.statusMovie}`
                          : `Última vez: ${f.statusMovie}${f.statusTime ? ` ${f.statusTime}` : ""}`}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#2a2a2a]">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${f.compatPct}%`, backgroundColor: f.compatColor }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-neutral-300">{f.compatPct}%</span>
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-4 rounded-xl border border-[#2a2a2a] bg-[#101010] px-4 py-5">
          <h3 className="text-center text-base font-semibold text-white">Descubre amigos</h3>
          <p className="mt-3 text-center text-sm leading-relaxed text-neutral-300">
            ¿A quién conoces que también pierda tiempo buscando qué ver?
          </p>
          <button
            type="button"
            onClick={openWhatsAppInvite}
            className="mt-5 w-full rounded-xl bg-[#25D366] py-3 text-sm font-semibold text-white transition hover:bg-[#20bd5a]"
          >
            Invitar por WhatsApp
          </button>
          <button
            type="button"
            onClick={copyAppLink}
            className="mt-3 w-full rounded-xl border border-[#333] bg-[#1a1a1a] py-3 text-sm font-medium text-white transition hover:border-neutral-500"
          >
            {linkCopied ? "Copiado" : "Copiar enlace"}
          </button>
          <p className="mt-4 text-center text-xs text-neutral-500">
            Cuantos más amigos, mejores recomendaciones
          </p>
        </section>
      </div>

      <FriendProfileSheet
        friend={friendSheet}
        onClose={() => setFriendSheet(null)}
        commonPosters={commonPosterPaths}
        recoPosters={recoPosterPaths}
        onOpenRecoMovie={openRecoFromProfile}
      />

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
              className="flex flex-col items-center gap-1 text-[11px] font-medium text-neutral-500 transition hover:text-neutral-300"
            >
              <SearchIcon />
              <span>Buscar</span>
            </Link>
          </li>
          <li>
            <Link href="/amigos" className="flex flex-col items-center gap-1 text-[11px] font-medium text-white">
              <FriendsIcon active />
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
