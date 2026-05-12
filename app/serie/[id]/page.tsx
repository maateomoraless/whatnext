"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { MotionButton } from "@/components/ui/MotionButton";
import { SkeletonShimmer } from "@/components/ui/SkeletonShimmer";
import {
  TMDB_API_KEY,
  collectProviderNames,
  fetchJson,
  ratingStorageKey,
  watchlistId,
  type WatchProvidersResponse
} from "@/components/TmdbDetailSheet";
import { freshRatedAtIso } from "@/lib/historyValoraciones";
import { bumpMovieStreak } from "@/lib/movieStreak";
import { logUserActivity } from "@/lib/social";

type TvShowDetail = {
  name?: string;
  first_air_date?: string;
  overview?: string;
  genres?: Array<{ id: number; name: string }>;
  poster_path?: string | null;
  vote_average?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
};

type TvCreditsResponse = {
  cast?: Array<{
    id: number;
    name?: string;
    character?: string;
    profile_path?: string | null;
  }>;
};

type CastMember = NonNullable<TvCreditsResponse["cast"]>[number];

type TvVideosResponse = {
  results?: Array<{
    id: string;
    key?: string;
    site?: string;
    type?: string;
    official?: boolean;
    name?: string;
  }>;
};

type ExternalIdsResponse = {
  imdb_id?: string | null;
};

type OmdbAwardsResponse = {
  Awards?: string;
  Response?: string;
};

function hasRelevantAwards(awardsRaw?: string): boolean {
  if (!awardsRaw || awardsRaw.trim() === "" || awardsRaw === "N/A") {
    return false;
  }
  return /Oscar|BAFTA|Golden Globe|Globos de Oro|win|nomination|Emmy/i.test(awardsRaw);
}

function formatSeasonsEpisodes(detail: TvShowDetail | null): string {
  const seasons = detail?.number_of_seasons;
  const episodes = detail?.number_of_episodes;
  if ((seasons == null || seasons <= 0) && (episodes == null || episodes <= 0)) {
    return "—";
  }
  const s = seasons != null && seasons > 0 ? `${seasons} ${seasons === 1 ? "temporada" : "temporadas"}` : null;
  const e = episodes != null && episodes > 0 ? `${episodes} episodios` : null;
  if (s && e) {
    return `${s} · ${e}`;
  }
  return s ?? e ?? "—";
}

const castStagger: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.05, delayChildren: 0.08 }
  }
};

const castItem: Variants = {
  hidden: { opacity: 0, x: 16 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }
};

