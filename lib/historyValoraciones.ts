import type { MediaType } from "@/components/TmdbDetailSheet";

export function freshRatedAtIso(): string {
  return new Date().toISOString();
}

export type HistoryRow = {
  key: string;
  title: string;
  posterPath: string | null;
  stars: number;
  media: MediaType;
  tmdbId: number;
  /** ms desde epoch; 0 = sin fecha guardada (valoraciones antiguas). */
  ratedAtMs: number;
};

export function parseRatedAtMs(raw: unknown): number {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return 0;
  }
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

/** Más reciente primero; empate por tmdbId. */
export function sortHistoryByRecency(rows: HistoryRow[]): HistoryRow[] {
  return [...rows].sort((a, b) => {
    if (b.ratedAtMs !== a.ratedAtMs) {
      return b.ratedAtMs - a.ratedAtMs;
    }
    return b.tmdbId - a.tmdbId;
  });
}

function monthBucketKey(ratedAtMs: number): string {
  if (ratedAtMs <= 0) {
    return "__nodate__";
  }
  const d = new Date(ratedAtMs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthYearHeading(ratedAtMs: number): string {
  if (ratedAtMs <= 0) {
    return "Sin fecha";
  }
  const d = new Date(ratedAtMs);
  const raw = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(d);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Meses de más reciente a más antiguo; dentro de cada mes, día 31 → 1 y luego por hora. */
export function groupHistoryByMonthYear(sortedNewestFirst: HistoryRow[]): { heading: string; rows: HistoryRow[] }[] {
  const monthOrder: string[] = [];
  const seen = new Set<string>();
  for (const row of sortedNewestFirst) {
    const k = monthBucketKey(row.ratedAtMs);
    if (!seen.has(k)) {
      seen.add(k);
      monthOrder.push(k);
    }
  }

  const buckets = new Map<string, HistoryRow[]>();
  for (const row of sortedNewestFirst) {
    const k = monthBucketKey(row.ratedAtMs);
    const arr = buckets.get(k) ?? [];
    arr.push(row);
    buckets.set(k, arr);
  }

  return monthOrder.map((k) => {
    const rows = (buckets.get(k) ?? []).slice();
    rows.sort((a, b) => {
      if (a.ratedAtMs <= 0 && b.ratedAtMs <= 0) {
        return a.title.localeCompare(b.title, "es");
      }
      if (a.ratedAtMs <= 0) {
        return 1;
      }
      if (b.ratedAtMs <= 0) {
        return -1;
      }
      const da = new Date(a.ratedAtMs).getDate();
      const db = new Date(b.ratedAtMs).getDate();
      if (db !== da) {
        return db - da;
      }
      return b.ratedAtMs - a.ratedAtMs;
    });
    const heading =
      k === "__nodate__" ? "Sin fecha" : formatMonthYearHeading(rows[0]?.ratedAtMs ?? 0);
    return { heading, rows };
  });
}
