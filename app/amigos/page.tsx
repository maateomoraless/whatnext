"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { BottomNav } from "@/components/BottomNav";
import { MotionButton } from "@/components/ui/MotionButton";
import { SkeletonShimmer } from "@/components/ui/SkeletonShimmer";
import { supabase } from "@/lib/supabase";
import { syncProfileFromLocal } from "@/lib/social";
import { readUserDataCacheJson, setActiveStorageUserId, syncAllUserData } from "@/lib/userStorage";

const APP_URL = "https://whatnext-gray.vercel.app";
const WHATSAPP_INVITE_TEXT =
  "Oye, estoy usando WhatNext? para encontrar películas perfectas para mí. Pruébalo en whatnext-gray.vercel.app";

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  gustos?: Record<string, string[]> | null;
};

type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
};

type ActivityRow = {
  id: string;
  user_id: string;
  type: "watched" | "watchlist" | "rated";
  movie_id: number;
  movie_title: string | null;
  poster_path: string | null;
  rating: number | null;
  created_at: string;
};

const amigosListContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.05 }
  }
};

const amigosListItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } }
};

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
  const [userId, setUserId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<ProfileRow[]>([]);
  const [incoming, setIncoming] = useState<FriendshipRow[]>([]);
  const [friends, setFriends] = useState<ProfileRow[]>([]);
  const [feed, setFeed] = useState<ActivityRow[]>([]);
  const [profileById, setProfileById] = useState<Record<string, ProfileRow>>({});
  const [loading, setLoading] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [relationshipKeys, setRelationshipKeys] = useState<Set<string>>(new Set());
  const [reloadTick, setReloadTick] = useState(0);

  const readCurrentLocalGustos = (uid: string | null): Record<string, string[]> => {
    if (!uid) {
      return {};
    }
    try {
      const parsed = readUserDataCacheJson<Record<string, unknown>>(uid, "gustos");
      if (!parsed) {
        return {};
      }
      const out: Record<string, string[]> = {};
      Object.entries(parsed).forEach(([k, v]) => {
        if (k === "plataformas" || !Array.isArray(v)) {
          return;
        }
        out[k] = v.filter((item): item is string => typeof item === "string");
      });
      return out;
    } catch {
      return {};
    }
  };

  const currentLocalGustos = useMemo(() => readCurrentLocalGustos(userId), [userId]);

  const flattenGustos = (gustos: Record<string, string[]> | null | undefined): Set<string> => {
    const out = new Set<string>();
    if (!gustos) {
      return out;
    }
    Object.entries(gustos).forEach(([key, values]) => {
      if (key === "plataformas" || !Array.isArray(values)) {
        return;
      }
      values.forEach((v) => out.add(v.toLowerCase()));
    });
    return out;
  };

  const compatibilityForFriend = (friend: ProfileRow): number => {
    const a = flattenGustos(currentLocalGustos);
    const b = flattenGustos(friend.gustos);
    if (a.size === 0 || b.size === 0) {
      return 50;
    }
    const intersection = Array.from(a).filter((v) => b.has(v)).length;
    const union = new Set([...Array.from(a), ...Array.from(b)]).size;
    if (union === 0) {
      return 50;
    }
    return Math.max(10, Math.min(99, Math.round((intersection / union) * 100)));
  };

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || cancelled) {
        return;
      }
      setUserId(user.id);
      setActiveStorageUserId(user.id);
      await syncAllUserData(user.id);
      void syncProfileFromLocal(user);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data: friendshipRows } = await supabase
        .from("friendships")
        .select("id,requester_id,addressee_id,status,created_at")
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .order("created_at", { ascending: false });

      if (cancelled) {
        return;
      }
      const rows = (friendshipRows ?? []) as FriendshipRow[];
      setIncoming(rows.filter((row) => row.status === "pending" && row.addressee_id === userId));

      const acceptedFriendIds = rows
        .filter((row) => row.status === "accepted")
        .map((row) => (row.requester_id === userId ? row.addressee_id : row.requester_id));
      const allRelatedIds = new Set<string>([...acceptedFriendIds, ...rows.map((r) => r.requester_id)]);
      rows.forEach((r) => allRelatedIds.add(r.addressee_id));
      allRelatedIds.add(userId);

      const keys = new Set<string>();
      rows.forEach((r) => {
        keys.add(`${r.requester_id}:${r.addressee_id}`);
        keys.add(`${r.addressee_id}:${r.requester_id}`);
      });
      setRelationshipKeys(keys);

      const ids = Array.from(allRelatedIds);
      if (ids.length > 0) {
        const { data: profilesRows } = await supabase
          .from("profiles")
          .select("id,full_name,username,avatar_url,gustos")
          .in("id", ids);
        if (!cancelled) {
          const profileMap: Record<string, ProfileRow> = {};
          (profilesRows ?? []).forEach((p) => {
            profileMap[p.id] = p as ProfileRow;
          });
          setProfileById(profileMap);
          setFriends(
            acceptedFriendIds
              .map((id) => profileMap[id])
              .filter((p): p is ProfileRow => Boolean(p))
          );
        }
      } else {
        setFriends([]);
        setProfileById({});
      }

      if (acceptedFriendIds.length > 0) {
        const { data: activityRows } = await supabase
          .from("user_activity")
          .select("id,user_id,type,movie_id,movie_title,poster_path,rating,created_at")
          .in("user_id", acceptedFriendIds)
          .order("created_at", { ascending: false })
          .limit(40);
        if (!cancelled) {
          setFeed((activityRows ?? []) as ActivityRow[]);
        }
      } else if (!cancelled) {
        setFeed([]);
      }
      if (!cancelled) {
        setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, reloadTick]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    const q = friendSearch.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setLoadingSearch(false);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        setLoadingSearch(true);
        const { data } = await supabase
          .from("profiles")
          .select("id,full_name,username,avatar_url,gustos")
          .or(`full_name.ilike.%${q}%,username.ilike.%${q}%`)
          .neq("id", userId)
          .limit(8);
        setSearchResults((data ?? []) as ProfileRow[]);
        setLoadingSearch(false);
      })();
    }, 250);
    return () => window.clearTimeout(t);
  }, [friendSearch, userId]);

  const sendFriendRequest = async (profile: ProfileRow) => {
    if (!userId || sendingTo) {
      return;
    }
    setSendingTo(profile.id);
    const { data: existing } = await supabase
      .from("friendships")
      .select("id")
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${profile.id}),and(requester_id.eq.${profile.id},addressee_id.eq.${userId})`
      )
      .limit(1);
    if ((existing ?? []).length === 0) {
      await supabase.from("friendships").insert({
        requester_id: userId,
        addressee_id: profile.id,
        status: "pending"
      });
    }
    setSendingTo(null);
    setReloadTick((v) => v + 1);
  };

  const handleIncoming = async (row: FriendshipRow, status: "accepted" | "rejected") => {
    await supabase.from("friendships").update({ status }).eq("id", row.id);
    setReloadTick((v) => v + 1);
  };

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
            <MotionButton
              type="button"
              onClick={openWhatsAppInvite}
              className="flex-shrink-0 rounded-xl border border-neutral-600 px-4 py-3 text-sm font-medium text-neutral-200 transition hover:border-neutral-400 hover:text-white"
            >
              Invitar
            </MotionButton>
          </div>
        </section>

        {incoming.length > 0 ? (
          <section className="mb-6 rounded-xl border border-[#2a2a2a] bg-[#101010] px-4 py-4">
            <h2 className="text-sm font-semibold text-white">Solicitudes recibidas</h2>
            <div className="mt-3 space-y-3">
              <AnimatePresence mode="popLayout">
                {incoming.map((row) => {
                  const p = profileById[row.requester_id];
                  const label = p?.full_name || p?.username || "Usuario";
                  return (
                    <motion.article
                      key={row.id}
                      layout
                      initial={{ opacity: 0, x: 28 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -36, transition: { duration: 0.3, ease: [0.4, 0, 1, 1] } }}
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      className="rounded-lg border border-[#252525] bg-[#141414] p-3"
                    >
                      <p className="text-sm text-white">{label}</p>
                      <div className="mt-2 flex gap-2">
                        <MotionButton
                          type="button"
                          onClick={() => void handleIncoming(row, "accepted")}
                          className="flex-1 rounded-lg bg-white py-2 text-xs font-semibold text-black transition hover:bg-neutral-100"
                        >
                          Aceptar
                        </MotionButton>
                        <MotionButton
                          type="button"
                          onClick={() => void handleIncoming(row, "rejected")}
                          className="flex-1 rounded-lg border border-[#333] bg-[#1a1a1a] py-2 text-xs font-medium text-neutral-300 transition hover:border-neutral-500 hover:text-white"
                        >
                          Rechazar
                        </MotionButton>
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </div>
          </section>
        ) : null}

        {loading ? (
          <section className="mb-8 rounded-xl border border-[#2a2a2a] bg-[#101010] px-4 py-8">
            <div className="mx-auto max-w-[240px] space-y-3">
              <SkeletonShimmer className="h-4 w-full" rounded="md" />
              <SkeletonShimmer className="h-16 w-full" rounded="lg" />
              <SkeletonShimmer className="h-16 w-full" rounded="lg" />
              <p className="text-center text-sm text-neutral-500">Cargando amigos...</p>
            </div>
          </section>
        ) : friends.length === 0 ? (
          <section className="mb-8 rounded-xl border border-[#2a2a2a] bg-[#101010] px-4 py-10 text-center">
            <p className="text-base font-medium text-white">Todavía no tienes amigos en WhatNext?</p>
            <p className="mt-2 text-sm text-neutral-400">
              Invita a alguien para ver su actividad y comparar gustos
            </p>
          </section>
        ) : (
          <section className="mb-6 rounded-xl border border-[#2a2a2a] bg-[#101010] px-4 py-4">
            <h2 className="text-sm font-semibold text-white">Tus amigos</h2>
            <div className="mt-3 space-y-3">
              {friends.map((friend) => {
                const score = compatibilityForFriend(friend);
                return (
                  <article key={friend.id} className="rounded-lg border border-[#252525] bg-[#141414] p-3">
                    <p className="text-sm font-medium text-white">{friend.full_name || friend.username || "Usuario"}</p>
                    <p className="mt-1 text-xs text-neutral-400">Compatibilidad: {score}%</p>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {friendSearch.trim().length >= 2 ? (
          <section className="mb-6 rounded-xl border border-[#2a2a2a] bg-[#101010] px-4 py-4">
            <h2 className="text-sm font-semibold text-white">Resultados</h2>
            {loadingSearch ? (
              <div className="mt-3 space-y-2">
                <SkeletonShimmer className="h-12 w-full" rounded="lg" />
                <SkeletonShimmer className="h-12 w-full" rounded="lg" />
              </div>
            ) : null}
            {!loadingSearch && searchResults.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-500">Sin resultados para esta búsqueda.</p>
            ) : null}
            <motion.div
              variants={amigosListContainer}
              initial="hidden"
              animate="show"
              className="mt-3 space-y-3"
            >
              {searchResults.map((profile) => {
                const key = `${userId}:${profile.id}`;
                const relationExists = relationshipKeys.has(key);
                return (
                  <motion.article
                    key={profile.id}
                    variants={amigosListItem}
                    className="flex items-center justify-between rounded-lg border border-[#252525] bg-[#141414] p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">{profile.full_name || profile.username || "Usuario"}</p>
                      {profile.username ? <p className="text-xs text-neutral-500">@{profile.username}</p> : null}
                    </div>
                    <MotionButton
                      type="button"
                      disabled={relationExists || sendingTo === profile.id}
                      onClick={() => void sendFriendRequest(profile)}
                      className="rounded-lg border border-[#333] bg-[#1a1a1a] px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:border-neutral-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {relationExists ? "Enviada" : sendingTo === profile.id ? "Enviando..." : "Añadir amigo"}
                    </MotionButton>
                  </motion.article>
                );
              })}
            </motion.div>
          </section>
        ) : null}

        <section className="mb-8 rounded-xl border border-[#2a2a2a] bg-[#101010] px-4 py-4">
          <h2 className="text-sm font-semibold text-white">Actividad reciente</h2>
          {feed.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">Aún no hay actividad de tus amigos.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {feed.map((row) => {
                const author = profileById[row.user_id];
                const actor = author?.full_name || author?.username || "Tu amigo";
                const action =
                  row.type === "rated"
                    ? `valoró con ${row.rating ?? "-"}★`
                    : row.type === "watchlist"
                      ? "añadió a watchlist"
                      : "marcó como vista";
                return (
                  <article key={row.id} className="rounded-lg border border-[#252525] bg-[#141414] p-3">
                    <p className="text-sm text-white">
                      <span className="font-medium">{actor}</span> {action}
                    </p>
                    <p className="mt-1 text-xs text-neutral-400">{row.movie_title || `TMDB #${row.movie_id}`}</p>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mb-4 rounded-xl border border-[#2a2a2a] bg-[#101010] px-4 py-5">
          <h3 className="text-center text-base font-semibold text-white">Descubre amigos</h3>
          <p className="mt-3 text-center text-sm leading-relaxed text-neutral-300">
            ¿A quién conoces que también pierda tiempo buscando qué ver?
          </p>
          <MotionButton
            type="button"
            onClick={openWhatsAppInvite}
            className="mt-5 w-full rounded-xl bg-[#25D366] py-3 text-sm font-semibold text-white transition hover:bg-[#20bd5a]"
          >
            Invitar por WhatsApp
          </MotionButton>
          <MotionButton
            type="button"
            onClick={copyAppLink}
            className="mt-3 w-full rounded-xl border border-[#333] bg-[#1a1a1a] py-3 text-sm font-medium text-white transition hover:border-neutral-500"
          >
            {linkCopied ? "Copiado" : "Copiar enlace"}
          </MotionButton>
          <p className="mt-4 text-center text-xs text-neutral-500">
            Cuantos más amigos, mejores recomendaciones
          </p>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
