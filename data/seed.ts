// Pure factory functions for first-run defaults. No storage access here on purpose —
// LocalRepository.ensureSeeded() does the orchestration.
import { uid } from '@/lib/ids';
import type { Project, Settings, SiteRule, Task, User } from './types';

export function makeUser(): User {
  return { id: uid(), createdAt: Date.now() };
}

export function defaultSites(): SiteRule[] {
  return [
    'facebook.com',
    'instagram.com',
    'tiktok.com',
    'x.com',
    'twitter.com',
    'youtube.com',
    'reddit.com',
  ].map((pattern) => ({ pattern, enabled: true }));
}

export function defaultSettings(userId: string): Settings {
  return {
    userId,
    enabled: true,
    targetingMode: 'list',
    sites: defaultSites(),
    styles: { slideCard: true, blurTakeover: true, escalate: true, playful: true },
    intensity: 'normal',
    // Mirrors INTENSITY_PRESETS.normal in src/nag/engine.ts (kept inline so the data
    // layer stays independent of the nag layer).
    minIntervalSec: 90,
    maxIntervalSec: 180,
    soundEnabled: false,
    updatedAt: Date.now(),
  };
}

/** A welcoming first project + a few demo tasks so the board isn't empty on install. */
export function sampleProjectAndTasks(userId: string): { project: Project; tasks: Task[] } {
  const now = Date.now();
  const project: Project = {
    id: uid(),
    userId,
    name: 'Getting Things Done',
    color: '#8B5CF6',
    order: 0,
    createdAt: now,
    updatedAt: now,
  };
  const t = (
    title: string,
    status: Task['status'],
    priority: Task['priority'],
    order: number,
    notes?: string,
  ): Task => ({
    id: uid(),
    userId,
    projectId: project.id,
    title,
    notes,
    status,
    priority,
    order,
    createdAt: now,
    updatedAt: now,
    completedAt: status === 'done' ? now : undefined,
  });
  const tasks: Task[] = [
    t('Plan tomorrow’s top 3 priorities', 'todo', 'high', 0),
    t('Finish the quarterly report', 'todo', 'high', 1, 'Section 3 still needs the charts.'),
    t('Reply to 3 important emails', 'todo', 'med', 2),
    t('Read 10 pages of a book 📖', 'todo', 'low', 3),
    t('Drink a glass of water 💧', 'doing', 'low', 0),
    t('Set up Annoying-extension ✅', 'done', 'med', 0),
  ];
  return { project, tasks };
}
