"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function OnboardingEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push("/onboarding/nombre");
  };

  const handleSignUp = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: origin ? `${origin}/onboarding/nombre` : undefined
      }
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.session) {
      router.push("/onboarding/nombre");
      return;
    }
    setInfo("Revisa tu correo para confirmar la cuenta antes de entrar.");
  };

  return (
    <main className="flex min-h-screen justify-center bg-[#0a0a0a] px-6 text-white">
      <section className="mx-auto flex w-full max-w-[400px] flex-col pb-16 pt-12">
        <p className="mb-6 w-full text-center text-xs uppercase tracking-[0.35em] text-neutral-500 select-none">
          WhatNext?
        </p>

        <h1 className="mb-2 text-center text-2xl font-semibold text-white">Entra con email</h1>
        <p className="mb-8 text-center text-sm text-neutral-400">
          Usa tu cuenta o crea una nueva en segundos.
        </p>

        <form onSubmit={handleSignIn} className="flex flex-col gap-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-neutral-400">Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-neutral-500"
              placeholder="tu@email.com"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-neutral-400">Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-neutral-500"
              placeholder="••••••••"
            />
          </label>

          {error ? <p className="text-center text-sm text-red-400">{error}</p> : null}
          {info ? <p className="text-center text-sm text-neutral-400">{info}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-100 disabled:opacity-60"
          >
            Entrar
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => void handleSignUp()}
            className="w-full rounded-xl border border-[#333] bg-[#161616] px-4 py-3 text-sm font-medium text-white transition hover:border-neutral-500 disabled:opacity-60"
          >
            Crear cuenta
          </button>
        </form>

        <button
          type="button"
          onClick={() => router.push("/")}
          className="mt-8 text-center text-sm text-neutral-500 underline-offset-2 hover:text-neutral-300 hover:underline"
        >
          Volver
        </button>
      </section>
    </main>
  );
}
