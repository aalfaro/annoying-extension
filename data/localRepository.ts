// chrome.storage.local-backed implementation of Repository. Reads are validated through
// schema.ts; writes touch the sync metadata so a future backend can detect local changes.
import { browser } from 'wxt/browser';
import { uid } from '@/lib/ids';
import { parseDateInput } from '@/lib/time';
import { dayKey, shouldSpawn } from '@/lib/recurrence';
import type {
  NewRecurringInput,
  NewTaskInput,
  ProjectPatch,
  RecurringPatch,
  Repository,
  TaskPatch,
} from './repository';
import {
  parseMeta,
  parseProjects,
  parseRecurring,
  parseSettings,
  parseTasks,
  parseUser,
} from './schema';
import { defaultSettings, makeUser, sampleProjectAndTasks, sampleRecurring } from './seed';
import { SCHEMA_VERSION } from './types';
import type { ID, Project, RecurringTask, Settings, Task, TaskStatus, User } from './types';

const K = {
  user: 'user',
  projects: 'projects',
  tasks: 'tasks',
  recurring: 'recurringTasks',
  settings: 'settings',
  meta: 'meta',
} as const;

async function getRaw<T = unknown>(key: string): Promise<T | undefined> {
  const res = await browser.storage.local.get(key);
  return res[key] as T | undefined;
}

async function setRaw(key: string, value: unknown): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const byOrder = (a: { order: number }, b: { order: number }) => a.order - b.order;

export class LocalRepository implements Repository {
  private async touchMeta(): Promise<void> {
    const meta = parseMeta(await getRaw(K.meta)) ?? {
      schemaVersion: SCHEMA_VERSION,
      lastLocalChangeAt: 0,
    };
    await setRaw(K.meta, { ...meta, lastLocalChangeAt: Date.now() });
  }

  async ensureSeeded(): Promise<void> {
    let user = parseUser(await getRaw(K.user));
    if (!user) {
      user = makeUser();
      await setRaw(K.user, user);
    }
    if (!parseSettings(await getRaw(K.settings))) {
      await setRaw(K.settings, defaultSettings(user.id));
    }
    // Only seed sample content on the very first run (projects key never written yet).
    if ((await getRaw(K.projects)) === undefined) {
      const { project, tasks } = sampleProjectAndTasks(user.id);
      await setRaw(K.projects, [project]);
      await setRaw(K.tasks, tasks);
    }
    if ((await getRaw(K.recurring)) === undefined) {
      await setRaw(K.recurring, sampleRecurring(user.id));
    }
    if (!parseMeta(await getRaw(K.meta))) {
      await setRaw(K.meta, { schemaVersion: SCHEMA_VERSION, lastLocalChangeAt: Date.now() });
    }
  }

  async getUser(): Promise<User> {
    let user = parseUser(await getRaw(K.user));
    if (!user) {
      user = makeUser();
      await setRaw(K.user, user);
    }
    return user;
  }

  // ---- Projects ----

  async listProjects(): Promise<Project[]> {
    return (parseProjects(await getRaw(K.projects)) ?? []).sort(byOrder);
  }

  private async saveProjects(projects: Project[]): Promise<void> {
    await setRaw(K.projects, projects);
    await this.touchMeta();
  }

  async createProject(input: { name: string; color?: string }): Promise<Project> {
    const user = await this.getUser();
    const projects = await this.listProjects();
    const now = Date.now();
    const project: Project = {
      id: uid(),
      userId: user.id,
      name: input.name.trim() || 'Untitled project',
      color: input.color ?? '#8B5CF6',
      order: projects.length,
      createdAt: now,
      updatedAt: now,
    };
    await this.saveProjects([...projects, project]);
    return project;
  }

  async updateProject(id: ID, patch: ProjectPatch): Promise<void> {
    const projects = await this.listProjects();
    const next = projects.map((p) =>
      p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p,
    );
    await this.saveProjects(next);
  }

  async deleteProject(id: ID): Promise<void> {
    const projects = (await this.listProjects()).filter((p) => p.id !== id);
    await this.saveProjects(projects);
    // Orphaned tasks fall back to the Inbox (projectId = null) rather than vanishing.
    const tasks = await this.listTasks();
    const touched = tasks.map((t) =>
      t.projectId === id ? { ...t, projectId: null, updatedAt: Date.now() } : t,
    );
    await this.saveTasks(touched);
  }

  // ---- Tasks ----

  async listTasks(): Promise<Task[]> {
    return parseTasks(await getRaw(K.tasks)) ?? [];
  }

  private async saveTasks(tasks: Task[]): Promise<void> {
    await setRaw(K.tasks, tasks);
    await this.touchMeta();
  }

  async createTask(input: NewTaskInput): Promise<Task> {
    const user = await this.getUser();
    const tasks = await this.listTasks();
    const status: TaskStatus = input.status ?? 'todo';
    const maxOrder = tasks
      .filter((t) => t.status === status)
      .reduce((m, t) => Math.max(m, t.order), -1);
    const now = Date.now();
    const task: Task = {
      id: uid(),
      userId: user.id,
      projectId: input.projectId ?? null,
      title: input.title.trim(),
      notes: input.notes?.trim() || undefined,
      status,
      priority: input.priority ?? 'med',
      order: maxOrder + 1,
      dueDate: input.dueDate,
      createdAt: now,
      updatedAt: now,
      completedAt: status === 'done' ? now : undefined,
      templateId: input.templateId,
      recurrenceDate: input.recurrenceDate,
    };
    await this.saveTasks([...tasks, task]);
    return task;
  }

