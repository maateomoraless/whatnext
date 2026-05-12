"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  TMDB_API_KEY,
  collectProviderNames,
  fetchJson,
  ratingStorageKey,
  watchlistId,
  type MovieDetail,
  type WatchProvidersResponse
} from "@/components/TmdbDetailSheet";
import { bumpMovieStreak } from "@/lib/movieStreak";
import { logUserActivity } from "@/lib/social";

type MovieCreditsResponse = {
  cast?: Array<{
    id: number;
    name?: string;
    character?: string;
    profile_path?: string | null;
  }>;
};

type CastMember = NonNullable<MovieCreditsResponse["cast"]>[number];

type MovieVideosResponse = {
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

function formatRuntime(minutes?: number): string {
  if (!minutes || minutes <= 0) {
    return "—";
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) {
    return `${m} min`;
  }
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

function parseAwardsBadge(awardsRaw?: string): string | null {
  if (!awardsRaw || awardsRaw.trim() === "" || awardsRaw === "N/A") {
    return null;
  }
  const txt = awardsRaw;
  const wonOscars = txt.match(/Won\s+(\d+)\s+Oscar/i);
  if (wonOscars?.[1]) {
    return `${wonOscars[1]} Premios Oscar`;
  }
  const nominatedOscars = txt.match(/Nominated for\s+(\d+)\s+Oscar/i);
  if (nominatedOscars?.[1]) {
    return `${nominatedOscars[1]} Nominaciones al Oscar`;
  }
  if (/BAFTA|Golden Globe|Globos de Oro/i.test(txt)) {
    return "Premiada en festivales internacionales";
  }
  return null;
}

function hasRelevantAwards(awardsRaw?: string): boolean {
  if (!awardsRaw || awardsRaw.trim() === "" || awardsRaw === "N/A") {
    return false;
  }
  return /Oscar|BAFTA|Golden Globe|Globos de Oro|win|nomination/i.test(awardsRaw);
}

export default function PeliculaDetallePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const movieId = Number(params?.id);

  const [detail, setDetail] = useState<MovieDetail | null>(null);
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
    if (!Number.isFinite(movieId)) {
      return;
    }
    let cancelled = false;
    const ac = new AbortController();

    const run = async () => {
      setLoading(true);
      const base = "https://api.themoviedb.org/3/movie";
      const [detailRes, creditsRes, videosRes, providersRes, externalIdsRes] = await Promise.all([
        fetchJson<MovieDetail & { vote_average?: number } & { genres?: Array<{ name: string }> }>(
          `${base}/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=keywords&language=es-ES`,
          ac.signal
        ),
        fetchJson<MovieCreditsResponse>(`${base}/${movieId}/credits?api_key=${TMDB_API_KEY}&language=es-ES`, ac.signal),
        fetchJson<MovieVideosResponse>(`${base}/${movieId}/videos?api_key=${TMDB_API_KEY}`, ac.signal),
        fetchJson<WatchProvidersResponse>(`${base}/${movieId}/watch/providers?api_key=${TMDB_API_KEY}`, ac.signal),
        fetchJson<ExternalIdsResponse>(`${base}/${movieId}/external_ids?api_key=${TMDB_API_KEY}`, ac.signal)
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
  }, [movieId]);

  const title = detail?.title ?? "Película";
  const year = detail?.release_date?.slice(0, 4) ?? "—";
  const genres = detail?.genres?.map((g) => g.name).join(", ") ?? "—";
  const inWatchlist = watchlist.includes(watchlistId("movie", movieId));
  const tmdbScore = typeof (detail as { vote_average?: number } | null)?.vote_average === "number"
    ? (detail as { vote_average?: number }).vote_average!.toFixed(1)
    : "—";

  const handleToggleWatchlist = () => {
    const wid = watchlistId("movie", movieId);
    setWatchlist((prev) => {
      const exists = prev.includes(wid);
      const next = exists ? prev.filter((v) => v !== wid) : [...prev, wid];
      const deduped = Array.from(new Set(next));
      window.localStorage.setItem("watchlist", JSON.stringify(deduped));
      if (!exists) {
        void logUserActivity({
          type: "watchlist",
          movieId,
          movieTitle: title,
          posterPath: detail?.poster_path ?? null
        });
      }
      return deduped;
    });
  };

  const persistRating = (stars: number) => {
    const key = ratingStorageKey("movie", movieId);
    const genreIds = detail?.genres?.map((g) => g.id).filter((n) => Number.isFinite(n)) ?? [];
    try {
      const raw = window.localStorage.getItem("valoraciones");
      const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const next = {
        ...prev,
        [key]: { rating: stars, unseen: false, genreIds, title }
      };
      window.localStorage.setItem("valoraciones", JSON.stringify(next));
    } catch {
      window.localStorage.setItem("valoraciones", JSON.stringify({ [key]: { rating: stars, unseen: false, genreIds, title } }));
    }
    setShowStars(false);
    bumpMovieStreak();
    void logUserActivity({
      type: "rated",
      movieId,
      movieTitle: title,
      posterPath: detail?.poster_path ?? null,
      rating: stars
    });
  };

  const markAsSeen = () => {
    const key = ratingStorageKey("movie", movieId);
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
      window.localStorage.setItem("valoraciones", JSON.stringify({ [key]: { rating: 0, unseen: true, genreIds, title } }));
    }
    bumpMovieStreak();
    void logUserActivity({
      type: "watched",
      movieId,
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

  if (!Number.isFinite(movieId)) {
    return <main className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-neutral-400">ID inválido.</main>;
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
          <p className="py-20 text-center text-sm text-neutral-500">Cargando detalle...</p>
        ) : (
          <>
            <article className="rounded-xl border border-[#2a2a2a] bg-[#101010] p-3">
              <div className="flex gap-3">
                <div className="relative w-[120px] flex-shrink-0 overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#141414]">
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
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl font-semibold leading-tight text-white">{title}</h1>
                  <p className="mt-1 text-sm text-neutral-400">{year}</p>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-300">{genres}</p>
                  <div className="mt-4 space-y-1 text-sm text-neutral-300">
                    <p>TMDB: <span className="font-medium text-white">{tmdbScore}</span></p>
                    <p>Duración: <span className="font-medium text-white">{formatRuntime(detail?.runtime)}</span></p>
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
              <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                {cast.length === 0 ? (
                  <p className="text-sm text-neutral-500">No hay datos de reparto.</p>
                ) : (
                  cast.map((actor) => (
                    <article key={actor.id} className="w-[100px] flex-shrink-0">
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
                          <div className="flex h-full items-center justify-center text-[10px] text-neutral-600">Sin foto</div>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs font-medium text-white">{actor.name ?? "—"}</p>
                      <p className="line-clamp-2 text-[11px] text-neutral-500">{actor.character ?? "—"}</p>
                    </article>
                  ))
                )}
              </div>
            </section>

            <div className="mt-4 space-y-2">
              <button
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
              </button>
              <button
                type="button"
                onClick={handleToggleWatchlist}
                className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-neutral-100"
              >
                {inWatchlist ? "Ya está en watchlist" : "Añadir a watchlist"}
              </button>
              <button
                type="button"
                onClick={() => setShowStars((v) => !v)}
                className="w-full rounded-xl border border-[#2a2a2a] bg-[#101010] py-3 text-sm font-medium text-white transition hover:border-neutral-500"
              >
                Ya la vi
              </button>
              {showStars ? (
                <div className="rounded-xl border border-[#2a2a2a] bg-[#101010] p-3">
                  <p className="mb-2 text-center text-xs text-neutral-500">Valora esta película</p>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => persistRating(star)}
                        className="h-8 w-8 rounded-md bg-[#202020] text-sm text-neutral-300 transition hover:bg-[#fbbf24] hover:text-black"
                      >
                        ★
                      </button>
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
