"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function OnboardingTrialPage() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen justify-center bg-[#0a0a0a] px-6 text-white">
      <motion.section
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="mx-auto flex min-h-screen w-full max-w-[400px] flex-col items-center pt-12"
      >
        <p className="mb-10 w-full text-center text-xs uppercase tracking-[0.35em] text-neutral-500 select-none">
          WhatNext?
        </p>

        <div className="mb-6 flex h-[52px] w-[52px] items-center justify-center rounded-xl bg-[#1a1a1a] text-2xl">
          🎬
        </div>

        <h1 className="text-center text-3xl font-semibold leading-tight text-white sm:text-4xl">
          WhatNext? es gratis.
        </h1>
        <p className="mt-4 mb-8 text-center text-base leading-relaxed text-neutral-400">
          Sin anuncios. Sin suscripción. Solo tus películas.
        </p>

        <ul className="mb-8 w-full space-y-3 text-left text-sm text-neutral-200">
          <li>✓ Recomendaciones personalizadas</li>
          <li>✓ Todas tus plataformas</li>
          <li>✓ Actualizado con tus gustos</li>
        </ul>

        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-100"
        >
          Empezar ahora →
        </button>
      </motion.section>
    </main>
  );
}
