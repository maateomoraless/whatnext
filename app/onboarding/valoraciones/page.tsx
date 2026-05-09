"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

type Movie = {
  id: string;
  title: string;
  meta: string;
  gradient: [string, string];
  tmdbId: number;
};

type RatingValue = {
  rating: number;
  unseen: boolean;
};

type Ratings = Record<string, RatingValue>;

const MOVIES: Movie[] = [
  {
    id: "el-padrino",
    title: "El Padrino",
    meta: "Crimen/Drama • 1972",
    gradient: ["#341212", "#120808"],
    tmdbId: 238
  },
  {
    id: "pulp-fiction",
    title: "Pulp Fiction",
    meta: "Crimen • 1994",
    gradient: ["#4b2b12", "#1d1208"],
    tmdbId: 680
  },
  {
    id: "inception",
    title: "Inception",
    meta: "Sci-fi • 2010",
    gradient: ["#12284b", "#08131f"],
    tmdbId: 27205
  },
  {
    id: "interstellar",
    title: "Interstellar",
    meta: "Sci-fi • 2014",
    gradient: ["#1a2f4a", "#0a121f"],
    tmdbId: 157336
  },
  {
    id: "the-dark-knight",
    title: "The Dark Knight",
    meta: "Acción • 2008",
    gradient: ["#1b1b1b", "#090909"],
    tmdbId: 155
  },
  {
    id: "forrest-gump",
    title: "Forrest Gump",
    meta: "Drama • 1994",
    gradient: ["#2b3e54", "#111d2a"],
    tmdbId: 13
  },
  {
    id: "titanic",
    title: "Titanic",
    meta: "Romance • 1997",
    gradient: ["#20384e", "#0e1924"],
    tmdbId: 597
  },
  {
    id: "matrix",
    title: "Matrix",
    meta: "Sci-fi • 1999",
    gradient: ["#143322", "#09170f"],
    tmdbId: 603
  },
  {
    id: "gladiator",
    title: "Gladiator",
    meta: "Acción • 2000",
    gradient: ["#4a3316", "#1c1308"],
    tmdbId: 98
  },
  {
    id: "oppenheimer",
    title: "Oppenheimer",
    meta: "Drama • 2023",
    gradient: ["#4d1f12", "#1d0d08"],
    tmdbId: 872585
  }
];

function createInitialRatings(): Ratings {
  return MOVIES.reduce<Ratings>((acc, movie) => {
    acc[movie.id] = { rating: 0, unseen: false };
    return acc;
  }, {});
}

