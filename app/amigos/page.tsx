"use client";

import Link from "next/link";
import { useState } from "react";

const APP_URL = "https://whatnext-gray.vercel.app";
const WHATSAPP_INVITE_TEXT =
  "Oye, estoy usando WhatNext? para encontrar películas perfectas para mí. Pruébalo en whatnext-gray.vercel.app";

/**
 * Cuando exista lista de amigos en Supabase, usar datos reales y renderizar aquí
 * las secciones "Actividad reciente" y "Tus amigos" (sin datos mock).
 */
const hasFriends = false;

function HomeIcon({ active = false }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.8v-6h-4.4v6H5a1 1 0 0 1-1-1v-8.5Z"
        stroke={active ? "#fff" : "#737373"}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="#737373" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="#737373" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function FriendsIcon({ active = false }: { active?: boolean }) {
  const stroke = active ? "#fff" : "#737373";
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="3" stroke={stroke} strokeWidth="1.8" />
      <circle cx="16.5" cy="10.5" r="2.5" stroke={stroke} strokeWidth="1.8" />
      <path d="M4.5 19a4.5 4.5 0 0 1 9 0" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14.5 19a3.5 3.5 0 0 1 5 0" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ProfileIcon({ active = false }: { active?: boolean }) {
  const stroke = active ? "#fff" : "#737373";
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke={stroke} strokeWidth="1.8" />
      <path d="M5 20a7 7 0 0 1 14 0" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MagnifyingGlassIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-neutral-500" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function AmigosPage() {
  const [friendSearch, setFriendSearch] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  const openWhatsAppInvite = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(WHATSAPP_INVITE_TEXT)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyAppLink = () => {
    void navigator.clipboard.writeText(APP_URL).then(() => {
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  return (
    <main className="flex min-h-screen justify-center bg-[#0a0a0a] px-6 pb-28 text-white">
      <div className="relative w-full max-w-[400px] pt-10">
        <p className="mb-6 w-full text-center text-xs uppercase tracking-[0.35em] text-neutral-500 select-none">WhatNext?</p>

        <section className="mb-8">
          <div className="flex gap-2">
            <label className="block min-w-0 flex-1">
              <span className="sr-only">Buscar amigos</span>
              <div className="flex items-center gap-3 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3">
                <MagnifyingGlassIcon />
                <input
                  type="search"
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  placeholder="Buscar amigos..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-neutral-500"
                />
              </div>
            </label>
            <button
              type="button"
              onClick={openWhatsAppInvite}
              className="flex-shrink-0 rounded-xl border border-neutral-600 px-4 py-3 text-sm font-medium text-neutral-200 transition hover:border-neutral-400 hover:text-white"
            >
              Invitar
            </button>
          </div>
        </section>

        {!hasFriends ? (
          <section className="mb-8 rounded-xl border border-[#2a2a2a] bg-[#101010] px-4 py-10 text-center">
            <p className="text-base font-medium text-white">Todavía no tienes amigos en WhatNext?</p>
            <p className="mt-2 text-sm text-neutral-400">
              Invita a alguien para ver su actividad y comparar gustos
            </p>
          </section>
        ) : null}

        <section className="mb-4 rounded-xl border border-[#2a2a2a] bg-[#101010] px-4 py-5">
          <h3 className="text-center text-base font-semibold text-white">Descubre amigos</h3>
          <p className="mt-3 text-center text-sm leading-relaxed text-neutral-300">
            ¿A quién conoces que también pierda tiempo buscando qué ver?
          </p>
          <button
            type="button"
            onClick={openWhatsAppInvite}
            className="mt-5 w-full rounded-xl bg-[#25D366] py-3 text-sm font-semibold text-white transition hover:bg-[#20bd5a]"
          >
            Invitar por WhatsApp
          </button>
          <button
            type="button"
            onClick={copyAppLink}
            className="mt-3 w-full rounded-xl border border-[#333] bg-[#1a1a1a] py-3 text-sm font-medium text-white transition hover:border-neutral-500"
          >
            {linkCopied ? "Copiado" : "Copiar enlace"}
          </button>
          <p className="mt-4 text-center text-xs text-neutral-500">
            Cuantos más amigos, mejores recomendaciones
          </p>
        </section>
      </div>

      <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-[400px] -translate-x-1/2 border-t border-[#1f1f1f] bg-[#0a0a0a]/95 px-5 py-3 backdrop-blur">
        <ul className="grid grid-cols-4 gap-2">
          <li>
            <Link
              href="/dashboard"
              className="flex flex-col items-center gap-1 text-[11px] font-medium text-neutral-500 transition hover:text-neutral-300"
            >
              <HomeIcon />
              <span>Inicio</span>
            </Link>
          </li>
          <li>
            <Link
              href="/buscar"
              className="flex flex-col items-center gap-1 text-[11px] font-medium text-neutral-500 transition hover:text-neutral-300"
            >
              <SearchIcon />
              <span>Buscar</span>
            </Link>
          </li>
          <li>
            <Link href="/amigos" className="flex flex-col items-center gap-1 text-[11px] font-medium text-white">
              <FriendsIcon active />
              <span>Amigos</span>
            </Link>
          </li>
          <li>
            <Link
              href="/perfil"
              className="flex flex-col items-center gap-1 text-[11px] font-medium text-neutral-500 transition hover:text-neutral-300"
            >
              <ProfileIcon />
              <span>Perfil</span>
            </Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}
