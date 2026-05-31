// The single data-access contract the rest of the app talks to. Today it's backed by
// chrome.storage (LocalRepository); swapping in an ApiRepository later (for a hosted,
// multi-device app) means implementing this interface and changing one line in index.ts.
import type { ImportMode } from '@/lib/backup';
import type {
  BackupBundle,
  BackupSectionId,
  ID,
  Priority,
  Project,
  RecurringTask,
  Settings,
  SyncMeta,
  Task,
  TaskStatus,
  User,
} from './types';

export interface UserPatch {
  email?: string;
  displayName?: string;
}

export interface NewTaskInput {
  title: string;
  projectId?: ID | null;
  notes?: string;
  priority?: Priority;
  status?: TaskStatus;
  dueDate?: number;
  templateId?: ID;
  recurrenceDate?: string;
}

export type TaskPatch = Partial<
  Pick<Task, 'title' | 'notes' | 'priority' | 'status' | 'projectId' | 'dueDate'>
>;

export type ProjectPatch = Partial<Pick<Project, 'name' | 'color' | 'order'>>;

export interface NewRecurringInput {
  title: string;
  daysOfWeek: number[];
  projectId?: ID | null;
  notes?: string;
  priority?: Priority;
}

export type RecurringPatch = Partial<
  Pick<RecurringTask, 'title' | 'notes' | 'priority' | 'projectId' | 'daysOfWeek' | 'active'>
>;

export interface Repository {
  /** Make sure a user, default settings, and first-run sample data exist. */
  ensureSeeded(): Promise<void>;

  getUser(): Promise<User>;
  updateUser(patch: UserPatch): Promise<User>;
  getMeta(): Promise<SyncMeta>;

  /** Build a backup bundle from the selected sections. */
  exportBundle(sections: BackupSectionId[]): Promise<BackupBundle>;
  /** Apply a backup bundle (replace or merge) for the selected sections. */
  importBundle(bundle: BackupBundle, sections: BackupSectionId[], mode: ImportMode): Promise<void>;

  listProjects(): Promise<Project[]>;
  createProject(input: { name: string; color?: string }): Promise<Project>;
  updateProject(id: ID, patch: ProjectPatch): Promise<void>;
  deleteProject(id: ID): Promise<void>;

  listTasks(): Promise<Task[]>;
  createTask(input: NewTaskInput): Promise<Task>;
  updateTask(id: ID, patch: TaskPatch): Promise<void>;
  /** Move a task to a status column at a given index, renumbering affected columns. */
  moveTask(id: ID, toStatus: TaskStatus, toIndex: number): Promise<void>;
  deleteTask(id: ID): Promise<void>;

  listRecurring(): Promise<RecurringTask[]>;
  createRecurring(input: NewRecurringInput): Promise<RecurringTask>;
  updateRecurring(id: ID, patch: RecurringPatch): Promise<void>;
  deleteRecurring(id: ID): Promise<void>;
  /** Spawn Task instances for any rules due today. Idempotent; returns count created. */
  generateRecurringInstances(now?: Date): Promise<number>;

  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
}