export default function OnboardingValoracionesPage() {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);
  const [ratings, setRatings] = useState<Ratings>(() => createInitialRatings());
  const [postersByMovieId, setPostersByMovieId] = useState<Record<string, string>>({});

  useEffect(() => {
    const stored = window.localStorage.getItem("valoraciones");
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as Record<string, RatingValue>;
      const next = createInitialRatings();
      MOVIES.forEach((movie) => {
        const value = parsed[movie.id];
        if (!value) {
          return;
        }
        const sanitizedRating =
          typeof value.rating === "number" && value.rating >= 0 && value.rating <= 5
            ? value.rating
            : 0;
        next[movie.id] = {
          rating: sanitizedRating,
          unseen: Boolean(value.unseen)
        };
      });
      setRatings(next);
    } catch {
      // Ignore malformed localStorage data.
    }
  }, []);

  useEffect(() => {
    let isDisposed = false;

    const loadPosters = async () => {
      try {
        const entries = await Promise.all(
          MOVIES.map(async (movie) => {
            const response = await fetch(
              `https://api.themoviedb.org/3/movie/${movie.tmdbId}?api_key=2de8d3ecfb29fc4efda4d7fa09d0920e`
            );
            if (!response.ok) {
              return [movie.id, ""] as const;
            }
            const data = (await response.json()) as { poster_path?: string | null };
            return [movie.id, data.poster_path ? `https://image.tmdb.org/t/p/w92${data.poster_path}` : ""] as const;
          })
        );

        if (isDisposed) {
          return;
        }

        setPostersByMovieId(Object.fromEntries(entries));
      } catch {
        if (!isDisposed) {
          setPostersByMovieId({});
        }
      }
    };

    loadPosters();

    return () => {
      isDisposed = true;
    };
  }, []);

  const saveRatings = (next: Ratings) => {
    setRatings(next);
    window.localStorage.setItem("valoraciones", JSON.stringify(next));
  };

  const setMovieRating = (movieId: string, rating: number) => {
    const next = {
      ...ratings,
      [movieId]: {
        rating,
        unseen: false
      }
    };
    saveRatings(next);
  };

  const toggleUnseen = (movieId: string) => {
    const current = ratings[movieId];
    const next = {
      ...ratings,
      [movieId]: {
        rating: current.unseen ? current.rating : 0,
        unseen: !current.unseen
      }
    };
    saveRatings(next);
  };

  const completedCount = useMemo(
    () =>
      MOVIES.filter((movie) => {
        const value = ratings[movie.id];
        return value.unseen || value.rating > 0;
      }).length,
    [ratings]
  );

  const progressPercent = (completedCount / MOVIES.length) * 100;

  return (
    <main className="flex min-h-screen justify-center bg-[#0a0a0a] px-6 text-white">
      <AnimatePresence
        mode="wait"
        onExitComplete={() => {
          router.push("/onboarding/resultados");
        }}
      >
        {!isExiting && (
          <motion.section
            key="valoraciones-screen"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="relative mx-auto flex min-h-screen w-full max-w-[400px] flex-col items-center pt-12"
            style={{ zIndex: 1 }}
          >
            <div className="w-full overflow-y-auto pb-28">
              <p className="mb-6 w-full text-center text-xs uppercase tracking-[0.35em] text-neutral-500">
                WhatNext?
              </p>

              <div className="mb-8 flex items-center justify-center gap-2">
                <span className="h-1.5 w-3 rounded-full bg-[#2a2a2a]" />
                <span className="h-1.5 w-3 rounded-full bg-[#2a2a2a]" />
                <span className="h-1.5 w-3 rounded-full bg-[#2a2a2a]" />
                <span className="h-1.5 w-3 rounded-full bg-[#2a2a2a]" />
                <span className="h-1.5 w-8 rounded-full bg-white" />
              </div>

              <h1 className="mb-2 text-center text-3xl font-semibold leading-tight text-white">
                Valora estas películas
              </h1>
              <p className="mb-5 text-center text-sm text-neutral-400">
                Así sabremos exactamente qué te gusta. Si no la has visto, pulsa no vista.
              </p>

              <p className="mb-2 text-xs text-neutral-400">
                {completedCount} de {MOVIES.length} valoradas
              </p>
              <div className="mb-6 h-1 w-full rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div>
                {MOVIES.map((movie, index) => {
                  const value = ratings[movie.id];
                  return (
                    <div
                      key={movie.id}
                      className={`py-3 ${index !== MOVIES.length - 1 ? "border-b border-[#222222]" : ""}`}
                    >
                      <div className="flex gap-3">
                        <div
                          className="flex h-[68px] w-[48px] items-end overflow-hidden rounded-md"
                          style={
                            postersByMovieId[movie.id]
                              ? undefined
                              : {
                                  background: `linear-gradient(180deg, ${movie.gradient[0]} 0%, ${movie.gradient[1]} 100%)`
                                }
                          }
                        >
                          {postersByMovieId[movie.id] ? (
                            <Image
                              src={postersByMovieId[movie.id]}
                              alt={`Póster de ${movie.title}`}
                              width={92}
                              height={138}
                              className="h-full w-full rounded-md object-cover"
                            />
                          ) : (
                            <span className="line-clamp-2 p-1 text-[8px] leading-tight text-white">{movie.title}</span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">{movie.title}</p>
                          <p className="mb-2 text-xs text-neutral-400">{movie.meta}</p>

                          <div className="flex items-center gap-1.5">
                            {Array.from({ length: 5 }).map((_, starIndex) => {
                              const starValue = starIndex + 1;
                              const active = !value.unseen && value.rating >= starValue;
                              return (
                                <button
                                  // eslint-disable-next-line react/no-array-index-key
                                  key={`${movie.id}-star-${starIndex}`}
                                  type="button"
                                  onClick={() => setMovieRating(movie.id, starValue)}
                                  className="text-lg leading-none transition"
                                  style={{ color: active ? "#EF9F27" : "#3b3b3b" }}
                                  aria-label={`Valorar ${movie.title} con ${starValue} estrellas`}
                                >
                                  ★
                                </button>
                              );
                            })}

                            <button
                              type="button"
                              onClick={() => toggleUnseen(movie.id)}
                              className="ml-2 rounded-md border px-2 py-0.5 text-[11px] transition"
                              style={{
                                borderColor: value.unseen ? "#ffffff" : "#3a3a3a",
                                color: value.unseen ? "#ffffff" : "#9ca3af",
                                backgroundColor: value.unseen ? "#242424" : "transparent"
                              }}
                            >
                              no vista
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsExiting(true)}
              className="fixed bottom-6 left-1/2 z-20 w-[calc(100%-3rem)] max-w-[400px] -translate-x-1/2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-100"
            >
              Ver mi lista →
            </button>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
