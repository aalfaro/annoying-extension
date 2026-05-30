const DAY = 86_400_000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function formatDue(ts?: number): string | null {
  if (!ts) return null;
  const diff = Math.round((startOfDay(ts) - startOfDay(Date.now())) / DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff < 7) return `in ${diff}d`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function isOverdue(ts?: number): boolean {
  if (!ts) return false;
  return startOfDay(ts) < startOfDay(Date.now());
}

/** epoch ms -> "yyyy-mm-dd" for <input type="date"> */
export function dateInputValue(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** "yyyy-mm-dd" -> epoch ms (noon local, to dodge timezone edge cases) */
export function parseDateInput(v: string): number | undefined {
  if (!v) return undefined;
  const [y, m, d] = v.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d, 12, 0, 0).getTime();
}
