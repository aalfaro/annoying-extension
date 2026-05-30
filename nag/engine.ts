// The "annoyance" decision logic: how often to nag, how hard, and in what form.
// All pure functions so they're easy to unit-test (engine.test.ts).
import type { Intensity, NagLevel, NagStyleKind, NagStyles, Settings, Task } from '@/data/types';

export interface IntensityProfile {
  minSec: number;
  maxSec: number;
}

/** Base interval range per intensity. The UI applies these as a starting point. */
export const INTENSITY_PRESETS: Record<Intensity, IntensityProfile> = {
  chill: { minSec: 180, maxSec: 360 },
  normal: { minSec: 90, maxSec: 180 },
  relentless: { minSec: 30, maxSec: 75 },
};

/** Longer you linger on a time-wasting site, the higher the escalation level. */
export function dwellToLevel(dwellMs: number): NagLevel {
  const minutes = dwellMs / 60_000;
  if (minutes < 2) return 1;
  if (minutes < 5) return 2;
  return 3;
}

export interface ResolvedStyle {
  kind: NagStyleKind;
  sticky: boolean; // sticky = no easy dismiss (must act, or wait out a delay)
}

/**
 * Pick the visual treatment for a level, honoring which styles the user enabled.
 * L1 = gentle card, L2 = sticky card, L3 = full-screen blur takeover. Falls back
 * gracefully when a style is disabled.
 */
export function resolveStyle(level: NagLevel, styles: NagStyles): ResolvedStyle {
  if (level >= 3 && styles.blurTakeover) return { kind: 'takeover', sticky: true };
  if (styles.slideCard) return { kind: 'card', sticky: level >= 2 };
  if (styles.blurTakeover) return { kind: 'takeover', sticky: level >= 2 };
  // Both delivery styles off: still do *something*, but make it dismissible.
  return { kind: 'card', sticky: false };
}

/** Effective escalation level given whether escalation is even enabled. */
export function effectiveLevel(settings: Settings, dwellMs: number): NagLevel {
  if (!settings.styles.escalate) return 1;
  return dwellToLevel(dwellMs);
}

/** Seconds until the next nag. Higher levels fire sooner; never below 20s. */
export function nextDelaySec(settings: Settings, level: NagLevel, rand: () => number = Math.random): number {
  const min = Math.max(20, settings.minIntervalSec);
  const max = Math.max(min, settings.maxIntervalSec);
  const base = min + rand() * (max - min);
  const factor = level === 3 ? 0.45 : level === 2 ? 0.7 : 1;
  return Math.max(20, Math.round(base * factor));
}

/** Pick a random open task, lightly weighted toward higher priority. */
export function pickRandomTask(tasks: Task[], rand: () => number = Math.random): Task | null {
  const open = tasks.filter((t) => t.status !== 'done');
  if (open.length === 0) return null;
  const weightOf = (t: Task) => (t.priority === 'high' ? 3 : t.priority === 'med' ? 2 : 1);
  const total = open.reduce((sum, t) => sum + weightOf(t), 0);
  let r = rand() * total;
  for (const t of open) {
    r -= weightOf(t);
    if (r <= 0) return t;
  }
  return open[open.length - 1];
}
