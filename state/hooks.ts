// React hooks that read through the repository and stay live by listening to
// chrome.storage changes. Because every context (side panel, background, overlay) writes
// to the same storage, the side panel updates instantly when a nag completes a task.
import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { repo } from '@/data';
import { hostFromUrl } from '@/lib/sites';
import type { Project, RecurringTask, Settings, SyncMeta, Task, User } from '@/data/types';

function useStorageBacked<T>(storageKey: string, load: () => Promise<T>, initial: T): T {
  const [value, setValue] = useState<T>(initial);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      loadRef.current().then((v) => {
        if (alive) setValue(v);
      });
    };
    refresh();
    const listener = (changes: Record<string, any>, area: string) => {
      if (area === 'local' && storageKey in changes) refresh();
    };
    browser.storage.onChanged.addListener(listener);
    return () => {
      alive = false;
      browser.storage.onChanged.removeListener(listener);
    };
  }, [storageKey]);

  return value;
}

export function useTasks(): Task[] {
  return useStorageBacked('tasks', () => repo.listTasks(), []);
}

export function useProjects(): Project[] {
  return useStorageBacked('projects', () => repo.listProjects(), []);
}

export function useRecurring(): RecurringTask[] {
  return useStorageBacked('recurringTasks', () => repo.listRecurring(), []);
}

export function useUser(): User | null {
  return useStorageBacked<User | null>('user', () => repo.getUser(), null);
}

export function useMeta(): SyncMeta | null {
  return useStorageBacked<SyncMeta | null>('meta', () => repo.getMeta(), null);
}

export function useSettings(): Settings | null {
  return useStorageBacked<Settings | null>('settings', () => repo.getSettings(), null);
}

/** The active tab's URL + host, kept fresh as the user navigates/switches tabs. */
export function useActiveTabHost(): { url: string | null; host: string | null } {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        let [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
        // Fall back when the side panel is the focused surface and no tab came back.
        if (!tab?.url) [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (alive) setUrl(tab?.url ?? null);
      } catch {
        if (alive) setUrl(null);
      }
    };
    void refresh();
    const onActivated = () => void refresh();
    const onUpdated = (_id: number, info: { url?: string; status?: string }) => {
      if (info.url || info.status === 'complete') void refresh();
    };
    browser.tabs.onActivated.addListener(onActivated);
    browser.tabs.onUpdated.addListener(onUpdated);
    return () => {
      alive = false;
      browser.tabs.onActivated.removeListener(onActivated);
      browser.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);
  return { url, host: url ? hostFromUrl(url) : null };
}
