import { describe, expect, it } from 'vitest';
import { applyBundle, buildBundle, summarizeBundle, type BackupState } from './backup';
import { parseBundle } from '@/data/schema';
import type { Project, RecurringTask, Settings, Task, User } from '@/data/types';

const user: User = { id: 'u', email: 'me@example.com', createdAt: 0 };

function proj(id: string): Project {
  return { id, userId: 'u', name: id, color: '#fff', order: 0, createdAt: 0, updatedAt: 0 };
}
function task(id: string): Task {
  return { id, userId: 'u', projectId: null, title: id, status: 'todo', priority: 'med', order: 0, createdAt: 0, updatedAt: 0 };
}
function rec(id: string): RecurringTask {
  return { id, userId: 'u', projectId: null, title: id, priority: 'med', daysOfWeek: [1], active: true, createdAt: 0, updatedAt: 0 };
}
function settings(extra: Partial<Settings> = {}): Settings {
  return {
    userId: 'u',
    enabled: true,
    targetingMode: 'list',
    sites: [{ pattern: 'tiktok.com', enabled: true }],
    styles: { slideCard: true, blurTakeover: true, escalate: true, playful: true },
    intensity: 'normal',
    minIntervalSec: 90,
    maxIntervalSec: 180,
    soundEnabled: false,
    updatedAt: 0,
    ...extra,
  };
}
function state(extra: Partial<BackupState> = {}): BackupState {
  return {
    user,
    projects: [proj('p1')],
    tasks: [task('a')],
    recurringTasks: [rec('r1')],
    settings: settings(),
    ...extra,
  };
}

describe('buildBundle', () => {
  it('includes only the selected sections', () => {
    const b = buildBundle(state(), ['board'], '1.0.0', 0);
    expect(b.format).toBe('annoying-extension-backup');
    expect(b.sections).toEqual(['board']);
    expect(b.data.projects).toHaveLength(1);
    expect(b.data.tasks).toHaveLength(1);
    expect(b.data.recurringTasks).toBeUndefined();
    expect(b.data.settings).toBeUndefined();
  });
  it('splits settings into sites vs preferences', () => {
    const sites = buildBundle(state(), ['sites'], '1.0.0', 0);
    expect(sites.data.settings?.sites).toHaveLength(1);
    expect(sites.data.settings?.targetingMode).toBe('list');
    expect(sites.data.settings?.intensity).toBeUndefined();

    const prefs = buildBundle(state(), ['preferences'], '1.0.0', 0);
    expect(prefs.data.settings?.intensity).toBe('normal');
    expect(prefs.data.settings?.sites).toBeUndefined();
  });
});

describe('applyBundle — board', () => {
  it('replace overwrites; merge unions by id', () => {
    const cur = state({ tasks: [task('a')], projects: [proj('p1')] });
    const bundle = buildBundle(state({ tasks: [task('b')], projects: [proj('p2')] }), ['board'], '1.0.0', 0);

    const replaced = applyBundle(cur, bundle, ['board'], 'replace');
    expect(replaced.tasks.map((t) => t.id)).toEqual(['b']);
    expect(replaced.projects.map((p) => p.id)).toEqual(['p2']);

    const mergeBundle = buildBundle(state({ tasks: [task('a'), task('c')] }), ['board'], '1.0.0', 0);
    const merged = applyBundle(cur, mergeBundle, ['board'], 'merge');
    expect(merged.tasks.map((t) => t.id).sort()).toEqual(['a', 'c']); // 'a' not duplicated
  });
});

describe('applyBundle — sites', () => {
  it('replace overwrites + sets mode; merge unions by normalized pattern', () => {
    const cur = state({ settings: settings({ sites: [{ pattern: 'reddit.com', enabled: true }], targetingMode: 'list' }) });

    const repBundle = buildBundle(
      state({ settings: settings({ sites: [{ pattern: 'tiktok.com', enabled: true }], targetingMode: 'all' }) }),
      ['sites'],
      '1.0.0',
      0,
    );
    const replaced = applyBundle(cur, repBundle, ['sites'], 'replace');
    expect(replaced.settings.sites.map((s) => s.pattern)).toEqual(['tiktok.com']);
    expect(replaced.settings.targetingMode).toBe('all');

    const mergeBundle = buildBundle(
      state({ settings: settings({ sites: [{ pattern: 'www.reddit.com', enabled: true }, { pattern: 'tiktok.com', enabled: true }] }) }),
      ['sites'],
      '1.0.0',
      0,
    );
    const merged = applyBundle(cur, mergeBundle, ['sites'], 'merge');
    expect(merged.settings.sites.map((s) => s.pattern).sort()).toEqual(['reddit.com', 'tiktok.com']);
  });
});

describe('applyBundle — preferences & gating', () => {
  it('preferences overwrite under both modes', () => {
    const cur = state({ settings: settings({ intensity: 'chill', minIntervalSec: 180 }) });
    const bundle = buildBundle(
      state({ settings: settings({ intensity: 'relentless', minIntervalSec: 30 }) }),
      ['preferences'],
      '1.0.0',
      0,
    );
    for (const mode of ['replace', 'merge'] as const) {
      const next = applyBundle(cur, bundle, ['preferences'], mode);
      expect(next.settings.intensity).toBe('relentless');
      expect(next.settings.minIntervalSec).toBe(30);
    }
  });

  it('only applies sections that are both selected and present', () => {
    const cur = state({ tasks: [task('a')] });
    const recBundle = buildBundle(state({ recurringTasks: [rec('rX')] }), ['recurring'], '1.0.0', 0);

    // board selected but bundle has only recurring → nothing changes
    const noop = applyBundle(cur, recBundle, ['board'], 'replace');
    expect(noop.tasks.map((t) => t.id)).toEqual(['a']);
    expect(noop.recurringTasks.map((r) => r.id)).toEqual(['r1']);

    // selecting recurring applies it
    const applied = applyBundle(cur, recBundle, ['recurring'], 'replace');
    expect(applied.recurringTasks.map((r) => r.id)).toEqual(['rX']);
  });
});

describe('parseBundle', () => {
  it('round-trips a built bundle and rejects junk', () => {
    const b = buildBundle(state(), ['board', 'recurring', 'sites', 'preferences'], '1.0.0', 0);
    const roundTripped = JSON.parse(JSON.stringify(b));
    expect(parseBundle(roundTripped)).not.toBeNull();
    expect(parseBundle({ foo: 1 })).toBeNull();
    expect(parseBundle('not a bundle')).toBeNull();
  });
});

describe('summarizeBundle', () => {
  it('summarizes included sections with counts', () => {
    const sum = summarizeBundle(buildBundle(state(), ['board'], '1.0.0', 0));
    expect(sum.sections).toHaveLength(1);
    expect(sum.sections[0].id).toBe('board');
    expect(sum.sections[0].detail).toContain('1 tasks');
  });
});
