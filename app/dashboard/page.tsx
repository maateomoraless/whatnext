"use client";

import { useEffect, useMemo, useState } from "react";

type MatchItem = {
  id: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  match: number;
  platform: string;
  platformColor: string;
  gradient: [string, string];
  durationMinutes: number;
  genre: string;
  posterPath?: string;
};

type FriendWatch = {
  id: string;
  name: string;
  movie: string;
  stars: number;
  avatar: string;
};

type RatingValue = {
  rating: number;
  unseen: boolean;
};

type Ratings = Record<string, RatingValue>;
type GustosSelection = Record<string, string[]>;

type TmdbDiscoverResponse = {
  results?: Array<{
    id: number;
    title?: string;
    name?: string;
    poster_path: string | null;
    vote_average: number;
  }>;
};

const PROVIDER_ID_BY_PLATFORM: Record<string, number> = {
  Netflix: 8,
  "Disney+": 337,
  Max: 1899,
  Prime: 119,
  "Apple TV+": 350,
  Filmin: 55
};

const PROVIDER_COLOR_BY_NAME: Record<string, string> = {
  Netflix: "#E50914",
  "Disney+": "#0063e5",
  Max: "#5822B4",
  Prime: "#00A8E0",
  "Apple TV+": "#555555",
  Filmin: "#e8175d",
  "No disponible": "#737373"
};

const GENRE_IDS_BY_NAME: Record<string, number> = {
  "Acción": 28,
  Drama: 18,
  Comedia: 35,
  Terror: 27,
  "Sci-fi": 878,
  Documental: 99,
  Thriller: 53,
  "Animación": 16,
  Romance: 10749,
  "Fantasía": 14
};

const THEME_FILTERS: Record<string, { genres?: number[]; keywords?: number[] }> = {
  "Mafia y crimen": { genres: [80] },
  "Superhéroes": { genres: [28], keywords: [9715] },
  "Política y poder": { keywords: [11672] },
  Deportes: { keywords: [6075] },
  Espías: { keywords: [9882] },
  "Cocina y gastronomía": { keywords: [1254] },
  "Guerras e historia": { genres: [10752] },
  "Música y cultura": { genres: [10402] },
  "True crime": { genres: [80] },
  "Viajes y naturaleza": { genres: [99] },
  "Startups y tecnología": { keywords: [3852] },
  "Moda y lujo": { keywords: [3616] }
};

const AMBIENT_GENRES: Record<string, number[]> = {
  "Para desconectar": [35, 28],
  "Para pensar": [18, 99],
  "Para reír": [35],
  "Para emocionarme": [18, 10749],
  "Adrenalina pura": [28, 53],
  "Ver en familia": [16, 12]
};

const EPOCA_FILTERS: Record<string, { gte?: string; lte?: string }> = {
  "Clásicos": { lte: "1980-01-01" },
  "2000s": { gte: "2000-01-01", lte: "2010-01-01" },
  "Últimos 5 años": { gte: "2020-01-01" },
  "Lo más reciente": { gte: "2024-01-01" }
};

const LANGUAGE_FILTERS: Record<string, string[]> = {
  Español: ["es"],
  Inglés: ["en"],
  "Cine europeo": ["fr", "de", "it", "pt"],
  Asiático: ["ja", "ko", "zh"]
};

const TOP_RATED_GENRE_BY_RATING_ID: Record<string, number> = {
  "el-padrino": 80,
  "pulp-fiction": 53,
  inception: 878,
  interstellar: 878,
  "the-dark-knight": 28,
  "forrest-gump": 18,
  titanic: 10749,
  matrix: 878,
  gladiator: 28,
  oppenheimer: 18
};

const FRIENDS_WATCHING: FriendWatch[] = [
  { id: "lucia", name: "Lucía", movie: "Dune 2", stars: 4, avatar: "L" },
  { id: "carlos", name: "Carlos", movie: "The Bear", stars: 5, avatar: "C" },
  { id: "maria", name: "María", movie: "Oppenheimer", stars: 4, avatar: "M" }
];

