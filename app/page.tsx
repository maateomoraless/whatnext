"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

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

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-black" aria-hidden="true">
      <path d="M16.51 12.77c.01 2.65 2.32 3.54 2.35 3.55-.02.06-.36 1.24-1.17 2.45-.71 1.04-1.43 2.07-2.6 2.09-1.14.03-1.51-.68-2.82-.68-1.32 0-1.73.66-2.8.7-1.12.04-1.97-1.12-2.69-2.16-1.46-2.1-2.58-5.95-1.08-8.56.75-1.3 2.09-2.12 3.54-2.14 1.1-.02 2.14.74 2.82.74.67 0 1.94-.92 3.27-.78.56.02 2.12.23 3.13 1.7-.08.05-1.87 1.09-1.85 3.23Zm-2.06-7.19c.59-.71.99-1.68.88-2.66-.85.03-1.88.57-2.49 1.28-.55.64-1.03 1.62-.9 2.57.95.07 1.92-.48 2.51-1.19Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M21.82 12.23c0-.73-.06-1.26-.19-1.82H12v3.6h5.65c-.11.89-.72 2.23-2.07 3.13l-.02.12 3.03 2.35.21.02c1.95-1.8 3.02-4.44 3.02-7.4Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.77 0 5.1-.91 6.8-2.47l-3.24-2.51c-.86.61-2.02 1.03-3.56 1.03-2.71 0-5.01-1.79-5.83-4.27l-.11.01-3.15 2.44-.04.1A10 10 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.17 13.78a6.02 6.02 0 0 1-.34-1.98c0-.69.12-1.36.33-1.98l-.01-.13-3.19-2.48-.1.05A10 10 0 0 0 2 12c0 1.62.39 3.15 1.08 4.5l3.09-2.4Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.95c1.94 0 3.25.83 4 1.53l2.92-2.85C17.1 2.93 14.77 2 12 2a10 10 0 0 0-8.92 5.57l3.3 2.55c.84-2.48 3.13-4.17 5.62-4.17Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function HomePage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
        <section className="relative z-20 mx-auto flex min-h-screen w-full max-w-[400px] flex-col px-6 pt-12">
        <p className="mb-6 w-full text-center text-xs uppercase tracking-[0.35em] text-neutral-500">
          WhatNext?
        </p>

        <h1 className="mb-3 text-center text-4xl font-semibold leading-tight text-white">
          Deja de perder tiempo buscando qué ver.
        </h1>
        <p className="mb-8 text-center text-sm text-neutral-400">
          Tu lista hecha a tu medida. Solo lo que tienes en tus plataformas.
        </p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => router.push("/onboarding/nombre")}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-neutral-100"
          >
            <AppleIcon />
            Continuar con Apple
          </button>

          <button
            type="button"
            onClick={() => router.push("/onboarding/nombre")}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#202020]"
          >
            <GoogleIcon />
            Continuar con Google
          </button>
        </div>

        <div className="my-5 flex items-center gap-3 text-xs text-neutral-500">
          <span className="h-px flex-1 bg-[#2a2a2a]" />
          <span>o</span>
          <span className="h-px flex-1 bg-[#2a2a2a]" />
        </div>

        <button
          type="button"
          onClick={() => router.push("/onboarding/nombre")}
          className="w-full rounded-xl border border-[#2a2a2a] bg-transparent px-4 py-3 text-sm font-medium text-white transition hover:bg-[#151515]"
        >
          Continuar con email
        </button>

        <p className="mt-8 text-center text-[11px] leading-relaxed text-neutral-500">
          Al continuar, aceptas nuestros Términos y Política de privacidad.
        </p>
        </section>
      </div>
    </main>
  );
}
