import { describe, expect, it } from 'vitest';
import { hostFromUrl, isTargetSite, matchesPattern, normalizePattern } from './sites';
import type { Settings } from '@/data/types';

function settings(partial: Partial<Settings> = {}): Settings {
  return {
    userId: 'u',
    enabled: true,
    targetingMode: 'list',
    sites: [],
    styles: { slideCard: true, blurTakeover: true, escalate: true, playful: true },
    intensity: 'normal',
    minIntervalSec: 90,
    maxIntervalSec: 180,
    soundEnabled: false,
    updatedAt: 0,
    ...partial,
  };
}

describe('hostFromUrl', () => {
  it('extracts the hostname', () => {
    expect(hostFromUrl('https://www.facebook.com/feed')).toBe('www.facebook.com');
  });
  it('returns null for non-URLs', () => {
    expect(hostFromUrl('not a url')).toBeNull();
  });
});

describe('normalizePattern', () => {
  it('strips protocol, path, www and leading *.', () => {
    expect(normalizePattern('https://www.tiktok.com/explore')).toBe('tiktok.com');
    expect(normalizePattern('*.tiktok.com')).toBe('tiktok.com');
    expect(normalizePattern('  TikTok.com  ')).toBe('tiktok.com');
  });
});

describe('matchesPattern', () => {
  it('matches the domain and any subdomain', () => {
    expect(matchesPattern('facebook.com', 'facebook.com')).toBe(true);
    expect(matchesPattern('www.facebook.com', 'facebook.com')).toBe(true);
    expect(matchesPattern('m.facebook.com', 'facebook.com')).toBe(true);
  });
  it('rejects lookalikes', () => {
    expect(matchesPattern('notfacebook.com', 'facebook.com')).toBe(false);
    expect(matchesPattern('facebook.com.evil.com', 'facebook.com')).toBe(false);
  });
});

describe('isTargetSite', () => {
  it('matches every http(s) site in "all" mode', () => {
    expect(isTargetSite('https://example.com', settings({ targetingMode: 'all' }))).toBe(true);
  });
  it('ignores non-http schemes and missing URLs', () => {
    expect(isTargetSite('chrome://extensions', settings({ targetingMode: 'all' }))).toBe(false);
    expect(isTargetSite(undefined, settings({ targetingMode: 'all' }))).toBe(false);
  });
  it('matches only enabled rules in "list" mode', () => {
    const s = settings({
      targetingMode: 'list',
      sites: [
        { pattern: 'tiktok.com', enabled: true },
        { pattern: 'reddit.com', enabled: false },
      ],
    });
    expect(isTargetSite('https://www.tiktok.com', s)).toBe(true);
    expect(isTargetSite('https://reddit.com', s)).toBe(false);
    expect(isTargetSite('https://example.com', s)).toBe(false);
  });
});
