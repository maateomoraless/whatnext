"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

type ResultItem = {
  id: string;
  score: number;
  title: string;
  platform: string;
  platformColor: string;
  genre: string;
  locked?: boolean;
};

const RESULTS: ResultItem[] = [
  {
    id: "everything-everywhere-all-at-once",
    score: 94,
    title: "Everything Everywhere All at Once",
    platform: "Prime",
    platformColor: "#00A8E0",
    genre: "Sci-fi"
  },
  {
    id: "the-bear",
    score: 89,
    title: "The Bear",
    platform: "Disney+",
    platformColor: "#0063e5",
    genre: "Drama"
  },
  {
    id: "dune-parte-dos",
    score: 83,
    title: "Dune: Parte Dos",
    platform: "Netflix",
    platformColor: "#E50914",
    genre: "Épica"
  },
  {
    id: "oppenheimer",
    score: 79,
    title: "Oppenheimer",
    platform: "Max",
    platformColor: "#5822B4",
    genre: "Drama",
    locked: true
  }
];

export default function OnboardingResultadosPage() {
  const router = useRouter();
  const [name, setName] = useState("");

  useEffect(() => {
    const storedName = window.localStorage.getItem("nombre");
    if (storedName) {
      setName(storedName);
    }
  }, []);

  return (
    <main className="flex min-h-screen justify-center bg-[#0a0a0a] px-6 text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-[400px] flex-col items-center pt-12">
        <p className="mb-6 w-full text-center text-xs uppercase tracking-[0.35em] text-neutral-500 select-none">
          WhatNext?
        </p>

        <h1 className="mb-2 text-center text-3xl font-semibold leading-tight text-white">
          Tu lista, {name || "..."}
        </h1>
        <p className="mb-8 text-center text-sm text-neutral-400">
          Basada en tus gustos · Actualizada
        </p>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren: 0.1
              }
            }
          }}
          className="w-full max-w-[340px] space-y-2"
        >
          {RESULTS.map((item, index) => (
            <div key={`${item.id}-wrapper`}>
              {index === RESULTS.length - 1 && (
                <p className="mb-2 text-center text-xs text-neutral-400">🔒 Desbloquea tu lista completa</p>
              )}
              <motion.article
                variants={{
                  hidden: { opacity: 0, y: 18 },
                  visible: {
                    opacity: item.locked ? 0.35 : 1,
                    y: 0,
                    transition: { duration: 0.35, ease: "easeOut" }
                  }
                }}
                className="rounded-xl border border-[#2a2a2a] bg-black px-[14px] py-3"
                style={{
                  borderWidth: "0.5px",
                  ...(item.locked ? { filter: "blur(2px)" } : {})
                }}
              >
                <div className="flex items-center gap-3">
                  <p className="w-10 text-[18px] font-medium leading-none text-white">{item.score}%</p>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-white">{item.title}</p>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-neutral-400">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: item.platformColor }}
                      />
                      <span>{item.platform}</span>
                      <span>·</span>
                      <span>{item.genre}</span>
                    </div>
                    <div className="mt-2.5 h-[2px] w-full rounded-full bg-[#2a2a2a]">
                      <div
                        className="h-full rounded-full bg-white"
                        style={{ width: `${item.score}%` }}
                      />
                    </div>
                  </div>
                </div>
              </motion.article>
            </div>
          ))}
        </motion.div>

        <button
          type="button"
          onClick={() => router.push("/onboarding/trial")}
          className="mt-8 w-full max-w-[340px] rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-100"
        >
          Desbloquear lista completa →
        </button>
      </section>
    </main>
  );
}
