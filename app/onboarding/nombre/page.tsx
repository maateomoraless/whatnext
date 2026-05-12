"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/lib/supabase";

function sanitizeUsernameInput(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 20);
}

export default function OnboardingNombrePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken" | "error">("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("nombre");
      if (stored) {
        setName(stored);
      }
      const storedUsername = window.localStorage.getItem("username");
      if (storedUsername) {
        setUsername(sanitizeUsernameInput(storedUsername.replace(/^@/, "")));
      }
    } catch {
      /* ignore */
    }
  }, []);
  const [isExiting, setIsExiting] = useState(false);
  const waveEmoji = "\u{1F44B}";

  const greetingText = useMemo(() => {
    return `Hola, ${name || "..."} ${waveEmoji}`;
  }, [name, waveEmoji]);

  const usernameWithAt = useMemo(() => `@${username}`, [username]);

  useEffect(() => {
    const u = username.trim();
    if (u.length < 3) {
      setAvailability("idle");
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void (async () => {
        setAvailability("checking");
        const { data: userData } = await supabase.auth.getUser();
        const currentUserId = userData.user?.id ?? null;
        const { data, error } = await supabase.from("profiles").select("id").eq("username", u).limit(1);
        if (cancelled) {
          return;
        }
        if (error) {
          setAvailability("error");
          return;
        }
        const row = data?.[0];
        if (!row) {
          setAvailability("available");
          return;
        }
        setAvailability(currentUserId && row.id === currentUserId ? "available" : "taken");
      })();
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [username]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isExiting || isSubmitting) {
      return;
    }
    const cleanName = name.trim();
    const cleanUsername = sanitizeUsernameInput(username);
    if (!cleanName || cleanUsername.length < 3 || availability === "taken") {
      return;
    }
    setIsSubmitting(true);
    window.localStorage.setItem("nombre", cleanName);
    window.localStorage.setItem("username", `@${cleanUsername}`);

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").upsert(
        {
          id: user.id,
          full_name: cleanName,
          username: cleanUsername
        },
        { onConflict: "id" }
      );
    }
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
              <p className="mb-6 w-full text-center text-xs uppercase tracking-[0.35em] text-neutral-500 select-none">
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
              <p className="mb-8 text-center text-sm text-neutral-400">
                Tu nombre y un username para que tus amigos te encuentren.
              </p>

              <form onSubmit={handleSubmit} className="mx-auto w-full text-center">
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Tu nombre"
                  className="w-full border-0 border-b border-white bg-transparent px-1 pb-3 text-center text-[30px] text-white placeholder:text-[18px] placeholder:text-neutral-400 focus:outline-none"
                />

                <div className="mt-6 rounded-xl border border-[#2a2a2a] bg-[#101010] px-4 py-3 text-left">
                  <label className="mb-1 block text-xs font-medium text-neutral-400">Nombre de usuario</label>
                  <div className="flex items-center text-sm text-white">
                    <span className="mr-1 text-neutral-400">@</span>
                    <input
                      type="text"
                      value={username}
                      onChange={(event) => setUsername(sanitizeUsernameInput(event.target.value.replace(/^@/, "")))}
                      placeholder="tu-usuario"
                      className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-neutral-600"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-neutral-500">Solo minúsculas, números y guiones (máx. 20).</p>
                  {username.length >= 3 ? (
                    <p
                      className={`mt-1 text-[11px] ${
                        availability === "available"
                          ? "text-emerald-400"
                          : availability === "taken"
                            ? "text-red-400"
                            : "text-neutral-500"
                      }`}
                    >
                      {availability === "checking"
                        ? "Comprobando..."
                        : availability === "available"
                          ? "Disponible"
                          : availability === "taken"
                            ? "Ya está en uso"
                            : availability === "error"
                              ? "No se pudo comprobar ahora"
                              : ""}
                    </p>
                  ) : null}
                </div>

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
                  disabled={
                    isSubmitting ||
                    name.trim().length === 0 ||
                    username.length < 3 ||
                    availability === "taken" ||
                    availability === "checking"
                  }
                  className="mt-12 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-100 disabled:opacity-60"
                >
                  Siguiente →
                </button>
                <p className="mt-2 text-center text-xs text-neutral-500">{usernameWithAt}</p>
              </form>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
