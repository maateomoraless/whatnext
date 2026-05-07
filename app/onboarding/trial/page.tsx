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
        <p className="mb-10 w-full text-center text-xs uppercase tracking-[0.35em] text-neutral-500">
          WhatNext?
        </p>

        <div className="mb-6 flex h-[52px] w-[52px] items-center justify-center rounded-xl bg-[#1a1a1a] text-2xl">
          🎬
        </div>

        <h1 className="text-center text-4xl font-semibold leading-tight text-white">
          7 días gratis.
        </h1>
        <h2 className="mb-4 text-center text-4xl font-semibold leading-tight text-white">
          Sin compromiso.
        </h2>

        <p className="text-center text-sm text-neutral-400">Después solo 2,99 €/mes.</p>
        <p className="mb-8 text-center text-sm text-neutral-400">Menos que una palomita de cine.</p>

        <div className="mb-5 w-full rounded-2xl bg-[#1a1a1a] px-4 py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-200">Prueba gratuita</span>
            <span className="font-medium text-[#0F6E56]">7 días gratis</span>
          </div>
          <div className="my-3 h-px w-full bg-[#2a2a2a]" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-200">Después</span>
            <span className="font-medium text-white">2,99 €/mes</span>
          </div>
        </div>

        <div className="mb-8 flex w-full items-center justify-between text-xs text-neutral-400">
          <span>✓ Cancela cuando quieras</span>
          <span>✓ Sin publicidad</span>
        </div>

        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-100"
        >
          Empezar gratis →
        </button>
      </motion.section>
    </main>
  );
}
