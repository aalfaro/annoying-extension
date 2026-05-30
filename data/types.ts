// Core domain model. Everything is scoped to a `User` and carries timestamps so a
// future backend can sync (last-write-wins) without reshaping the data.

export type ID = string;

export type TaskStatus = 'todo' | 'doing' | 'done';
export type Priority = 'low' | 'med' | 'high';
export type TargetingMode = 'list' | 'all';
export type Intensity = 'chill' | 'normal' | 'relentless';

export interface User {
  id: ID;
  email?: string;
  displayName?: string;
  createdAt: number;
}

export interface Project {
  id: ID;
  userId: ID;
  name: string;
  color: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface Task {
  id: ID;
  userId: ID;
  projectId: ID | null; // null = no project ("Inbox")
  title: string;
  notes?: string;
  status: TaskStatus;
  priority: Priority;
  order: number; // ordering within its status column
  dueDate?: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface SiteRule {
  pattern: string; // hostname or glob, e.g. "tiktok.com" or "*.tiktok.com"
  enabled: boolean;
}

export interface NagStyles {
  slideCard: boolean; // slide-in corner card
  blurTakeover: boolean; // full-screen blur modal
  escalate: boolean; // ramp intensity the longer you linger
  playful: boolean; // sassy copy + shake (+ optional sound)
}

export interface Settings {
  userId: ID;
  enabled: boolean;
  targetingMode: TargetingMode;
  sites: SiteRule[];
  styles: NagStyles;
  intensity: Intensity;
  minIntervalSec: number;
  maxIntervalSec: number;
  soundEnabled: boolean;
  snoozeUntil?: number; // epoch ms; nags suppressed until then
  updatedAt: number;
}

// Bumped when the stored shape changes; drives future migrations.
export const SCHEMA_VERSION = 1;

export interface SyncMeta {
  schemaVersion: number;
  lastLocalChangeAt: number;
}

// ---- Runtime nag payload (background -> content script) ----

export type NagStyleKind = 'card' | 'takeover';
export type NagLevel = 1 | 2 | 3;

export interface NagPayload {
  taskId: ID;
  taskTitle: string;
  projectName?: string;
  projectColor?: string;
  style: NagStyleKind;
  level: NagLevel;
  playful: boolean;
  message: string;
  sound: boolean;
  sticky: boolean; // if true, can't be dismissed without acting / waiting
}

export type NagAction = 'complete' | 'snooze' | 'working';
