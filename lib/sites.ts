// Decides whether a given URL is a "time-wasting" site we should nag on, based on the
// user's targeting settings. Pure functions — covered by sites.test.ts.
import type { Settings } from '@/data/types';

export function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Normalize a user-entered pattern into a bare, comparable hostname. */
export function normalizePattern(pattern: string): string {
  return pattern
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^\*\./, '')
    .replace(/^www\./, '');
}

/** True if `host` is the pattern's domain or any subdomain of it. */
export function matchesPattern(host: string, pattern: string): boolean {
  const p = normalizePattern(pattern);
  if (!p) return false;
  const h = host.toLowerCase().replace(/^www\./, '');
  return h === p || h.endsWith('.' + p);
}

export function isTargetSite(url: string | undefined, settings: Settings): boolean {
  if (!url || !/^https?:/i.test(url)) return false; // skip chrome://, about:, extension pages
  const host = hostFromUrl(url);
  if (!host) return false;
  if (settings.targetingMode === 'all') return true;
  return settings.sites.some((s) => s.enabled && matchesPattern(host, s.pattern));
}