  async updateTask(id: ID, patch: TaskPatch): Promise<void> {
    const tasks = await this.listTasks();
    const now = Date.now();
    const next = tasks.map((t) => {
      if (t.id !== id) return t;
      const merged: Task = { ...t, ...patch, updatedAt: now };
      if (patch.status === 'done' && t.status !== 'done') merged.completedAt = now;
      if (patch.status && patch.status !== 'done') merged.completedAt = undefined;
      return merged;
    });
    await this.saveTasks(next);
  }

  async moveTask(id: ID, toStatus: TaskStatus, toIndex: number): Promise<void> {
    const tasks = await this.listTasks();
    const moving = tasks.find((t) => t.id === id);
    if (!moving) return;
    const fromStatus = moving.status;
    const now = Date.now();

    moving.status = toStatus;
    moving.updatedAt = now;
    if (toStatus === 'done') moving.completedAt = moving.completedAt ?? now;
    else moving.completedAt = undefined;

    // Rebuild the destination column with `moving` inserted at toIndex.
    const dest = tasks
      .filter((t) => t.status === toStatus && t.id !== id)
      .sort(byOrder);
    dest.splice(clamp(toIndex, 0, dest.length), 0, moving);
    dest.forEach((t, i) => (t.order = i));

    // Re-pack the source column if it's different.
    if (fromStatus !== toStatus) {
      tasks
        .filter((t) => t.status === fromStatus)
        .sort(byOrder)
        .forEach((t, i) => (t.order = i));
    }

    await this.saveTasks(tasks);
  }

  async deleteTask(id: ID): Promise<void> {
    const tasks = (await this.listTasks()).filter((t) => t.id !== id);
    await this.saveTasks(tasks);
  }

  // ---- Recurring tasks ----

  async listRecurring(): Promise<RecurringTask[]> {
    return (parseRecurring(await getRaw(K.recurring)) ?? []).sort((a, b) => a.createdAt - b.createdAt);
  }

  private async saveRecurring(items: RecurringTask[]): Promise<void> {
    await setRaw(K.recurring, items);
    await this.touchMeta();
  }

  async createRecurring(input: NewRecurringInput): Promise<RecurringTask> {
    const user = await this.getUser();
    const items = await this.listRecurring();
    const now = Date.now();
    const rt: RecurringTask = {
      id: uid(),
      userId: user.id,
      projectId: input.projectId ?? null,
      title: input.title.trim(),
      notes: input.notes?.trim() || undefined,
      priority: input.priority ?? 'med',
      daysOfWeek: [...new Set(input.daysOfWeek)].sort((a, b) => a - b),
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    await this.saveRecurring([...items, rt]);
    return rt;
  }

  async updateRecurring(id: ID, patch: RecurringPatch): Promise<void> {
    const items = await this.listRecurring();
    const next = items.map((r) =>
      r.id === id
        ? {
            ...r,
            ...patch,
            daysOfWeek: patch.daysOfWeek
              ? [...new Set(patch.daysOfWeek)].sort((a, b) => a - b)
              : r.daysOfWeek,
            updatedAt: Date.now(),
          }
        : r,
    );
    await this.saveRecurring(next);
  }

  async deleteRecurring(id: ID): Promise<void> {
    await this.saveRecurring((await this.listRecurring()).filter((r) => r.id !== id));
  }

  async generateRecurringInstances(now: Date = new Date()): Promise<number> {
    const templates = await this.listRecurring();
    if (templates.length === 0) return 0;
    const tasks = await this.listTasks();
    const today = dayKey(now);
    const due = templates.filter((t) => shouldSpawn(t, tasks, now));
    if (due.length === 0) return 0;

    for (const tpl of due) {
      await this.createTask({
        title: tpl.title,
        notes: tpl.notes,
        priority: tpl.priority,
        projectId: tpl.projectId,
        status: 'todo',
        dueDate: parseDateInput(today),
        templateId: tpl.id,
        recurrenceDate: today,
      });
    }

    const dueIds = new Set(due.map((t) => t.id));
    await this.saveRecurring(
      templates.map((t) => (dueIds.has(t.id) ? { ...t, lastSpawnedDate: today } : t)),
    );
    return due.length;
  }

  // ---- Settings ----

  async getSettings(): Promise<Settings> {
    const existing = parseSettings(await getRaw(K.settings));
    if (existing) return existing;
    const user = await this.getUser();
    const fresh = defaultSettings(user.id);
    await setRaw(K.settings, fresh);
    return fresh;
  }

  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    const current = await this.getSettings();
    const next: Settings = { ...current, ...patch, updatedAt: Date.now() };
    await setRaw(K.settings, next);
    await this.touchMeta();
    return next;
  }
}