export default function SerieDetallePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const tvId = Number(params?.id);

  const [detail, setDetail] = useState<TvShowDetail | null>(null);
  const [providers, setProviders] = useState<string[]>([]);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
  const [awardsText, setAwardsText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [showStars, setShowStars] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("watchlist");
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setWatchlist(parsed.filter((v): v is string => typeof v === "string"));
      }
    } catch {
      // ignore bad local storage
    }
  }, []);

  useEffect(() => {
    if (!Number.isFinite(tvId)) {
      return;
    }
    let cancelled = false;
    const ac = new AbortController();

    const run = async () => {
      setLoading(true);
      const base = "https://api.themoviedb.org/3/tv";
      const [detailRes, creditsRes, videosRes, providersRes, externalIdsRes] = await Promise.all([
        fetchJson<TvShowDetail>(`${base}/${tvId}?api_key=${TMDB_API_KEY}&language=es-ES`, ac.signal),
        fetchJson<TvCreditsResponse>(`${base}/${tvId}/credits?api_key=${TMDB_API_KEY}&language=es-ES`, ac.signal),
        fetchJson<TvVideosResponse>(`${base}/${tvId}/videos?api_key=${TMDB_API_KEY}`, ac.signal),
        fetchJson<WatchProvidersResponse>(`${base}/${tvId}/watch/providers?api_key=${TMDB_API_KEY}`, ac.signal),
        fetchJson<ExternalIdsResponse>(`${base}/${tvId}/external_ids?api_key=${TMDB_API_KEY}`, ac.signal)
      ]);

      if (cancelled) {
        return;
      }

      setDetail(detailRes ?? null);
      setCast((creditsRes?.cast ?? []).slice(0, 8));
      setProviders(collectProviderNames(providersRes));

      const trailers =
        (videosRes?.results ?? []).filter((v) => v.site === "YouTube" && typeof v.key === "string" && v.key.length > 0) ??
        [];
      const bestTrailer =
        trailers.find((v) => v.type === "Trailer" && v.official) ??
        trailers.find((v) => v.type === "Trailer") ??
        trailers[0];
      setTrailerUrl(bestTrailer?.key ? `https://www.youtube.com/watch?v=${bestTrailer.key}` : null);

      if (externalIdsRes?.imdb_id) {
        const omdb = await fetchJson<OmdbAwardsResponse>(
          `https://www.omdbapi.com/?i=${encodeURIComponent(externalIdsRes.imdb_id)}&apikey=7f1e4d5a`,
          ac.signal
        );
        if (!cancelled) {
          const rawAwards = omdb?.Awards;
          setAwardsText(hasRelevantAwards(rawAwards) ? rawAwards ?? null : null);
        }
      } else {
        setAwardsText(null);
      }
      if (!cancelled) {
        setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [tvId]);

  const title = detail?.name ?? "Serie";
  const year = detail?.first_air_date?.slice(0, 4) ?? "—";
  const genres = detail?.genres?.map((g) => g.name).join(", ") ?? "—";
  const inWatchlist = watchlist.includes(watchlistId("tv", tvId));
  const tmdbScore =
    typeof detail?.vote_average === "number" && Number.isFinite(detail.vote_average)
      ? detail.vote_average.toFixed(1)
      : "—";

  const handleToggleWatchlist = () => {
    const wid = watchlistId("tv", tvId);
    setWatchlist((prev) => {
      const exists = prev.includes(wid);
      const next = exists ? prev.filter((v) => v !== wid) : [...prev, wid];
      const deduped = Array.from(new Set(next));
      window.localStorage.setItem("watchlist", JSON.stringify(deduped));
      if (!exists) {
        void logUserActivity({
          type: "watchlist",
          movieId: tvId,
          movieTitle: title,
          posterPath: detail?.poster_path ?? null
        });
      }
      return deduped;
    });
  };

  const persistRating = (stars: number) => {
    const key = ratingStorageKey("tv", tvId);
    const genreIds = detail?.genres?.map((g) => g.id).filter((n) => Number.isFinite(n)) ?? [];
    const ratedAt = freshRatedAtIso();
    try {
      const raw = window.localStorage.getItem("valoraciones");
      const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const next = {
        ...prev,
        [key]: { rating: stars, unseen: false, genreIds, title, ratedAt }
      };
      window.localStorage.setItem("valoraciones", JSON.stringify(next));
    } catch {
      window.localStorage.setItem(
        "valoraciones",
        JSON.stringify({ [key]: { rating: stars, unseen: false, genreIds, title, ratedAt } })
      );
    }
    setShowStars(false);
    void bumpMovieStreak();
    void logUserActivity({
      type: "rated",
      movieId: tvId,
      movieTitle: title,
      posterPath: detail?.poster_path ?? null,
      rating: stars
    });
  };

  const markAsSeen = () => {
    const key = ratingStorageKey("tv", tvId);
    const genreIds = detail?.genres?.map((g) => g.id).filter((n) => Number.isFinite(n)) ?? [];
    try {
      const raw = window.localStorage.getItem("valoraciones");
      const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const next = {
        ...prev,
        [key]: { rating: 0, unseen: true, genreIds, title }
      };
      window.localStorage.setItem("valoraciones", JSON.stringify(next));
    } catch {
      window.localStorage.setItem(
        "valoraciones",
        JSON.stringify({ [key]: { rating: 0, unseen: true, genreIds, title } })
      );
    }
    void bumpMovieStreak();
    void logUserActivity({
      type: "watched",
      movieId: tvId,
      movieTitle: title,
      posterPath: detail?.poster_path ?? null
    });
  };

  const providerText = useMemo(() => {
    if (providers.length === 0) {
      return "No disponible en streaming por suscripción en España.";
    }
    return providers.join(" · ");
  }, [providers]);

  if (!Number.isFinite(tvId)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-neutral-400">ID inválido.</main>
    );
  }

  return (
    <main className="flex min-h-screen justify-center bg-[#0a0a0a] px-6 pb-10 text-white">
      <section className="w-full max-w-[400px] pt-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-5 rounded-lg border border-[#2a2a2a] bg-[#101010] px-3 py-2 text-sm text-neutral-200 transition hover:border-neutral-500 hover:text-white"
        >
          ← Volver
        </button>

        {loading ? (
          <div className="space-y-4 py-8">
            <div className="flex gap-3">
              <SkeletonShimmer className="h-[180px] w-[120px] flex-shrink-0" rounded="lg" />
              <div className="min-w-0 flex-1 space-y-2 pt-1">
                <SkeletonShimmer className="h-6 w-full" rounded="md" />
                <SkeletonShimmer className="h-3 w-1/3" rounded="md" />
                <SkeletonShimmer className="h-16 w-full" rounded="lg" />
              </div>
            </div>
            <p className="text-center text-sm text-neutral-500">Cargando detalle...</p>
          </div>
        ) : (
          <>
            <article className="rounded-xl border border-[#2a2a2a] bg-[#101010] p-3">
              <div className="flex gap-3">
                <motion.div
                  className="relative w-[120px] flex-shrink-0 overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#141414]"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 26 }}
                >
                  {detail?.poster_path ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w500${detail.poster_path}`}
                      alt={`Póster de ${title}`}
                      width={500}
                      height={750}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-[180px] items-center justify-center text-xs text-neutral-600">Sin póster</div>
                  )}
                </motion.div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl font-semibold leading-tight text-white">{title}</h1>
                  <p className="mt-1 text-sm text-neutral-400">{year}</p>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-300">{genres}</p>
                  <div className="mt-4 space-y-1 text-sm text-neutral-300">
                    <p>
                      TMDB: <span className="font-medium text-white">{tmdbScore}</span>
                    </p>
                    <p>
                      <span className="font-medium text-white">{formatSeasonsEpisodes(detail)}</span>
                    </p>
                  </div>
                </div>
              </div>
            </article>

            <section className="mt-4 rounded-xl border border-[#2a2a2a] bg-[#101010] p-4">
              <h2 className="text-sm font-semibold text-white">Sinopsis</h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                {detail?.overview?.trim() || "Sin sinopsis disponible."}
              </p>
            </section>

            <section className="mt-4 rounded-xl border border-[#2a2a2a] bg-[#101010] p-4">
              <h2 className="text-sm font-semibold text-white">Dónde verla en España</h2>
              <p className="mt-2 text-sm text-neutral-300">{providerText}</p>
            </section>

            {awardsText ? (
              <section className="mt-4 rounded-xl border border-[#2a2a2a] bg-[#101010] p-4">
                <h2 className="text-sm font-semibold text-white">Premios y nominaciones</h2>
                <p className="mt-2 text-sm leading-relaxed text-neutral-300">🏆 {awardsText}</p>
              </section>
            ) : null}

            <section className="mt-4 rounded-xl border border-[#2a2a2a] bg-[#101010] p-4">
              <h2 className="text-sm font-semibold text-white">Reparto principal</h2>
              <motion.div
                variants={castStagger}
                initial="hidden"
                animate="show"
                className="mt-3 flex gap-3 overflow-x-auto pb-1"
              >
                {cast.length === 0 ? (
                  <p className="text-sm text-neutral-500">No hay datos de reparto.</p>
                ) : (
                  cast.map((actor) => (
                    <motion.article key={actor.id} variants={castItem} className="w-[100px] flex-shrink-0">
                      <div className="h-[120px] w-full overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#141414]">
                        {actor.profile_path ? (
                          <Image
                            src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                            alt={actor.name ?? "Actor"}
                            width={185}
                            height={278}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[10px] text-neutral-600">
                            Sin foto
                          </div>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs font-medium text-white">{actor.name ?? "—"}</p>
                      <p className="line-clamp-2 text-[11px] text-neutral-500">{actor.character ?? "—"}</p>
                    </motion.article>
                  ))
                )}
              </motion.div>
            </section>

            <div className="mt-4 space-y-2">
              <MotionButton
                type="button"
                disabled={!trailerUrl}
                onClick={() => {
                  if (trailerUrl) {
                    window.open(trailerUrl, "_blank", "noopener,noreferrer");
                  }
                }}
                className="w-full rounded-xl border border-[#2a2a2a] bg-[#101010] py-3 text-sm font-medium text-white transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Ver tráiler
              </MotionButton>
              <MotionButton
                type="button"
                onClick={handleToggleWatchlist}
                className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-neutral-100"
              >
                {inWatchlist ? "Ya está en watchlist" : "Añadir a watchlist"}
              </MotionButton>
              <MotionButton
                type="button"
                onClick={() => setShowStars((v) => !v)}
                className="w-full rounded-xl border border-[#2a2a2a] bg-[#101010] py-3 text-sm font-medium text-white transition hover:border-neutral-500"
              >
                Ya la vi
              </MotionButton>
              {showStars ? (
                <div className="rounded-xl border border-[#2a2a2a] bg-[#101010] p-3">
                  <p className="mb-2 text-center text-xs text-neutral-500">Valora esta serie</p>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <motion.button
                        key={star}
                        type="button"
                        onClick={() => persistRating(star)}
                        className="h-8 w-8 rounded-md bg-[#202020] text-sm text-neutral-300 transition hover:bg-[#fbbf24] hover:text-black"
                        whileTap={{ scale: 0.88 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      >
                        ★
                      </motion.button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={markAsSeen}
                    className="mt-3 w-full rounded-md border border-dashed border-neutral-600 py-1.5 text-xs text-neutral-400 transition hover:border-neutral-500 hover:text-neutral-200"
                  >
                    Solo marcar como vista
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
