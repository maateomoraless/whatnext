"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { MotionButton } from "@/components/ui/MotionButton";
import { supabase } from "@/lib/supabase";
import {
  readUserDataCacheJson,
  saveUserData,
  setActiveStorageUserId,
  syncAllUserData
} from "@/lib/userStorage";

type QuestionSection = {
  id: string;
  title: string;
  options: string[];
  single?: boolean;
};

type GustosSelection = Record<string, string[]>;

const SECTIONS: QuestionSection[] = [
  {
    id: "generos",
    title: "¿Qué géneros te molan?",
    options: [
      "Acción",
      "Drama",
      "Comedia",
      "Terror",
      "Sci-fi",
      "Documental",
      "Thriller",
      "Animación",
      "Romance",
      "Fantasía"
    ]
  },
  {
    id: "tematica",
    title: "¿Qué temática te engancha más?",
    options: [
      "Mafia y crimen",
      "Superhéroes",
      "Política y poder",
      "Moda y lujo",
      "Deportes",
      "Espías",
      "Cocina y gastronomía",
      "Guerras e historia",
      "Música y cultura",
      "True crime",
      "Viajes y naturaleza",
      "Startups y tecnología"
    ]
  },
  {
    id: "tiempo",
    title: "¿Cuánto tiempo tienes?",
    options: ["Menos de 1h 30", "1h 30 — 2h", "Más de 2h", "Me da igual"],
    single: true
  },
  {
    id: "ambiente",
    title: "¿Qué ambiente buscas?",
    options: [
      "Para desconectar",
      "Para pensar",
      "Para reír",
      "Para emocionarme",
      "Adrenalina pura",
      "Ver en familia"
    ]
  },
  {
    id: "formato",
    title: "¿Prefieres películas o series?",
    options: ["Solo películas", "Solo series", "Las dos"],
    single: true
  },
  {
    id: "epoca",
    title: "¿Época?",
    options: ["Clásicos", "2000s", "Últimos 5 años", "Lo más reciente"]
  },
  {
    id: "idioma",
    title: "¿Idioma original?",
    options: ["Español", "Inglés", "Cine europeo", "Asiático", "Me da igual"]
  }
];

const PILL_COLORS: Record<string, Record<string, string>> = {
  generos: {
    "Acción": "#FF4500",
    Drama: "#4A90D9",
    Comedia: "#FFD700",
    Terror: "#8B0000",
    "Sci-fi": "#00CED1",
    Documental: "#808080",
    Thriller: "#800080",
    "Animación": "#FF69B4",
    Romance: "#FF1493",
    "Fantasía": "#9370DB"
  },
  tematica: {
    "Mafia y crimen": "#8B0000",
    "Superhéroes": "#FF4500",
    "Política y poder": "#1C3A6B",
    "Moda y lujo": "#FFD700",
    Deportes: "#00A550",
    "Espías": "#333333",
    "Cocina y gastronomía": "#FF8C00",
    "Guerras e historia": "#8B7355",
    "Música y cultura": "#9400D3",
    "True crime": "#DC143C",
    "Viajes y naturaleza": "#228B22",
    "Startups y tecnología": "#00BFFF"
  },
  tiempo: {
    "Menos de 1h 30": "#00CED1",
    "1h 30 — 2h": "#4A90D9",
    "Más de 2h": "#9370DB",
    "Me da igual": "#808080"
  },
  ambiente: {
    "Para desconectar": "#228B22",
    "Para pensar": "#4A90D9",
    "Para reír": "#FFD700",
    "Para emocionarme": "#FF1493",
    "Adrenalina pura": "#FF4500",
    "Ver en familia": "#FF8C00"
  },
  formato: {
    "Solo películas": "#E50914",
    "Solo series": "#00A8E0",
    "Las dos": "#9370DB"
  },
  epoca: {
    "Clásicos": "#8B7355",
    "2000s": "#FF69B4",
    "Últimos 5 años": "#00CED1",
    "Lo más reciente": "#00A550"
  },
  idioma: {
    "Español": "#AA151B",
    "Inglés": "#00247D",
    "Cine europeo": "#FFD700",
    "Asiático": "#DC143C",
    "Me da igual": "#808080"
  }
};

function brightenHexColor(hex: string, amount = 0.28) {
  const parsed = hex.replace("#", "");
  const r = Number.parseInt(parsed.slice(0, 2), 16);
  const g = Number.parseInt(parsed.slice(2, 4), 16);
  const b = Number.parseInt(parsed.slice(4, 6), 16);

  const brighten = (value: number) => Math.min(255, Math.round(value + (255 - value) * amount));

  return `rgb(${brighten(r)} ${brighten(g)} ${brighten(b)})`;
}

function createEmptySelections(): GustosSelection {
  return SECTIONS.reduce<GustosSelection>((acc, section) => {
    acc[section.id] = [];
    return acc;
  }, {});
}

