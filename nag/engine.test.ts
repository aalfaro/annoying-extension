import { describe, expect, it } from 'vitest';
import {
  dwellToLevel,
  effectiveLevel,
  nextDelaySec,
  pickRandomTask,
  resolveStyle,
} from './engine';
import type { NagStyles, Settings, Task } from '@/data/types';

const ALL_STYLES: NagStyles = { slideCard: true, blurTakeover: true, escalate: true, playful: true };

function settings(partial: Partial<Settings> = {}): Settings {
  return {
    userId: 'u',
    enabled: true,
    targetingMode: 'list',
    sites: [],
    styles: ALL_STYLES,
    intensity: 'normal',
    minIntervalSec: 90,
    maxIntervalSec: 180,
    soundEnabled: false,
    updatedAt: 0,
    ...partial,
  };
}

function task(partial: Partial<Task>): Task {
  return {
    id: 't',
    userId: 'u',
    projectId: null,
    title: 'x',
    status: 'todo',
    priority: 'med',
    order: 0,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

const MIN = 60_000;

describe('dwellToLevel', () => {
  it('ramps up with time on site', () => {
    expect(dwellToLevel(0)).toBe(1);
    expect(dwellToLevel(1 * MIN)).toBe(1);
    expect(dwellToLevel(2 * MIN)).toBe(2);
    expect(dwellToLevel(4 * MIN)).toBe(2);
    expect(dwellToLevel(5 * MIN)).toBe(3);
    expect(dwellToLevel(20 * MIN)).toBe(3);
  });
});

describe('effectiveLevel', () => {
  it('stays at 1 when escalation is disabled', () => {
    const s = settings({ styles: { ...ALL_STYLES, escalate: false } });
    expect(effectiveLevel(s, 99 * MIN)).toBe(1);
  });
  it('follows dwell time when escalation is on', () => {
    expect(effectiveLevel(settings(), 5 * MIN)).toBe(3);
  });
});

describe('resolveStyle', () => {
  it('uses a sticky takeover at L3', () => {
    expect(resolveStyle(3, ALL_STYLES)).toEqual({ kind: 'takeover', sticky: true });
  });
  it('uses a card at L1 (loose) and L2 (sticky)', () => {
    expect(resolveStyle(1, ALL_STYLES)).toEqual({ kind: 'card', sticky: false });
    expect(resolveStyle(2, ALL_STYLES)).toEqual({ kind: 'card', sticky: true });
  });
  it('falls back to takeover when the card is disabled', () => {
    expect(resolveStyle(1, { ...ALL_STYLES, slideCard: false })).toEqual({ kind: 'takeover', sticky: false });
  });
  it('still shows a dismissible card when both styles are off', () => {
    expect(resolveStyle(3, { slideCard: false, blurTakeover: false, escalate: true, playful: true })).toEqual({
      kind: 'card',
      sticky: false,
    });
  });
});

describe('nextDelaySec', () => {
  it('fires sooner at higher levels', () => {
    const s = settings({ minIntervalSec: 100, maxIntervalSec: 100 });
    const l1 = nextDelaySec(s, 1, () => 0);
    const l3 = nextDelaySec(s, 3, () => 0);
    expect(l1).toBe(100);
    expect(l3).toBeLessThan(l1);
  });
  it('never goes below 20 seconds', () => {
    const s = settings({ minIntervalSec: 10, maxIntervalSec: 10 });
    expect(nextDelaySec(s, 1, () => 0)).toBeGreaterThanOrEqual(20);
  });
});

describe('pickRandomTask', () => {
  it('returns null when there is nothing open', () => {
    expect(pickRandomTask([])).toBeNull();
    expect(pickRandomTask([task({ status: 'done' })])).toBeNull();
  });
  it('never returns a completed task', () => {
    const tasks = [task({ id: 'a', status: 'done' }), task({ id: 'b', status: 'todo' })];
    for (let i = 0; i < 25; i++) {
      expect(pickRandomTask(tasks)?.status).not.toBe('done');
    }
  });
  it('is deterministic with an injected RNG', () => {
    const tasks = [task({ id: 'a', priority: 'low' }), task({ id: 'b', priority: 'high' })];
    expect(pickRandomTask(tasks, () => 0)?.id).toBe('a');
  });
});
