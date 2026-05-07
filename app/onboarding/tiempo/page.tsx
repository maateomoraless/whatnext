"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

const DEFAULT_PELICULAS_MES = 8;

export default function OnboardingTiempoPage() {
  const router = useRouter();
  const hasAnimatedRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const displayedMinutesRef = useRef(0);
  const [name, setName] = useState("");
  const [isExiting, setIsExiting] = useState(false);
  const [peliculasMes, setPeliculasMes] = useState(DEFAULT_PELICULAS_MES);
  const [displayedMinutes, setDisplayedMinutes] = useState(0);

  const minutosPerdidosMes = useMemo(() => peliculasMes * 18, [peliculasMes]);
  const horasPerdidasAno = useMemo(
    () => (minutosPerdidosMes * 12) / 60,
    [minutosPerdidosMes]
  );
  const horasPerdidasAnoRedondeadas = useMemo(
    () => Math.round(horasPerdidasAno),
    [horasPerdidasAno]
  );

  const animateMinutes = (from: number, to: number, duration: number, onComplete?: () => void) => {
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
    }

    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      const nextValue = Math.round(from + (to - from) * eased);
      displayedMinutesRef.current = nextValue;
      setDisplayedMinutes(nextValue);

      if (progress < 1) {
        animationFrameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      animationFrameRef.current = null;
      if (onComplete) {
        onComplete();
      }
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);
  };

  useEffect(() => {
    const storedName = window.localStorage.getItem("nombre");
    const storedPeliculas = window.localStorage.getItem("peliculas_mes");

    if (storedName) {
      setName(storedName);
    }

    if (storedPeliculas) {
      const parsed = Number.parseInt(storedPeliculas, 10);
      if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 20) {
        setPeliculasMes(parsed);
      }
    }
  }, []);

  useEffect(() => {
    if (!hasAnimatedRef.current) {
      animateMinutes(0, 144, 1500, () => {
        hasAnimatedRef.current = true;
        if (minutosPerdidosMes !== 144) {
          animateMinutes(144, minutosPerdidosMes, 600);
        }
      });
      return () => {
        if (animationFrameRef.current) {
          window.cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }

    animateMinutes(displayedMinutesRef.current, minutosPerdidosMes, 600);
    return undefined;
  }, [minutosPerdidosMes]);

  return (
    <main className="flex min-h-screen justify-center bg-[#0a0a0a] px-6 text-white">
      <AnimatePresence
        mode="wait"
        onExitComplete={() => {
          router.push("/onboarding/plataformas");
        }}
      >
        {!isExiting && (
          <motion.section
            key="tiempo-screen"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="mx-auto flex min-h-screen w-full max-w-[400px] flex-col items-center pt-12"
            style={{ position: "relative", zIndex: 1 }}
          >
            <div className="w-full">
              <p className="mb-6 w-full text-center text-xs uppercase tracking-[0.35em] text-neutral-500">
                WhatNext?
              </p>

              <div className="mb-8 flex items-center justify-center gap-2">
                <span className="h-1.5 w-3 rounded-full bg-[#2a2a2a]" />
                <span className="h-1.5 w-8 rounded-full bg-white" />
                <span className="h-1.5 w-3 rounded-full bg-[#2a2a2a]" />
                <span className="h-1.5 w-3 rounded-full bg-[#2a2a2a]" />
                <span className="h-1.5 w-3 rounded-full bg-[#2a2a2a]" />
              </div>

              <p className="mb-2 text-center text-sm text-neutral-400">
                Hola, {name || "..."}
              </p>
              <h1 className="mb-8 text-center text-3xl font-semibold leading-tight text-white">
                ¿Cuántas películas ves al mes?
              </h1>

              <div className="mb-8">
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={peliculasMes}
                  onChange={(event) => {
                    const value = Number.parseInt(event.target.value, 10);
                    setPeliculasMes(value);
                    window.localStorage.setItem("peliculas_mes", `${value}`);
                  }}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-white"
                />
              </div>

              <p className="mb-2 text-center text-sm text-neutral-400">
                Películas al mes: <span className="text-white">{peliculasMes}</span>
              </p>

              <p className="text-center text-[80px] font-semibold leading-none text-white">
                {displayedMinutes}
              </p>
              <p className="mb-8 text-center text-sm text-neutral-400">
                minutos perdidos al mes buscando
              </p>

              <div className="mb-6 rounded-2xl bg-[#1a1a1a] px-5 py-4 text-center">
                <p className="text-3xl font-semibold text-white">
                  {horasPerdidasAnoRedondeadas} h
                </p>
                <p className="mt-1 text-sm text-neutral-400">
                  al año mirando el techo sin saber qué ver
                </p>
              </div>

              <p className="text-center text-xs text-neutral-500">
                La media es 18 min por sesión buscando.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsExiting(true)}
              className="mt-6 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-100"
            >
              Suficiente, ayúdame →
            </button>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
