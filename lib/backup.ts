// Pure, testable export/import logic. No storage or DOM here — LocalRepository persists the
// results and the BackupPanel handles file download/upload.
import { SCHEMA_VERSION } from '@/data/types';
import type {
  BackupBundle,
  BackupSectionId,
  Project,
  RecurringTask,
  Settings,
  Task,
  User,
} from '@/data/types';
import { normalizePattern } from '@/lib/sites';

export const BACKUP_FORMAT = 'annoying-extension-backup';

export type ImportMode = 'replace' | 'merge';

/** Everything a backup can include, gathered from the repository. */
export interface BackupState {
  user: User;
  projects: Project[];
  tasks: Task[];
  recurringTasks: RecurringTask[];
  settings: Settings;
}

export interface SectionMeta {
  id: BackupSectionId;
  label: string;
  /** Short count summary for the live checklist, e.g. "12 tasks · 2 projects". */
  describe: (s: BackupState) => string;
}

export const BACKUP_SECTIONS: SectionMeta[] = [
  {
    id: 'board',
    label: 'Tasks & projects',
    describe: (s) => `${s.tasks.length} tasks · ${s.projects.length} projects`,
  },
  { id: 'recurring', label: 'Recurring rules', describe: (s) => `${s.recurringTasks.length} rules` },
  { id: 'sites', label: 'Time-wasting sites', describe: (s) => `${s.settings.sites.length} sites` },
  {
    id: 'preferences',
    label: 'Nag preferences',
    describe: () => 'intensity, intervals, styles, sound',
  },
];

export function buildBundle(
  state: BackupState,
  sections: BackupSectionId[],
  appVersion: string,
  now: number,
): BackupBundle {
  const data: BackupBundle['data'] = {};
  const settings: Partial<Settings> = {};

  if (sections.includes('board')) {
    data.projects = state.projects;
    data.tasks = state.tasks;
  }
  if (sections.includes('recurring')) {
    data.recurringTasks = state.recurringTasks;
  }
  if (sections.includes('sites')) {
    settings.sites = state.settings.sites;
    settings.targetingMode = state.settings.targetingMode;
  }
  if (sections.includes('preferences')) {
    settings.enabled = state.settings.enabled;
    settings.intensity = state.settings.intensity;
    settings.minIntervalSec = state.settings.minIntervalSec;
    settings.maxIntervalSec = state.settings.maxIntervalSec;
    settings.styles = state.settings.styles;
    settings.soundEnabled = state.settings.soundEnabled;
  }
  if (sections.includes('sites') || sections.includes('preferences')) {
    data.settings = settings;
  }

  return {
    format: BACKUP_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    appVersion,
    exportedAt: now,
    user: { id: state.user.id, email: state.user.email, displayName: state.user.displayName },
    sections: [...sections],
    data,
  };
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const seen = new Set(current.map((x) => x.id));
  return [...current, ...incoming.filter((x) => !seen.has(x.id))];
}

export interface AppliedState {
  projects: Project[];
  tasks: Task[];
  recurringTasks: RecurringTask[];
  settings: Settings;
}

/**
 * Compute the next state from importing `bundle`. Only sections that are both selected AND
 * present in the bundle are applied. Replace overwrites; Merge unions collections by id /
 * normalized site pattern (never deletes). Scalar preferences always overwrite.
 */
export function applyBundle(
  current: BackupState,
  bundle: BackupBundle,
  sections: BackupSectionId[],
  mode: ImportMode,
): AppliedState {
  const present = new Set(bundle.sections);
  const sel = sections.filter((s) => present.has(s));

  let projects = current.projects;
  let tasks = current.tasks;
  let recurringTasks = current.recurringTasks;
  const settings: Settings = { ...current.settings };

  if (sel.includes('board')) {
    const inProjects = bundle.data.projects ?? [];
    const inTasks = bundle.data.tasks ?? [];
    projects = mode === 'replace' ? inProjects : mergeById(projects, inProjects);
    tasks = mode === 'replace' ? inTasks : mergeById(tasks, inTasks);
  }
  if (sel.includes('recurring')) {
    const incoming = bundle.data.recurringTasks ?? [];
    recurringTasks = mode === 'replace' ? incoming : mergeById(recurringTasks, incoming);
  }
  if (sel.includes('sites')) {
    const incoming = bundle.data.settings?.sites ?? [];
    if (mode === 'replace') {
      settings.sites = incoming;
      if (bundle.data.settings?.targetingMode) settings.targetingMode = bundle.data.settings.targetingMode;
    } else {
      const seen = new Set(settings.sites.map((s) => normalizePattern(s.pattern)));
      settings.sites = [...settings.sites, ...incoming.filter((s) => !seen.has(normalizePattern(s.pattern)))];
    }
  }
  if (sel.includes('preferences')) {
    const p = bundle.data.settings;
    if (p) {
      if (p.enabled !== undefined) settings.enabled = p.enabled;
      if (p.intensity !== undefined) settings.intensity = p.intensity;
      if (p.minIntervalSec !== undefined) settings.minIntervalSec = p.minIntervalSec;
      if (p.maxIntervalSec !== undefined) settings.maxIntervalSec = p.maxIntervalSec;
      if (p.styles !== undefined) settings.styles = p.styles;
      if (p.soundEnabled !== undefined) settings.soundEnabled = p.soundEnabled;
    }
  }

  return { projects, tasks, recurringTasks, settings };
}

export interface BundleSummary {
  exportedAt: number;
  appVersion: string;
  userEmail?: string;
  sections: { id: BackupSectionId; label: string; detail: string }[];
}

export function summarizeBundle(bundle: BackupBundle): BundleSummary {
  const sections = BACKUP_SECTIONS.filter((s) => bundle.sections.includes(s.id)).map((s) => ({
    id: s.id,
    label: s.label,
    detail: summarizeSection(bundle, s.id),
  }));
  return {
    exportedAt: bundle.exportedAt,
    appVersion: bundle.appVersion,
    userEmail: bundle.user.email,
    sections,
  };
}

function summarizeSection(b: BackupBundle, id: BackupSectionId): string {
  switch (id) {
    case 'board':
      return `${b.data.tasks?.length ?? 0} tasks · ${b.data.projects?.length ?? 0} projects`;
    case 'recurring':
      return `${b.data.recurringTasks?.length ?? 0} rules`;
    case 'sites':
      return `${b.data.settings?.sites?.length ?? 0} sites`;
    case 'preferences':
      return 'intensity, intervals, styles, sound';
  }
}
