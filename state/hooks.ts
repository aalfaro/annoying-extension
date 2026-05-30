// React hooks that read through the repository and stay live by listening to
// chrome.storage changes. Because every context (side panel, background, overlay) writes
// to the same storage, the side panel updates instantly when a nag completes a task.
import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { repo } from '@/data';
import type { Project, Settings, Task } from '@/data/types';

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

export function useSettings(): Settings | null {
  return useStorageBacked<Settings | null>('settings', () => repo.getSettings(), null);
}
