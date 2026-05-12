const MOVIE_STREAK_LS = "whatnext-daily-movie-streak";
const STREAK_MILESTONE_BANNERS_SHOWN_LS = "whatnext-streak-milestone-banners-shown";

function streakTodayKey(): string {
  return new Date().toLocaleDateString("en-CA");
}

function streakCalendarDaysBetween(isoA: string, isoB: string): number {
  const a = new Date(`${isoA}T12:00:00`);
  const b = new Date(`${isoB}T12:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

type StreakStorage = { lastActiveDate: string; count: number };

function readStreakFromStorage(): StreakStorage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(MOVIE_STREAK_LS);
    if (!raw) {
      return null;
    }
    const p = JSON.parse(raw) as unknown;
    if (
      !p ||
      typeof p !== "object" ||
      typeof (p as StreakStorage).lastActiveDate !== "string" ||
      typeof (p as StreakStorage).count !== "number"
    ) {
      return null;
    }
    return p as StreakStorage;
  } catch {
    return null;
  }
}

/** Racha mostrada: 0 si pasó más de un día sin actividad. */
export function readEffectiveMovieStreak(): number {
  const today = streakTodayKey();
  const s = readStreakFromStorage();
  if (!s) {
    return 0;
  }
  const diff = streakCalendarDaysBetween(s.lastActiveDate, today);
  if (diff >= 2) {
    window.localStorage.removeItem(MOVIE_STREAK_LS);
    return 0;
  }
  return s.count;
}

export type BumpMovieStreakResult = {
  count: number;
  /**
   * True cuando esta llamada avanzó la racha (nuevo día consecutivo, primer registro,
   * o reinicio tras hueco). False si ya hubo actividad hoy (misma racha, mismo contador).
   */
  streakJustAdvanced: boolean;
};

export function bumpMovieStreak(): BumpMovieStreakResult {
  const today = streakTodayKey();
  const s = readStreakFromStorage();
  let nextCount: number;
  let streakJustAdvanced: boolean;

  if (!s?.lastActiveDate) {
    nextCount = 1;
    streakJustAdvanced = true;
  } else if (s.lastActiveDate === today) {
    nextCount = s.count;
    streakJustAdvanced = false;
  } else if (streakCalendarDaysBetween(s.lastActiveDate, today) === 1) {
    nextCount = s.count + 1;
    streakJustAdvanced = true;
  } else {
    nextCount = 1;
    streakJustAdvanced = true;
  }

  const payload: StreakStorage = { lastActiveDate: today, count: nextCount };
  window.localStorage.setItem(MOVIE_STREAK_LS, JSON.stringify(payload));
  return { count: nextCount, streakJustAdvanced };
}

function readMilestonesShown(): Set<number> {
  if (typeof window === "undefined") {
    return new Set();
  }
  try {
    const raw = window.localStorage.getItem(STREAK_MILESTONE_BANNERS_SHOWN_LS);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed.filter((n): n is number => n === 3 || n === 7 || n === 30));
  } catch {
    return new Set();
  }
}

function markMilestoneShown(milestone: 3 | 7 | 30): void {
  if (typeof window === "undefined") {
    return;
  }
  const s = readMilestonesShown();
  s.add(milestone);
  window.localStorage.setItem(STREAK_MILESTONE_BANNERS_SHOWN_LS, JSON.stringify([...s]));
}

function streakMilestoneMessage(count: 3 | 7 | 30): string {
  if (count === 3) {
    return "🔥 3 días seguidos";
  }
  if (count === 7) {
    return "🔥 Semana perfecta";
  }
  return "🔥 Un mes sin parar";
}

function tryClaimMilestoneMessage(count: number): string | null {
  if (count !== 3 && count !== 7 && count !== 30) {
    return null;
  }
  const milestone = count as 3 | 7 | 30;
  const shown = readMilestonesShown();
  if (shown.has(milestone)) {
    return null;
  }
  markMilestoneShown(milestone);
  return streakMilestoneMessage(milestone);
}

/** Tras valorar o marcar visto: solo si la racha acaba de subir ese día. */
export function claimStreakMilestoneAfterBump(bump: BumpMovieStreakResult): string | null {
  if (!bump.streakJustAdvanced) {
    return null;
  }
  return tryClaimMilestoneMessage(bump.count);
}

/**
 * Al abrir el dashboard: si ya alcanzó 3 / 7 / 30 días (p. ej. en otra pantalla) y aún no se mostró el hito.
 */
export function claimPendingStreakMilestoneOnVisit(): string | null {
  return tryClaimMilestoneMessage(readEffectiveMovieStreak());
}
