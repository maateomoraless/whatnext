"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { saveUserData, setActiveStorageUserId, syncAllUserData } from "@/lib/userStorage";

type Poster = {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  image: HTMLImageElement | null;
};

const TMDB_API_KEY = "2de8d3ecfb29fc4efda4d7fa09d0920e";
const TMDB_MOVIE_IDS = [
  238, 680, 27205, 157336, 155, 13, 597, 603, 98, 872585,
  278, 424, 389, 129, 19404, 637, 372058, 240, 429, 769,
  311, 207, 101, 539, 346, 453, 497, 489, 77338, 68718,
  244786, 76341, 299536, 284054, 315162, 361743, 766507, 560050, 438148, 414906,
  550, 120, 121, 122, 671, 672, 673, 674, 675, 767,
  12445, 12444, 1726, 1771, 68721, 99861, 271110, 284052, 283995, 335983,
  400160, 508442, 508943, 459151, 315635, 429617, 566525, 524434, 634649, 616037
];

export default function HomePage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [regNombre, setRegNombre] = useState("");
  const [regApellidos, setRegApellidos] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerPending, setRegisterPending] = useState(false);

  const closeRegister = () => {
    setRegisterOpen(false);
    setRegisterError(null);
    setRegisterPending(false);
  };

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        const uid = data.session.user.id;
        setActiveStorageUserId(uid);
        await syncAllUserData(uid);
        router.push("/dashboard");
      }
    };
    void checkSession();
  }, [router]);

  const handleSignIn = async () => {
    setAuthError(null);
    setPending(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setPending(false);
    if (error) {
      setAuthError(error.message);
      return;
    }
    if (!data.session?.user) {
      setAuthError("No se pudo iniciar sesión.");
      return;
    }
    const uid = data.session.user.id;
    setActiveStorageUserId(uid);
    await syncAllUserData(uid);
    router.push("/dashboard");
  };

  const handleRegisterSubmit = async () => {
    setRegisterError(null);
    const nombreTrim = regNombre.trim();
    const apellidosTrim = regApellidos.trim();
    const emailTrim = regEmail.trim();

    if (!nombreTrim || !apellidosTrim || !emailTrim || !regPassword) {
      setRegisterError("Completa todos los campos.");
      return;
    }
    if (regPassword !== regConfirm) {
      setRegisterError("Las contraseñas no coinciden.");
      return;
    }

    setRegisterPending(true);
    const fullName = `${nombreTrim} ${apellidosTrim}`;
    const { error } = await supabase.auth.signUp({
      email: emailTrim,
      password: regPassword,
      options: {
        data: {
          full_name: fullName,
          first_name: nombreTrim,
          last_name: apellidosTrim
        }
      }
    });
    setRegisterPending(false);

    if (error) {
      setRegisterError(error.message);
      return;
    }

    const { data: sess } = await supabase.auth.getSession();
    if (sess.session?.user) {
      const uid = sess.session.user.id;
      setActiveStorageUserId(uid);
      await saveUserData(uid, "nombre", nombreTrim);
      await saveUserData(uid, "apellidos", apellidosTrim);
      await saveUserData(uid, "email", emailTrim);
    } else {
      window.localStorage.setItem("nombre", nombreTrim);
      window.localStorage.setItem("apellidos", apellidosTrim);
      window.localStorage.setItem("email", emailTrim);
    }
    closeRegister();
    router.push("/onboarding/nombre");
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return undefined;
    }

    const posters: Poster[] = [];
    let animationId = 0;
    let width = 0;
    let height = 0;
    const dpr = window.devicePixelRatio || 1;
    let isDisposed = false;
    let posterImages: HTMLImageElement[] = [];
    let nextImageIndex = 0;
    const POSTER_WIDTH = 90;
    const POSTER_HEIGHT = 130;
    const COLUMN_GAP = 10;
    const COLUMN_WIDTH = POSTER_WIDTH + COLUMN_GAP;

    const getNextImage = () => {
      if (posterImages.length === 0) {
        return null;
      }
      const image = posterImages[nextImageIndex % posterImages.length];
      nextImageIndex += 1;
      return image;
    };

    const createPoster = (x: number, initialY?: number, image?: HTMLImageElement): Poster => {
      return {
        x,
        y: initialY ?? Math.random() * (height + POSTER_HEIGHT),
        width: POSTER_WIDTH,
        height: POSTER_HEIGHT,
        speed: 0.2 + Math.random() * 0.4,
        image: image ?? null
      };
    };

    const preloadImage = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    const loadPosterImages = async () => {
      try {
        const movieRequests = await Promise.all(
          TMDB_MOVIE_IDS.map(async (id) => {
            const response = await fetch(
              `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_API_KEY}&language=es-ES`
            );
            if (!response.ok) {
              return null;
            }
            const data = (await response.json()) as { poster_path?: string | null };
            return data.poster_path ?? null;
          })
        );

        const posterPaths = movieRequests
          .filter((path): path is string => Boolean(path))
          .map((path) => `https://image.tmdb.org/t/p/w185${path}`);

        const loaded = await Promise.allSettled(posterPaths.map((src) => preloadImage(src)));
        posterImages = loaded
          .filter((result): result is PromiseFulfilledResult<HTMLImageElement> => result.status === "fulfilled")
          .map((result) => result.value);
      } catch {
        posterImages = [];
      }
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      posters.length = 0;
      nextImageIndex = 0;

      const columns = Math.max(1, Math.floor((width + COLUMN_GAP) / COLUMN_WIDTH));
      const totalColumnsWidth = columns * POSTER_WIDTH + (columns - 1) * COLUMN_GAP;
      const startX = Math.max(0, (width - totalColumnsWidth) / 2);

      for (let col = 0; col < columns; col += 1) {
        const x = startX + col * (POSTER_WIDTH + COLUMN_GAP);
        const randomImage = getNextImage();
        posters.push(createPoster(x, Math.random() * (height + POSTER_HEIGHT), randomImage ?? undefined));
      }
    };

    const drawPoster = (poster: Poster) => {
      context.save();
      context.beginPath();
      context.roundRect(poster.x, poster.y, poster.width, poster.height, 6);
      context.clip();
      if (poster.image) {
        context.drawImage(poster.image, poster.x, poster.y, poster.width, poster.height);
      } else {
        context.fillStyle = "#1b1b1b";
        context.fillRect(poster.x, poster.y, poster.width, poster.height);
      }
      context.restore();

      context.beginPath();
      context.roundRect(poster.x, poster.y, poster.width, poster.height, 6);
      context.strokeStyle = "rgba(220,220,220,0.06)";
      context.lineWidth = 1;
      context.stroke();
    };

    const animate = () => {
      context.clearRect(0, 0, width, height);
      context.globalAlpha = 1;

      posters.forEach((poster) => {
        poster.y -= poster.speed;
        if (poster.y + poster.height < 0) {
          poster.y = height + Math.random() * 220;
          poster.image = getNextImage();
          poster.speed = 0.2 + Math.random() * 0.4;
        }
        drawPoster(poster);
      });

      context.globalAlpha = 1;
      animationId = window.requestAnimationFrame(animate);
    };

    const bootstrap = async () => {
      await loadPosterImages();
      if (isDisposed) {
        return;
      }
      resize();
      animate();
      window.addEventListener("resize", resize);
    };

    bootstrap();

    return () => {
      isDisposed = true;
      window.cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0a0a0a]">
      <canvas
        ref={canvasRef}
        className="pointer-events-none opacity-100"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 0
        }}
      />

      <div className="fixed inset-0 z-10" style={{ backgroundColor: "rgba(0,0,0,0.82)" }}>
        <section className="relative z-20 mx-auto flex min-h-screen w-full max-w-[400px] flex-col items-center justify-center px-6 py-12">
          <p className="mb-6 w-full text-center text-xs uppercase tracking-[0.35em] text-neutral-500 select-none">
            WhatNext?
          </p>

          <h1 className="mb-3 text-center text-4xl font-semibold leading-tight text-white">
            Deja de perder tiempo buscando qué ver.
          </h1>
          <p className="mb-8 text-center text-sm text-neutral-400">
            Tu lista hecha a tu medida. Solo lo que tienes en tus plataformas.
          </p>

          <form
            className="flex w-full flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSignIn();
            }}
          >
            <label className="sr-only" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setAuthError(null);
              }}
              placeholder="Email"
              className="w-full rounded-xl border border-[#2a2a2a] bg-[#141414] px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none ring-offset-black focus:border-neutral-500 focus:ring-2 focus:ring-neutral-600"
            />

            <label className="sr-only" htmlFor="login-password">
              Contraseña
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setAuthError(null);
              }}
              placeholder="Contraseña"
              className="w-full rounded-xl border border-[#2a2a2a] bg-[#141414] px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none ring-offset-black focus:border-neutral-500 focus:ring-2 focus:ring-neutral-600"
            />

            {authError ? (
              <p className="text-center text-sm text-red-500" role="alert">
                {authError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl border border-white bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Entrar
            </button>

            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setRegisterOpen(true);
                setRegisterError(null);
              }}
              className="w-full rounded-xl border border-[#2a2a2a] bg-transparent px-4 py-3 text-sm font-medium text-white transition hover:bg-[#151515] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Crear cuenta
            </button>
          </form>

          <p className="mt-8 text-center text-[11px] leading-relaxed text-neutral-500">
            Al continuar, aceptas nuestros Términos y Política de privacidad.
          </p>
        </section>
      </div>

      {registerOpen ? (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto px-6 py-10"
          style={{ backgroundColor: "rgba(0,0,0,0.82)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="register-title"
        >
          <div className="relative z-40 mx-auto w-full max-w-[400px] rounded-2xl border border-[#2a2a2a] bg-[#0f0f0f]/95 p-6 shadow-2xl backdrop-blur-sm">
            <p className="mb-2 text-center text-xs uppercase tracking-[0.35em] text-neutral-500 select-none">WhatNext?</p>
            <h2 id="register-title" className="mb-6 text-center text-xl font-semibold text-white">
              Crear cuenta
            </h2>

            <div className="flex flex-col gap-4">
              <input
                type="text"
                autoComplete="given-name"
                value={regNombre}
                onChange={(e) => {
                  setRegNombre(e.target.value);
                  setRegisterError(null);
                }}
                placeholder="Nombre"
                className="w-full rounded-xl border border-[#2a2a2a] bg-[#141414] px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none ring-offset-black focus:border-neutral-500 focus:ring-2 focus:ring-neutral-600"
              />
              <input
                type="text"
                autoComplete="family-name"
                value={regApellidos}
                onChange={(e) => {
                  setRegApellidos(e.target.value);
                  setRegisterError(null);
                }}
                placeholder="Apellidos"
                className="w-full rounded-xl border border-[#2a2a2a] bg-[#141414] px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none ring-offset-black focus:border-neutral-500 focus:ring-2 focus:ring-neutral-600"
              />
              <input
                type="email"
                autoComplete="email"
                value={regEmail}
                onChange={(e) => {
                  setRegEmail(e.target.value);
                  setRegisterError(null);
                }}
                placeholder="Email"
                className="w-full rounded-xl border border-[#2a2a2a] bg-[#141414] px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none ring-offset-black focus:border-neutral-500 focus:ring-2 focus:ring-neutral-600"
              />
              <input
                type="password"
                autoComplete="new-password"
                value={regPassword}
                onChange={(e) => {
                  setRegPassword(e.target.value);
                  setRegisterError(null);
                }}
                placeholder="Contraseña"
                className="w-full rounded-xl border border-[#2a2a2a] bg-[#141414] px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none ring-offset-black focus:border-neutral-500 focus:ring-2 focus:ring-neutral-600"
              />
              <input
                type="password"
                autoComplete="new-password"
                value={regConfirm}
                onChange={(e) => {
                  setRegConfirm(e.target.value);
                  setRegisterError(null);
                }}
                placeholder="Confirmar contraseña"
                className="w-full rounded-xl border border-[#2a2a2a] bg-[#141414] px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none ring-offset-black focus:border-neutral-500 focus:ring-2 focus:ring-neutral-600"
              />

              {registerError ? (
                <p className="text-center text-sm text-red-500" role="alert">
                  {registerError}
                </p>
              ) : null}

              <button
                type="button"
                disabled={registerPending}
                onClick={() => void handleRegisterSubmit()}
                className="w-full rounded-xl border border-white bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Crear cuenta
              </button>
              <button
                type="button"
                disabled={registerPending}
                onClick={closeRegister}
                className="w-full rounded-xl border border-[#2a2a2a] bg-transparent px-4 py-3 text-sm font-medium text-white transition hover:bg-[#151515] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Ya tengo cuenta
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
