"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

export default function OnboardingNombrePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isExiting, setIsExiting] = useState(false);
  const waveEmoji = "\u{1F44B}";

  const greetingText = useMemo(() => {
    return `Hola, ${name || "..."} ${waveEmoji}`;
  }, [name, waveEmoji]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isExiting) {
      return;
    }
    window.localStorage.setItem("nombre", name.trim());
    setIsExiting(true);
  };

  return (
    <main className="flex min-h-screen justify-center bg-[#0a0a0a] px-6 text-white">
      <AnimatePresence
        mode="wait"
        onExitComplete={() => {
          router.push("/onboarding/tiempo");
        }}
      >
        {!isExiting && (
          <motion.section
            key="nombre-screen"
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
                <span className="h-1.5 w-8 rounded-full bg-white" />
                <span className="h-1.5 w-3 rounded-full bg-[#2a2a2a]" />
                <span className="h-1.5 w-3 rounded-full bg-[#2a2a2a]" />
                <span className="h-1.5 w-3 rounded-full bg-[#2a2a2a]" />
                <span className="h-1.5 w-3 rounded-full bg-[#2a2a2a]" />
              </div>

              <h1 className="mb-2 text-center text-3xl font-semibold leading-tight text-white">
                ¿Cómo quieres que te llamemos?
              </h1>
              <p className="mb-12 text-center text-sm text-neutral-400">
                Solo tu nombre, sin más.
              </p>

              <form onSubmit={handleSubmit} className="mx-auto w-full text-center">
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Tu nombre"
                  className="w-full border-0 border-b border-white bg-transparent px-1 pb-3 text-center text-[30px] text-white placeholder:text-[18px] placeholder:text-neutral-400 focus:outline-none"
                />

                <p className="mt-4 text-center text-sm text-neutral-400">
                  {Array.from(greetingText).map((char, index) => (
                    <span
                      key={`${char}-${index}`}
                      className="inline-block transition-all duration-300 ease-out"
                      style={{ transitionDelay: `${index * 18}ms` }}
                    >
                      {char === " " ? "\u00A0" : char}
                    </span>
                  ))}
                </p>

                <button
                  type="submit"
                  className="mt-12 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-100"
                >
                  Siguiente →
                </button>
              </form>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