const MOVIE_META_BY_ID: Record<string, { title: string; genre: string }> = {
  "el-padrino": { title: "El Padrino", genre: "Crimen" },
  "pulp-fiction": { title: "Pulp Fiction", genre: "Thriller" },
  inception: { title: "Inception", genre: "Sci-fi" },
  interstellar: { title: "Interstellar", genre: "Sci-fi" },
  "the-dark-knight": { title: "The Dark Knight", genre: "Acción" },
  "forrest-gump": { title: "Forrest Gump", genre: "Drama" },
  titanic: { title: "Titanic", genre: "Romance" },
  matrix: { title: "Matrix", genre: "Sci-fi" },
  gladiator: { title: "Gladiator", genre: "Acción" },
  oppenheimer: { title: "Oppenheimer", genre: "Drama" }
};

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

function FriendsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="3" stroke="#737373" strokeWidth="1.8" />
      <circle cx="16.5" cy="10.5" r="2.5" stroke="#737373" strokeWidth="1.8" />
      <path d="M4.5 19a4.5 4.5 0 0 1 9 0" stroke="#737373" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14.5 19a3.5 3.5 0 0 1 5 0" stroke="#737373" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke="#737373" strokeWidth="1.8" />
      <path d="M5 20a7 7 0 0 1 14 0" stroke="#737373" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function getGreetingByHour(hour: number) {
  if (hour >= 6 && hour <= 13) {
    return "Buenos días";
  }

  if (hour >= 14 && hour <= 20) {
    return "Buenas tardes";
  }

  return "Buenas noches";
}

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path
        d="M7 5.5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 17 5.5V20l-5-3-5 3V5.5Z"
        stroke="#000"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path
        d="m6.5 12.5 3.4 3.4 7.6-7.6"
        stroke="#000"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MovieCard({
  item,
  isSaved,
  onToggleWatchlist
}: {
  item: MatchItem;
  isSaved: boolean;
  onToggleWatchlist: (id: string) => void;
}) {
  return (
    <article key={item.id} className="w-[140px] flex-shrink-0">
      <div className="relative h-[190px] w-full overflow-hidden rounded-xl border border-[#2a2a2a]">
        {item.posterPath ? (
          <img
            src={`https://image.tmdb.org/t/p/w342${item.posterPath}`}
            alt={`Póster de ${item.title}`}
            width={140}
            height={190}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(180deg, ${item.gradient[0]} 0%, ${item.gradient[1]} 100%)`
            }}
          />
        )}
        <button
          type="button"
          onClick={() => onToggleWatchlist(item.id)}
          className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-white transition hover:bg-neutral-200"
          aria-label="Guardar en watchlist"
        >
          {isSaved ? <CheckIcon /> : <BookmarkIcon />}
        </button>
      </div>
      <p className="mt-2 truncate text-sm font-medium text-white">{item.title}</p>
      <p className="text-xs font-medium text-[#22c55e]">{item.match}% match</p>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-neutral-400">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: item.platformColor }}
        />
        <span>{item.platform}</span>
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const [name, setName] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [gustos, setGustos] = useState<GustosSelection>({});
  const [ratings, setRatings] = useState<Ratings>({});
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [popularMovies, setPopularMovies] = useState<MatchItem[]>([]);
  const [isLoadingPopular, setIsLoadingPopular] = useState(true);
  const [becauseYouLikedMovies, setBecauseYouLikedMovies] = useState<MatchItem[]>([]);
  const [isLoadingBecauseYouLiked, setIsLoadingBecauseYouLiked] = useState(true);
  const [tonightMovies, setTonightMovies] = useState<MatchItem[]>([]);
  const [isLoadingTonightMovies, setIsLoadingTonightMovies] = useState(true);
  const [nowPlayingMovies, setNowPlayingMovies] = useState<MatchItem[]>([]);
  const [isLoadingNowPlayingMovies, setIsLoadingNowPlayingMovies] = useState(true);

  useEffect(() => {
    const storedName = window.localStorage.getItem("nombre");
    const storedPlatforms = window.localStorage.getItem("plataformas");
    const storedGustos = window.localStorage.getItem("gustos");
    const storedRatings = window.localStorage.getItem("valoraciones");
    const storedWatchlist = window.localStorage.getItem("watchlist");

    if (storedName) {
      setName(storedName);
    }

    if (storedPlatforms) {
      try {
        const parsed = JSON.parse(storedPlatforms);
        if (Array.isArray(parsed)) {
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
            .filter((label): label is string => Boolean(label))
            .filter((label, index, arr) => arr.indexOf(label) === index);

          setSelectedPlatforms(labels);
        }
      } catch {
        // Ignore malformed localStorage data.
      }
    }

    if (storedGustos) {
      try {
        const parsed = JSON.parse(storedGustos) as Record<string, unknown>;
        const next: GustosSelection = {};
        Object.entries(parsed).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            next[key] = value.filter((v): v is string => typeof v === "string");
          }
        });
        setGustos(next);
      } catch {
        // Ignore malformed localStorage data.
      }
    }

    if (storedRatings) {
      try {
        const parsedRatings = JSON.parse(storedRatings) as Record<string, unknown>;
        const normalizedRatings: Ratings = {};

        Object.entries(parsedRatings).forEach(([movieId, value]) => {
          if (!value || typeof value !== "object") {
            return;
          }

          const candidate = value as { rating?: unknown; unseen?: unknown };
          const rating =
            typeof candidate.rating === "number" && Number.isFinite(candidate.rating)
              ? candidate.rating
              : 0;

          normalizedRatings[movieId] = {
            rating,
            unseen: Boolean(candidate.unseen)
          };
        });

        setRatings(normalizedRatings);
      } catch {
        // Ignore malformed localStorage data.
      }
    }

    if (storedWatchlist) {
      try {
        const parsedWatchlist = JSON.parse(storedWatchlist);
        if (Array.isArray(parsedWatchlist)) {
          setWatchlist(parsedWatchlist.filter((item): item is string => typeof item === "string"));
        }
      } catch {
        // Ignore malformed localStorage data.
      }
    }
  }, []);

  const discoverContext = useMemo(() => {
    const providerIds = (selectedPlatforms.length > 0
      ? selectedPlatforms.map((p) => PROVIDER_ID_BY_PLATFORM[p]).filter((id): id is number => Boolean(id))
      : Object.values(PROVIDER_ID_BY_PLATFORM)
    ).join("|");

    const genres = new Set<number>();
    (gustos.generos ?? []).forEach((name) => {
      const id = GENRE_IDS_BY_NAME[name];
      if (id) {
        genres.add(id);
      }
    });

    const keywords = new Set<number>();
    (gustos.tematica ?? []).forEach((theme) => {
      const conf = THEME_FILTERS[theme];
      conf?.genres?.forEach((id) => genres.add(id));
      conf?.keywords?.forEach((id) => keywords.add(id));
    });

    const ambiente = gustos.ambiente?.[0];
    if (ambiente) {
      (AMBIENT_GENRES[ambiente] ?? []).forEach((id) => genres.add(id));
    }

    const tiempo = gustos.tiempo?.[0];
    const runtime =
      tiempo === "Menos de 1h 30"
        ? { lte: 90 }
        : tiempo === "1h 30 — 2h"
          ? { gte: 90, lte: 120 }
          : tiempo === "Más de 2h"
            ? { gte: 120 }
            : {};

    const epoca = gustos.epoca?.[0];
    const epocaFilter = epoca ? EPOCA_FILTERS[epoca] ?? {} : {};

    const idioma = gustos.idioma?.[0];
    const languages = idioma ? LANGUAGE_FILTERS[idioma] ?? [] : [];

    const formato = gustos.formato?.[0] ?? "Solo películas";
    const mediaMode =
      formato === "Solo series" ? "tv" : formato === "Las dos" ? "both" : "movie";

    return { providerIds, withGenres: Array.from(genres), withKeywords: Array.from(keywords), runtime, epocaFilter, languages, mediaMode };
  }, [gustos, selectedPlatforms]);

  const buildDiscoverUrl = ({
    mediaType,
    extraGenres = [],
    runtimeOverride,
    page = 1
  }: {
    mediaType: "movie" | "tv";
    extraGenres?: number[];
    runtimeOverride?: { gte?: number; lte?: number };
    page?: number;
  }) => {
    const params = new URLSearchParams({
      api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY ?? "",
      language: "es-ES",
      watch_region: "ES",
      sort_by: "popularity.desc",
      page: `${page}`
    });
    if (discoverContext.providerIds) {
      params.set("with_watch_providers", discoverContext.providerIds);
    }
    const mergedGenres = Array.from(new Set([...discoverContext.withGenres, ...extraGenres]));
    if (mergedGenres.length > 0) {
      params.set("with_genres", mergedGenres.join("|"));
    }
    if (discoverContext.withKeywords.length > 0) {
      params.set("with_keywords", discoverContext.withKeywords.join("|"));
    }
    const runtime = runtimeOverride ?? discoverContext.runtime;
    if (runtime.gte) {
      params.set("with_runtime.gte", `${runtime.gte}`);
    }
    if (runtime.lte) {
      params.set("with_runtime.lte", `${runtime.lte}`);
    }
    if (discoverContext.epocaFilter.gte) {
      params.set("primary_release_date.gte", discoverContext.epocaFilter.gte);
    }
    if (discoverContext.epocaFilter.lte) {
      params.set("primary_release_date.lte", discoverContext.epocaFilter.lte);
    }
    if (discoverContext.languages.length > 0) {
      params.set("with_original_language", discoverContext.languages.join("|"));
    }
    return `https://api.themoviedb.org/3/discover/${mediaType}?${params.toString()}`;
  };

  const enrichWithProviders = async (items: MatchItem[]) => {
    const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
    if (!apiKey) {
      return items;
    }
    return Promise.all(
      items.map(async (item) => {
        try {
          const response = await fetch(
            `https://api.themoviedb.org/3/${item.mediaType}/${item.tmdbId}/watch/providers?api_key=${apiKey}`
          );
          if (!response.ok) {
            return item;
          }
          const data = (await response.json()) as {
            results?: { ES?: { flatrate?: Array<{ provider_name: string }> } };
          };
          const first = data.results?.ES?.flatrate?.[0]?.provider_name ?? "No disponible";
          const normalized = first === "Amazon Prime Video" ? "Prime" : first;
          return { ...item, platform: normalized, platformColor: PROVIDER_COLOR_BY_NAME[normalized] ?? "#737373" };
        } catch {
          return item;
        }
      })
    );
  };

  useEffect(() => {
    const controller = new AbortController();

    const loadNowPlayingMovies = async () => {
      const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
      if (!apiKey) {
        setIsLoadingNowPlayingMovies(false);
        return;
      }

      try {
        const response = await fetch(
          `https://api.themoviedb.org/3/movie/now_playing?api_key=${apiKey}&language=es-ES&region=ES&page=1`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("TMDB now playing request failed");
        }

        const data = (await response.json()) as TmdbDiscoverResponse;
        const mapped: MatchItem[] = (data.results ?? [])
          .filter((movie) => Boolean(movie.poster_path))
          .slice(0, 6)
          .map((movie, index) => ({
            id: `tmdb-now-${movie.id}`,
            tmdbId: movie.id,
            mediaType: "movie",
            title: movie.title ?? "Sin título",
            match: Math.round(movie.vote_average * 10),
            platform: "No disponible",
            platformColor: "#737373",
            gradient: index % 2 === 0 ? ["#1f1f1f", "#0b0b0b"] : ["#2a241a", "#0f0d09"],
            durationMinutes: 110,
            genre: "Película",
            posterPath: movie.poster_path ?? undefined
          }));

        setNowPlayingMovies(await enrichWithProviders(mapped));
      } catch {
        setNowPlayingMovies([]);
      } finally {
        setIsLoadingNowPlayingMovies(false);
      }
    };

    setIsLoadingNowPlayingMovies(true);
    loadNowPlayingMovies();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadPopularMovies = async () => {
      const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
      if (!apiKey) {
        setIsLoadingPopular(false);
        return;
      }

      try {
        const runFetch = async (mediaType: "movie" | "tv") => {
          const response = await fetch(buildDiscoverUrl({ mediaType }), { signal: controller.signal });
          if (!response.ok) {
            throw new Error("TMDB request failed");
          }
          const data = (await response.json()) as TmdbDiscoverResponse;
          return (data.results ?? [])
            .filter((movie) => Boolean(movie.poster_path))
            .slice(0, 8)
            .map((movie, index) => ({
              id: `tmdb-${mediaType}-${movie.id}`,
              tmdbId: movie.id,
              mediaType,
              title: movie.title ?? movie.name ?? "Sin título",
              match: Math.round(movie.vote_average * 10),
              platform: "No disponible",
              platformColor: "#737373",
              gradient: index % 2 === 0 ? ["#1f1f1f", "#0b0b0b"] : ["#2a241a", "#0f0d09"],
              durationMinutes: 120,
              genre: "Película",
              posterPath: movie.poster_path ?? undefined
            } satisfies MatchItem));
        };

        const base =
          discoverContext.mediaMode === "both"
            ? [...(await runFetch("movie")), ...(await runFetch("tv"))].slice(0, 12)
            : await runFetch(discoverContext.mediaMode === "tv" ? "tv" : "movie");
        setPopularMovies(await enrichWithProviders(base));
      } catch {
        setPopularMovies([]);
      } finally {
        setIsLoadingPopular(false);
      }
    };

    setIsLoadingPopular(true);
    loadPopularMovies();

    return () => {
      controller.abort();
    };
  }, [discoverContext]);

  const bestRatedMovieId = useMemo(() => {
    let bestId = "";
    let bestRating = -1;

    Object.entries(ratings).forEach(([movieId, value]) => {
      if (value && !value.unseen && typeof value.rating === "number" && value.rating > bestRating) {
        bestRating = value.rating;
        bestId = movieId;
      }
    });

    return bestId;
  }, [ratings]);

  useEffect(() => {
    const controller = new AbortController();

    const loadBecauseYouLikedMovies = async () => {
      const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
      if (!apiKey) {
        setIsLoadingBecauseYouLiked(false);
        return;
      }

      try {
        const topGenre = bestRatedMovieId ? TOP_RATED_GENRE_BY_RATING_ID[bestRatedMovieId] : undefined;
        const url = topGenre
          ? buildDiscoverUrl({ mediaType: "movie", extraGenres: [topGenre], page: 2 })
          : `https://api.themoviedb.org/3/movie/top_rated?api_key=${apiKey}&language=es-ES&page=2`;
        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
          throw new Error("TMDB top rated request failed");
        }

        const data = (await response.json()) as TmdbDiscoverResponse;
        const mapped: MatchItem[] = (data.results ?? [])
          .filter((movie) => Boolean(movie.poster_path))
          .slice(0, 12)
          .map((movie, index) => ({
            id: `tmdb-top-${movie.id}`,
            tmdbId: movie.id,
            mediaType: "movie",
            title: movie.title ?? movie.name ?? "Sin título",
            match: Math.round(movie.vote_average * 10),
            platform: "No disponible",
            platformColor: "#737373",
            gradient: index % 2 === 0 ? ["#1f1f1f", "#0b0b0b"] : ["#2a241a", "#0f0d09"],
            durationMinutes: 120,
            genre: "Película",
            posterPath: movie.poster_path ?? undefined
          }));

        setBecauseYouLikedMovies(await enrichWithProviders(mapped));
      } catch {
        setBecauseYouLikedMovies([]);
      } finally {
        setIsLoadingBecauseYouLiked(false);
      }
    };

    setIsLoadingBecauseYouLiked(true);
    loadBecauseYouLikedMovies();

    return () => {
      controller.abort();
    };
  }, [bestRatedMovieId, discoverContext]);

  useEffect(() => {
    const controller = new AbortController();

    const loadTonightMovies = async () => {
      const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
      if (!apiKey) {
        setIsLoadingTonightMovies(false);
        return;
      }

      try {
        const now = new Date();
        const isWeekend = now.getDay() === 0 || now.getDay() === 6;
        const before21 = now.getHours() < 21;
        const runtimeOverride =
          discoverContext.runtime.gte || discoverContext.runtime.lte
            ? discoverContext.runtime
            : isWeekend || !before21
              ? { gte: 120 }
              : { lte: 100 };
        const response = await fetch(buildDiscoverUrl({ mediaType: "movie", runtimeOverride }), {
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error("TMDB discover short movies failed");
        }

        const data = (await response.json()) as TmdbDiscoverResponse;
        const mapped: MatchItem[] = (data.results ?? [])
          .filter((movie) => Boolean(movie.poster_path))
          .slice(0, 12)
          .map((movie, index) => ({
            id: `tmdb-short-${movie.id}`,
            tmdbId: movie.id,
            mediaType: "movie",
            title: movie.title ?? movie.name ?? "Sin título",
            match: Math.round(movie.vote_average * 10),
            platform: "No disponible",
            platformColor: "#737373",
            gradient: index % 2 === 0 ? ["#1f1f1f", "#0b0b0b"] : ["#2a241a", "#0f0d09"],
            durationMinutes: 95,
            genre: "Película",
            posterPath: movie.poster_path ?? undefined
          }));

        setTonightMovies(await enrichWithProviders(mapped));
      } catch {
        setTonightMovies([]);
      } finally {
        setIsLoadingTonightMovies(false);
      }
    };

    setIsLoadingTonightMovies(true);
    loadTonightMovies();

    return () => {
      controller.abort();
    };
  }, [discoverContext]);

  const moviesForToday = useMemo(() => {
    if (popularMovies.length > 0) {
      return popularMovies;
    }
    return [];
  }, [popularMovies]);

  const visibleNews = useMemo(() => nowPlayingMovies, [nowPlayingMovies]);

  const greeting = useMemo(() => getGreetingByHour(new Date().getHours()), []);

  const allCardItems = useMemo(() => {
    const uniqueById = new Map<string, MatchItem>();
    [...popularMovies, ...becauseYouLikedMovies, ...tonightMovies, ...nowPlayingMovies].forEach((item) => {
      uniqueById.set(item.id, item);
    });

    return Array.from(uniqueById.values());
  }, [popularMovies, becauseYouLikedMovies, tonightMovies, nowPlayingMovies]);

  const bestRatedMovieTitle = useMemo(() => {
    if (!bestRatedMovieId) {
      return "tu favorita";
    }
    return MOVIE_META_BY_ID[bestRatedMovieId]?.title ?? "tu favorita";
  }, [bestRatedMovieId]);

  const becauseYouLikedItems = useMemo(
    () => becauseYouLikedMovies,
    [becauseYouLikedMovies]
  );

  const ratedMovies = useMemo(
    () =>
      Object.entries(ratings).filter(
        ([, value]) => value && !value.unseen && typeof value.rating === "number" && value.rating > 0
      ),
    [ratings]
  );

  const avgRating = useMemo(() => {
    if (ratedMovies.length === 0) {
      return 0;
    }
    const total = ratedMovies.reduce((acc, [, value]) => acc + value.rating, 0);
    return total / ratedMovies.length;
  }, [ratedMovies]);

  const favoriteGenre = useMemo(() => {
    if (ratedMovies.length === 0) {
      return "—";
    }

    const highestRating = ratedMovies.reduce((max, [, value]) => Math.max(max, value.rating), 0);
    const highestRatedMovies = ratedMovies.filter(([, value]) => value.rating === highestRating);
    const genreCounts: Record<string, number> = {};

    highestRatedMovies.forEach(([movieId]) => {
      const genre = MOVIE_META_BY_ID[movieId]?.genre ?? "Otros";
      genreCounts[genre] = (genreCounts[genre] ?? 0) + 1;
    });

    return Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0][0];
  }, [ratedMovies]);

  const watchlistItems = useMemo(() => {
    const byId = new Map(allCardItems.map((item) => [item.id, item] as const));
    const unique = Array.from(new Set(watchlist));
    return unique
      .map((id) => byId.get(id))
      .filter((item): item is MatchItem => Boolean(item));
  }, [allCardItems, watchlist]);

  const toggleWatchlist = (id: string) => {
    setWatchlist((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((item) => item !== id) : [...prev, id];
      const deduped = Array.from(new Set(next));
      window.localStorage.setItem("watchlist", JSON.stringify(deduped));
      return deduped;
    });
  };

  useEffect(() => {
    window.localStorage.setItem("watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  const addToWatchlist = (id: string) => {
    setWatchlist((prev) => {
      if (prev.includes(id)) {
        return prev;
      }
      const next = [...prev, id];
      const deduped = Array.from(new Set(next));
      window.localStorage.setItem("watchlist", JSON.stringify(deduped));
      return deduped;
    });
  };

  return (
    <main className="flex min-h-screen justify-center bg-[#0a0a0a] px-6 text-white">
      <section className="relative w-full max-w-[400px] pt-10 pb-28">
        <p className="mb-6 w-full text-center text-xs uppercase tracking-[0.35em] text-neutral-500">
          WhatNext?
        </p>

        <header className="mb-8">
          <h1 className="text-3xl font-semibold leading-tight text-white">
            {greeting}, {name || "..."}
          </h1>
          <p className="mt-2 text-sm text-neutral-400">Tu lista de hoy:</p>
        </header>

        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-white">Para ti hoy:</h2>
          <p className="mb-2 text-xs text-neutral-400">
            Basado en tus gustos · {selectedPlatforms.length > 0 ? selectedPlatforms.join(", ") : "Todas las plataformas"}
          </p>
          <div className="flex flex-row gap-3 overflow-x-scroll pb-2">
            {isLoadingPopular
              ? Array.from({ length: 4 }).map((_, index) => (
                  <article key={`popular-skeleton-${index}`} className="w-[140px] flex-shrink-0 animate-pulse">
                    <div className="h-[190px] w-full rounded-xl bg-[#2a2a2a]" />
                    <div className="mt-2 h-3 w-4/5 rounded bg-[#2a2a2a]" />
                    <div className="mt-2 h-2 w-2/5 rounded bg-[#2a2a2a]" />
                    <div className="mt-2 h-2 w-3/5 rounded bg-[#2a2a2a]" />
                  </article>
                ))
              : moviesForToday.map((item) => (
                  <MovieCard
                    key={item.id}
                    item={item}
                    isSaved={watchlist.includes(item.id)}
                    onToggleWatchlist={toggleWatchlist}
                  />
                ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-white">
            Porque te gustó {bestRatedMovieTitle}
          </h2>
          <div className="flex flex-row gap-3 overflow-x-scroll pb-2">
            {isLoadingBecauseYouLiked
              ? Array.from({ length: 4 }).map((_, index) => (
                  <article key={`similar-skeleton-${index}`} className="w-[140px] flex-shrink-0 animate-pulse">
                    <div className="h-[190px] w-full rounded-xl bg-[#2a2a2a]" />
                    <div className="mt-2 h-3 w-4/5 rounded bg-[#2a2a2a]" />
                    <div className="mt-2 h-2 w-2/5 rounded bg-[#2a2a2a]" />
                    <div className="mt-2 h-2 w-3/5 rounded bg-[#2a2a2a]" />
                  </article>
                ))
              : becauseYouLikedItems.map((item) => (
                  <MovieCard
                    key={item.id}
                    item={item}
                    isSaved={watchlist.includes(item.id)}
                    onToggleWatchlist={toggleWatchlist}
                  />
                ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-white">Tu watchlist</h2>
          {watchlistItems.length === 0 ? (
            <p className="rounded-xl border border-[#2a2a2a] bg-[#101010] px-4 py-4 text-sm text-neutral-400">
              Guarda películas para verlas después...
            </p>
          ) : (
            <div className="flex flex-row gap-3 overflow-x-scroll pb-2">
              {watchlistItems.map((item) => (
                <MovieCard
                  key={item.id}
                  item={item}
                  isSaved={watchlist.includes(item.id)}
                  onToggleWatchlist={toggleWatchlist}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mb-8">
          <h2 className="mb-2 text-base font-semibold text-white">Perfecto para esta noche</h2>
          <div className="flex flex-row gap-3 overflow-x-scroll pb-2">
            {isLoadingTonightMovies
              ? Array.from({ length: 4 }).map((_, index) => (
                  <article key={`tonight-skeleton-${index}`} className="w-[140px] flex-shrink-0 animate-pulse">
                    <div className="h-[190px] w-full rounded-xl bg-[#2a2a2a]" />
                    <div className="mt-2 h-3 w-4/5 rounded bg-[#2a2a2a]" />
                    <div className="mt-2 h-2 w-2/5 rounded bg-[#2a2a2a]" />
                    <div className="mt-2 h-2 w-3/5 rounded bg-[#2a2a2a]" />
                  </article>
                ))
              : tonightMovies.map((item) => (
                  <MovieCard
                    key={item.id}
                    item={item}
                    isSaved={watchlist.includes(item.id)}
                    onToggleWatchlist={toggleWatchlist}
                  />
                ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-white">Tu año en números</h2>
          {ratedMovies.length === 0 && (
            <p className="mb-3 text-xs text-neutral-400">Completa el test para ver tus estadísticas</p>
          )}
          <div className="grid grid-cols-3 gap-2">
            <article className="flex h-[116px] flex-col items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#101010] px-3 py-3 text-center">
              <p className="text-3xl font-bold text-[#4A90D9]">{ratedMovies.length}</p>
              <p className="mt-1 text-[11px] text-neutral-400">valoradas</p>
            </article>
            <article className="flex h-[116px] flex-col items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#101010] px-3 py-3 text-center">
              <p className="text-3xl font-bold text-[#00A550]">{avgRating.toFixed(1)}</p>
              <p className="mt-1 text-[11px] text-neutral-400">media</p>
            </article>
            <article className="flex h-[116px] flex-col items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#101010] px-2 py-3 text-center">
              <p className="w-full text-sm font-bold leading-tight text-[#9370DB] sm:text-xl">
                {favoriteGenre}
              </p>
              <p className="mt-1 text-[11px] text-neutral-400">género favorito</p>
            </article>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-white">Tu amigo recomienda</h2>
          <article className="rounded-xl border border-[#2a2a2a] bg-[#101010] px-4 py-3">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1f1f1f] text-sm font-semibold text-white">
                A
              </div>
              <div>
                <p className="text-sm font-medium text-white">Alex te recomienda</p>
                <p className="text-xs text-neutral-400">Blade Runner 2049</p>
              </div>
            </div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-[#fbbf24]">★★★★☆</p>
              <p className="text-xs text-neutral-400">4.0/5</p>
            </div>
            <button
              type="button"
              onClick={() => addToWatchlist("blade-runner-2049")}
              className="w-full rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-neutral-100"
            >
              Añadir a watchlist
            </button>
          </article>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-white">Match de gustos</h2>
          <div className="space-y-2.5">
            {[
              { id: "lp", name: "Laura P.", compatibility: 92, color: "#4A90D9" },
              { id: "dm", name: "Diego M.", compatibility: 86, color: "#00A550" },
              { id: "sr", name: "Sara R.", compatibility: 78, color: "#9370DB" }
            ].map((friend) => (
              <article
                key={friend.id}
                className="rounded-xl border border-[#2a2a2a] bg-[#101010] px-3 py-3"
              >
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1f1f1f] text-xs font-semibold text-white">
                    {friend.id.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{friend.name}</p>
                  </div>
                  <p className="text-sm font-semibold text-white">{friend.compatibility}%</p>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#2a2a2a]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${friend.compatibility}%`, backgroundColor: friend.color }}
                  />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-white">Novedades en tus plataformas</h2>
          <div className="flex flex-row gap-3 overflow-x-scroll pb-2">
            {isLoadingNowPlayingMovies
              ? Array.from({ length: 4 }).map((_, index) => (
                  <article key={`nowplaying-skeleton-${index}`} className="w-[140px] flex-shrink-0 animate-pulse">
                    <div className="h-[190px] w-full rounded-xl bg-[#2a2a2a]" />
                    <div className="mt-2 h-3 w-4/5 rounded bg-[#2a2a2a]" />
                    <div className="mt-2 h-2 w-2/5 rounded bg-[#2a2a2a]" />
                    <div className="mt-2 h-2 w-3/5 rounded bg-[#2a2a2a]" />
                  </article>
                ))
              : visibleNews.map((item) => (
                  <MovieCard
                    key={item.id}
                    item={item}
                    isSaved={watchlist.includes(item.id)}
                    onToggleWatchlist={toggleWatchlist}
                  />
                ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-white">Tus amigos están viendo</h2>
          <div className="space-y-2.5">
            {FRIENDS_WATCHING.map((friend) => (
              <article
                key={friend.id}
                className="flex items-center gap-3 rounded-xl border border-[#2a2a2a] bg-[#101010] px-3 py-2.5"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1f1f1f] text-sm font-semibold text-white">
                  {friend.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{friend.name}</p>
                  <p className="truncate text-xs text-neutral-400">Viendo: {friend.movie}</p>
                </div>
                <p className="text-sm text-[#fbbf24]">
                  {"★".repeat(friend.stars)}
                  <span className="text-[#3f3f46]">{"★".repeat(5 - friend.stars)}</span>
                </p>
              </article>
            ))}
          </div>
        </section>

        <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-[400px] -translate-x-1/2 border-t border-[#1f1f1f] bg-[#0a0a0a]/95 px-5 py-3 backdrop-blur">
          <ul className="grid grid-cols-4 gap-2">
            <li className="flex flex-col items-center gap-1 text-[11px] font-medium text-white">
              <HomeIcon active />
              <span>Inicio</span>
            </li>
            <li className="flex flex-col items-center gap-1 text-[11px] font-medium text-neutral-500">
              <SearchIcon />
              <span>Buscar</span>
            </li>
            <li className="flex flex-col items-center gap-1 text-[11px] font-medium text-neutral-500">
              <FriendsIcon />
              <span>Amigos</span>
            </li>
            <li className="flex flex-col items-center gap-1 text-[11px] font-medium text-neutral-500">
              <ProfileIcon />
              <span>Perfil</span>
            </li>
          </ul>
        </nav>
      </section>
    </main>
  );
}