export default function OnboardingGustosPage() {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);
  const [selections, setSelections] = useState<GustosSelection>(() => createEmptySelections());
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    void (async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (user) {
        userIdRef.current = user.id;
        setActiveStorageUserId(user.id);
        await syncAllUserData(user.id);
        const parsed = readUserDataCacheJson<Record<string, unknown>>(user.id, "gustos");
        if (parsed) {
          const next = createEmptySelections();
          SECTIONS.forEach((section) => {
            const value = parsed[section.id];
            if (Array.isArray(value)) {
              next[section.id] = value.filter((item): item is string => typeof item === "string");
            }
          });
          setSelections(next);
        }
      } else {
        const stored = typeof window !== "undefined" ? window.localStorage.getItem("gustos") : null;
        if (!stored) {
          return;
        }
        try {
          const parsed = JSON.parse(stored) as Record<string, unknown>;
          const next = createEmptySelections();
          SECTIONS.forEach((section) => {
            const value = parsed[section.id];
            if (Array.isArray(value)) {
              next[section.id] = value.filter((item): item is string => typeof item === "string");
            }
          });
          setSelections(next);
        } catch {
          /* ignore */
        }
      }
    })();
  }, []);

  const toggleOption = (sectionId: string, option: string, single = false) => {
    setSelections((prev) => {
      const current = prev[sectionId] ?? [];
      let nextValues: string[];

      if (single) {
        nextValues = current.includes(option) ? [] : [option];
      } else {
        nextValues = current.includes(option)
          ? current.filter((item) => item !== option)
          : [...current, option];
      }

      const next = { ...prev, [sectionId]: nextValues };
      void saveUserData(userIdRef.current, "gustos", next);
      return next;
    });
  };

  const progressDots = useMemo(
    () => ["inactive", "inactive", "inactive", "active", "inactive"],
    []
  );

  return (
    <main className="flex min-h-screen justify-center bg-[#0a0a0a] px-6 text-white">
      <AnimatePresence
        mode="wait"
        onExitComplete={() => {
          router.push("/onboarding/valoraciones");
        }}
      >
        {!isExiting && (
          <motion.section
            key="gustos-screen"
            initial={{ opacity: 0, x: 72 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -72 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="relative mx-auto flex min-h-screen w-full max-w-[400px] flex-col items-center pt-12"
            style={{ zIndex: 1 }}
          >
            <div className="w-full overflow-y-auto pb-28">
              <p className="mb-6 w-full text-center text-xs uppercase tracking-[0.35em] text-neutral-500 select-none">
                WhatNext?
              </p>

              <div className="mb-8 flex items-center justify-center gap-2">
                {progressDots.map((dot, index) => (
                  <span
                    // eslint-disable-next-line react/no-array-index-key
                    key={`${dot}-${index}`}
                    className={dot === "active" ? "h-1.5 w-8 rounded-full bg-white" : "h-1.5 w-3 rounded-full bg-[#2a2a2a]"}
                  />
                ))}
              </div>

              <h1 className="mb-2 text-center text-3xl font-semibold leading-tight text-white">
                Cuéntanos tus gustos
              </h1>
              <p className="mb-8 text-center text-sm text-neutral-400">
                Elige todo lo que te encaje.
              </p>

              <div className="space-y-7">
                {SECTIONS.map((section) => (
                  <div key={section.id}>
                    <h2 className="mb-3 text-sm font-medium text-white">{section.title}</h2>
                    <div className="flex flex-wrap gap-2">
                      {section.options.map((option) => {
                        const selected = selections[section.id]?.includes(option);
                        const baseColor = PILL_COLORS[section.id]?.[option];
                        const borderColor = selected
                          ? (baseColor ?? "#ffffff")
                          : "#2a2a2a";
                        const backgroundColor = selected
                          ? (baseColor ? `${baseColor}26` : "#ffffff")
                          : "transparent";
                        const textColor = selected
                          ? (baseColor ? brightenHexColor(baseColor) : "#000000")
                          : "#a3a3a3";
                        return (
                          <motion.button
                            key={option}
                            type="button"
                            layout
                            onClick={() => toggleOption(section.id, option, section.single)}
                            className="rounded-full border border-[#2a2a2a] px-3 py-1.5 text-sm transition"
                            whileTap={{ scale: 0.9 }}
                            animate={
                              selected
                                ? {
                                    scale: [1, 1.08, 1],
                                    boxShadow: [
                                      "0 0 0 0 rgba(0,0,0,0)",
                                      `0 0 10px 0 ${baseColor ?? "#ffffff66"}`,
                                      "0 0 0 0 rgba(0,0,0,0)"
                                    ]
                                  }
                                : { scale: 1, boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
                            }
                            transition={{ duration: 0.32, ease: "easeOut" }}
                            style={{
                              borderColor,
                              backgroundColor,
                              color: textColor
                            }}
                          >
                            {option}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <MotionButton
              type="button"
              onClick={() => setIsExiting(true)}
              className="fixed bottom-6 left-1/2 z-20 w-[calc(100%-3rem)] max-w-[400px] -translate-x-1/2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-100"
            >
              Siguiente →
            </MotionButton>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
