// Runtime validation for everything we read out of storage. Stored data is untrusted
// (older versions, manual edits, corruption), so we parse defensively: invalid records
// are dropped rather than crashing the UI.
import { z } from 'zod';
import type { Project, Settings, SyncMeta, Task, User } from './types';

const userSchema = z.object({
  id: z.string(),
  email: z.string().optional(),
  displayName: z.string().optional(),
  createdAt: z.number(),
});

const projectSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  color: z.string(),
  order: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const taskSchema = z.object({
  id: z.string(),
  userId: z.string(),
  projectId: z.string().nullable(),
  title: z.string(),
  notes: z.string().optional(),
  status: z.enum(['todo', 'doing', 'done']),
  priority: z.enum(['low', 'med', 'high']),
  order: z.number(),
  dueDate: z.number().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  completedAt: z.number().optional(),
});

const siteRuleSchema = z.object({
  pattern: z.string(),
  enabled: z.boolean(),
});

const settingsSchema = z.object({
  userId: z.string(),
  enabled: z.boolean(),
  targetingMode: z.enum(['list', 'all']),
  sites: z.array(siteRuleSchema),
  styles: z.object({
    slideCard: z.boolean(),
    blurTakeover: z.boolean(),
    escalate: z.boolean(),
    playful: z.boolean(),
  }),
  intensity: z.enum(['chill', 'normal', 'relentless']),
  minIntervalSec: z.number(),
  maxIntervalSec: z.number(),
  soundEnabled: z.boolean(),
  snoozeUntil: z.number().optional(),
  updatedAt: z.number(),
});

const metaSchema = z.object({
  schemaVersion: z.number(),
  lastLocalChangeAt: z.number(),
});

export function parseUser(raw: unknown): User | undefined {
  const r = userSchema.safeParse(raw);
  return r.success ? r.data : undefined;
}

export function parseProjects(raw: unknown): Project[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Project[] = [];
  for (const item of raw) {
    const r = projectSchema.safeParse(item);
    if (r.success) out.push(r.data);
  }
  return out;
}

export function parseTasks(raw: unknown): Task[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Task[] = [];
  for (const item of raw) {
    const r = taskSchema.safeParse(item);
    if (r.success) out.push(r.data);
  }
  return out;
}

export function parseSettings(raw: unknown): Settings | undefined {
  const r = settingsSchema.safeParse(raw);
  return r.success ? r.data : undefined;
}

export function parseMeta(raw: unknown): SyncMeta | undefined {
  const r = metaSchema.safeParse(raw);
  return r.success ? r.data : undefined;
}
