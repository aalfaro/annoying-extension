// The single data-access contract the rest of the app talks to. Today it's backed by
// chrome.storage (LocalRepository); swapping in an ApiRepository later (for a hosted,
// multi-device app) means implementing this interface and changing one line in index.ts.
import type { ID, Priority, Project, Settings, Task, TaskStatus, User } from './types';

export interface NewTaskInput {
  title: string;
  projectId?: ID | null;
  notes?: string;
  priority?: Priority;
  status?: TaskStatus;
  dueDate?: number;
}

export type TaskPatch = Partial<
  Pick<Task, 'title' | 'notes' | 'priority' | 'status' | 'projectId' | 'dueDate'>
>;

export type ProjectPatch = Partial<Pick<Project, 'name' | 'color' | 'order'>>;

export interface Repository {
  /** Make sure a user, default settings, and first-run sample data exist. */
  ensureSeeded(): Promise<void>;

  getUser(): Promise<User>;

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

  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
}
