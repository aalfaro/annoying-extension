// The "when to nag" brain. Runs a self-re-arming alarm, watches the active tab, tracks how
// long you've lingered on a time-wasting site (escalation), and fires nags to the overlay.
//
// MV3 service workers are ephemeral, so escalation state lives in chrome.storage.session
// (survives worker restarts within a browser session) and scheduling uses persistent alarms.
import { browser } from 'wxt/browser';
import { repo } from '@/data';
import type { NagAction, NagPayload } from '@/data/types';
import { hostFromUrl, isTargetSite } from '@/lib/sites';
import { effectiveLevel, nextDelaySec, pickRandomTask, resolveStyle } from '@/nag/engine';
import { nagMessage } from '@/nag/messages';
import { isRuntimeMessage, sendNagToTab } from '@/lib/messaging';

const ALARM = 'nag-tick';
const DWELL_KEY = 'rt:dwell';

interface Dwell {
  host: string;
  since: number;
}

async function getDwell(): Promise<Dwell | null> {
  const r = await browser.storage.session.get(DWELL_KEY);
  return (r[DWELL_KEY] as Dwell | undefined) ?? null;
}

async function setDwell(d: Dwell | null): Promise<void> {
  if (d) await browser.storage.session.set({ [DWELL_KEY]: d });
  else await browser.storage.session.remove(DWELL_KEY);
}

async function getActiveTab() {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  return tab ?? null;
}

async function scheduleNext(seconds: number): Promise<void> {
  await browser.alarms.create(ALARM, { delayInMinutes: Math.max(0.5, seconds / 60) });
}

/** Keep the dwell timer in sync with whatever the active tab currently is. */
async function refreshDwell(): Promise<void> {
  const tab = await getActiveTab();
  const settings = await repo.getSettings();
  if (tab?.url && isTargetSite(tab.url, settings)) {
    const host = hostFromUrl(tab.url)!;
    const current = await getDwell();
    if (!current || current.host !== host) await setDwell({ host, since: Date.now() });
  } else {
    await setDwell(null);
  }
}

async function tick(): Promise<void> {
  const settings = await repo.getSettings();

  if (!settings.enabled || (settings.snoozeUntil && settings.snoozeUntil > Date.now())) {
    return scheduleNext(60);
  }

  const tab = await getActiveTab();
  if (!tab?.id || !isTargetSite(tab.url, settings)) {
    await setDwell(null);
    return scheduleNext(Math.max(30, settings.minIntervalSec));
  }

  const task = pickRandomTask(await repo.listTasks());
  if (!task) {
    return scheduleNext(Math.max(60, settings.minIntervalSec)); // nothing to nag about yet
  }

  const dwell = await getDwell();
  const dwellMs = dwell ? Date.now() - dwell.since : 0;
  const level = effectiveLevel(settings, dwellMs);
  const { kind, sticky } = resolveStyle(level, settings.styles);

  const projects = await repo.listProjects();
  const project = task.projectId ? projects.find((p) => p.id === task.projectId) : undefined;

  const payload: NagPayload = {
    taskId: task.id,
    taskTitle: task.title,
    projectName: project?.name,
    projectColor: project?.color,
    style: kind,
    level,
    playful: settings.styles.playful,
    message: nagMessage(task.title, settings.styles.playful),
    sound: settings.soundEnabled,
    sticky,
  };

  await sendNagToTab(tab.id, payload);
  await scheduleNext(nextDelaySec(settings, level));
}

async function handleAction(taskId: string, action: NagAction): Promise<void> {
  if (action === 'complete') {
    await repo.updateTask(taskId, { status: 'done' });
    await setDwell(null); // finishing a task earns an escalation reset
  } else if (action === 'snooze') {
    await repo.updateSettings({ snoozeUntil: Date.now() + 10 * 60 * 1000 });
  } else if (action === 'working') {
    await repo.updateSettings({ snoozeUntil: Date.now() + 90 * 1000 }); // brief cooldown
  }
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async () => {
    await repo.ensureSeeded();
    try {
      // Clicking the toolbar icon opens the side-panel task board.
      await browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch {
      /* sidePanel not available (older Chrome / Firefox) */
    }
    await scheduleNext(20);
  });

  browser.runtime.onStartup.addListener(async () => {
    await repo.ensureSeeded();
    await scheduleNext(30);
  });

  // Heal the alarm if the worker restarted without one.
  void browser.alarms.get(ALARM).then((a) => {
    if (!a) void scheduleNext(30);
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM) void tick();
  });

  // Track dwell on time-wasting sites for escalation.
  browser.tabs.onActivated.addListener(() => void refreshDwell());
  browser.tabs.onUpdated.addListener((_id, info) => {
    if (info.url || info.status === 'complete') void refreshDwell();
  });
  browser.windows.onFocusChanged.addListener(() => void refreshDwell());

  // React to the user acting on a nag.
  browser.runtime.onMessage.addListener((msg) => {
    if (isRuntimeMessage(msg) && msg.type === 'NAG_ACTION') {
      void handleAction(msg.taskId, msg.action);
    }
  });
});
