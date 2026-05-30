// Pure, testable logic for day-of-week recurring tasks. The storage glue lives in
// LocalRepository.generateRecurringInstances(); everything here is side-effect free.
import type { RecurringTask, Task } from '@/data/types';

// Index 0 = Sunday .. 6 = Saturday (matches Date.getDay()).
export const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAYS = [1, 2, 3, 4, 5];
export const WEEKENDS = [0, 6];

/** Local `YYYY-MM-DD` key for a date (matches dateInputValue in lib/time.ts). */
export function dayKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function isScheduledOn(daysOfWeek: number[], d: Date = new Date()): boolean {
  return daysOfWeek.includes(d.getDay());
}

/**
 * Should an instance be spawned for this template right now? (stacking model)
 * Yes when the rule is active, scheduled for today, hasn't already been evaluated
 * today (so a manual delete won't respawn), and no instance exists yet for today.
 */
export function shouldSpawn(template: RecurringTask, tasks: Task[], now: Date = new Date()): boolean {
  if (!template.active) return false;
  if (!isScheduledOn(template.daysOfWeek, now)) return false;
  const today = dayKey(now);
  if (template.lastSpawnedDate === today) return false;
  return !tasks.some((t) => t.templateId === template.id && t.recurrenceDate === today);
}

/** Human-readable summary of selected days, used in the Recurring list. */
export function describeDays(daysOfWeek: number[]): string {
  const set = [...new Set(daysOfWeek)].sort((a, b) => a - b);
  if (set.length === 0) return 'Never';
  if (set.length === 7) return 'Every day';
  if (set.length === 5 && WEEKDAYS.every((d) => set.includes(d))) return 'Weekdays';
  if (set.length === 2 && WEEKENDS.every((d) => set.includes(d))) return 'Weekends';
  return set.map((d) => WEEKDAY_SHORT[d]).join(', ');
}
