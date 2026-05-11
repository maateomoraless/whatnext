const MOVIE_STREAK_LS = "whatnext-daily-movie-streak";

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

export function bumpMovieStreak(): number {
  const today = streakTodayKey();
  const s = readStreakFromStorage();
  let nextCount: number;
  if (!s?.lastActiveDate) {
    nextCount = 1;
  } else if (s.lastActiveDate === today) {
    nextCount = s.count;
  } else if (streakCalendarDaysBetween(s.lastActiveDate, today) === 1) {
    nextCount = s.count + 1;
  } else {
    nextCount = 1;
  }
  const payload: StreakStorage = { lastActiveDate: today, count: nextCount };
  window.localStorage.setItem(MOVIE_STREAK_LS, JSON.stringify(payload));
  return nextCount;
}
