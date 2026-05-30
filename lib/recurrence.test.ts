import { describe, expect, it } from 'vitest';
import { dayKey, describeDays, isScheduledOn, shouldSpawn } from './recurrence';
import type { RecurringTask, Task } from '@/data/types';

const FIXED = new Date(2026, 4, 29); // local May 29, 2026
const WD = FIXED.getDay();
const OTHER = (WD + 1) % 7;

function tpl(partial: Partial<RecurringTask> = {}): RecurringTask {
  return {
    id: 'r',
    userId: 'u',
    projectId: null,
    title: 'Workout',
    priority: 'med',
    daysOfWeek: [WD],
    active: true,
    createdAt: 0,
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

describe('dayKey', () => {
  it('formats a local YYYY-MM-DD with zero padding', () => {
    expect(dayKey(FIXED)).toBe('2026-05-29');
    expect(dayKey(new Date(2026, 0, 3))).toBe('2026-01-03');
  });
});

describe('isScheduledOn', () => {
  it('matches the date’s weekday only', () => {
    expect(isScheduledOn([WD], FIXED)).toBe(true);
    expect(isScheduledOn([OTHER], FIXED)).toBe(false);
    expect(isScheduledOn([], FIXED)).toBe(false);
  });
});

describe('shouldSpawn', () => {
  it('spawns when active, scheduled, fresh, and no instance yet', () => {
    expect(shouldSpawn(tpl(), [], FIXED)).toBe(true);
  });
  it('skips inactive rules', () => {
    expect(shouldSpawn(tpl({ active: false }), [], FIXED)).toBe(false);
  });
  it('skips when today is not a scheduled day', () => {
    expect(shouldSpawn(tpl({ daysOfWeek: [OTHER] }), [], FIXED)).toBe(false);
  });
  it('skips when already evaluated today (respects manual delete)', () => {
    expect(shouldSpawn(tpl({ lastSpawnedDate: '2026-05-29' }), [], FIXED)).toBe(false);
  });
  it('skips when an instance already exists for today', () => {
    const existing = task({ templateId: 'r', recurrenceDate: '2026-05-29' });
    expect(shouldSpawn(tpl(), [existing], FIXED)).toBe(false);
  });
  it('still spawns when the only instance is from another day (stacking)', () => {
    const old = task({ templateId: 'r', recurrenceDate: '2026-05-28' });
    expect(shouldSpawn(tpl(), [old], FIXED)).toBe(true);
  });
});

describe('describeDays', () => {
  it('summarizes common patterns', () => {
    expect(describeDays([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
    expect(describeDays([1, 2, 3, 4, 5])).toBe('Weekdays');
    expect(describeDays([0, 6])).toBe('Weekends');
    expect(describeDays([])).toBe('Never');
    expect(describeDays([1, 3])).toBe('Mon, Wed');
  });
});
