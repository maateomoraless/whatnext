"use client";

import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { readUserDataCache, readUserDataCacheJson } from "@/lib/userStorage";

type ActivityType = "watched" | "watchlist" | "rated";

type GustosSelection = Record<string, string[]>;

function readLocalName(userId: string): string | null {
  const meta = readUserDataCacheJson<{ nombre?: string }>(userId, "perfil_meta");
  const n = meta?.nombre?.trim();
  if (n) {
    return n;
  }
  const fallback = readUserDataCache(userId, "nombre")?.trim();
  return fallback && fallback.length > 0 ? fallback : null;
}

function readLocalGustos(userId: string): GustosSelection | null {
  const parsed = readUserDataCacheJson<Record<string, unknown>>(userId, "gustos");
  if (!parsed) {
    return null;
  }
  try {
    const out: GustosSelection = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (!Array.isArray(value)) {
        return;
      }
      out[key] = value.filter((v): v is string => typeof v === "string");
    });
    return out;
  } catch {
    return null;
  }
}

export async function syncProfileFromLocal(user: User): Promise<void> {
  const fullName =
    readLocalName(user.id) ??
    (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : null) ??
    user.email ??
    null;
  const username =
    (typeof user.user_metadata?.user_name === "string" && user.user_metadata.user_name.trim()) ||
    (typeof user.user_metadata?.username === "string" && user.user_metadata.username.trim()) ||
    null;
  const avatarUrl =
    typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url.trim() : null;
  const gustos = readLocalGustos(user.id);

  await supabase.from("profiles").upsert(
    {
      id: user.id,
      full_name: fullName,
      username,
      avatar_url: avatarUrl,
      gustos
    },
    { onConflict: "id" }
  );
}

export async function logUserActivity(params: {
  type: ActivityType;
  movieId: number;
  movieTitle?: string;
  posterPath?: string | null;
  rating?: number | null;
}): Promise<void> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return;
  }

  await supabase.from("user_activity").insert({
    user_id: user.id,
    type: params.type,
    movie_id: params.movieId,
    movie_title: params.movieTitle ?? null,
    poster_path: params.posterPath ?? null,
    rating: params.rating ?? null
  });
}
