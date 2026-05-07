"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

type Platform = {
  id: string;
  name: string;
  color: string;
};

const PLATFORMS: Platform[] = [
  { id: "netflix", name: "Netflix", color: "#E50914" },
  { id: "disney_plus", name: "Disney+", color: "#0063e5" },
  { id: "max", name: "Max", color: "#5822B4" },
  { id: "prime", name: "Prime", color: "#00A8E0" },
  { id: "apple_tv_plus", name: "Apple TV+", color: "#555555" },
  { id: "filmin", name: "Filmin", color: "#e8175d" }
];

export default function OnboardingPlataformasPage() {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  useEffect(() => {
    const storedPlatforms = window.localStorage.getItem("plataformas");
    if (!storedPlatforms) {
      return;
    }

    try {
      const parsed = JSON.parse(storedPlatforms);
      if (Array.isArray(parsed)) {
        setSelectedPlatforms(parsed.filter((item) => typeof item === "string"));
      }
    } catch {
      // Ignore malformed localStorage data.
    }
  }, []);

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      window.localStorage.setItem("plataformas", JSON.stringify(next));
      return next;
    });
  };

  return (
    <main className="flex min-h-screen justify-center bg-[#0a0a0a] px-6 text-white">
      <AnimatePresence
        mode="wait"
        onExitComplete={() => {
          router.push("/onboarding/gustos");
        }}
      >
        {!isExiting && (
          <motion.section
            key="plataformas-screen"
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
                <span className="h-1.5 w-3 rounded-full bg-[#2a2a2a]" />
                <span className="h-1.5 w-8 rounded-full bg-white" />
                <span className="h-1.5 w-3 rounded-full bg-[#2a2a2a]" />
                <span className="h-1.5 w-3 rounded-full bg-[#2a2a2a]" />
              </div>

              <h1 className="mb-2 text-center text-3xl font-semibold leading-tight text-white">
                ¿Qué plataformas tienes?
              </h1>
              <p className="mb-8 text-center text-sm text-neutral-400">
                Solo te recomendaremos lo que puedes ver ahora.
              </p>

              <div className="grid grid-cols-3 gap-3">
                {PLATFORMS.map((platform) => {
                  const isSelected = selectedPlatforms.includes(platform.id);
                  return (
                    <motion.button
                      key={platform.id}
                      type="button"
                      onClick={() => togglePlatform(platform.id)}
                      whileTap={{ scale: 0.98 }}
                      animate={isSelected ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="relative flex h-24 items-center justify-center rounded-xl border-2 bg-black px-2 text-center"
                      style={{
                        borderColor: isSelected ? platform.color : "#2a2a2a",
                        backgroundColor: isSelected ? `${platform.color}22` : "#0a0a0a"
                      }}
                    >
                      {isSelected && (
                        <span className="absolute right-2 top-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-black">
                          ✓
                        </span>
                      )}
                      <span className="text-sm font-semibold text-white">{platform.name}</span>
                    </motion.button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setIsExiting(true)}
                className="mt-6 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-100"
              >
                Siguiente →
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
