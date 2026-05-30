// The "when to nag" brain. Runs a self-re-arming alarm, watches the active tab, tracks how
// long you've lingered on a time-wasting site (escalation), and fires nags to the overlay.
//
// MV3 service workers are ephemeral, so escalation state lives in chrome.storage.session
// (survives worker restarts within a browser session) and scheduling uses persistent alarms.
import { browser } from 'wxt/browser';
import { repo } from '@/data';
import type { NagAction, NagLevel, NagPayload, NagStyleKind, Project, Task } from '@/data/types';
import { hostFromUrl, isTargetSite } from '@/lib/sites';
import { effectiveLevel, nextDelaySec, pickRandomTask, resolveStyle } from '@/nag/engine';
import { nagMessage } from '@/nag/messages';
import { isRuntimeMessage, sendNagToTab, type TestNagOpts } from '@/lib/messaging';

const ALARM = 'nag-tick';
const ROLLOVER = 'daily-rollover';
const DWELL_KEY = 'rt:dwell';
const OVERLAY_JS = '/content-scripts/overlay.js';

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

/** ms until the next local 00:05, the daily boundary for spawning recurring tasks. */
function msUntilNextRollover(now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 5, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

async function scheduleRollover(): Promise<void> {
  await browser.alarms.create(ROLLOVER, { when: Date.now() + msUntilNextRollover() });
}

/** Inject the overlay into a tab that loaded before the extension did (best-effort). */
async function ensureContentScript(tabId: number): Promise<void> {
  try {
    await browser.scripting.executeScript({ target: { tabId }, files: [OVERLAY_JS] });
  } catch {
    /* can't inject into chrome://, the Web Store, etc. */
  }
}

/**
 * Send a nag to a tab. If the content script isn't there yet (tab predates the extension),
 * inject it and retry while it mounts. Resolves to whether it was ultimately delivered.
 */
async function deliverNag(tabId: number, payload: NagPayload): Promise<boolean> {
  if (await sendNagToTab(tabId, payload)) return true;
  await ensureContentScript(tabId);
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 200));
    if (await sendNagToTab(tabId, payload)) return true;
  }
  return false;
}

function makePayload(
  task: Task,
  project: Project | undefined,
  o: { style: NagStyleKind; level: NagLevel; sticky: boolean; playful: boolean; sound: boolean },
): NagPayload {
  return {
    taskId: task.id,
    taskTitle: task.title,
    projectName: project?.name,
    projectColor: project?.color,
    style: o.style,
    level: o.level,
    playful: o.playful,
    message: nagMessage(task.title, o.playful),
    sound: o.sound,
    sticky: o.sticky,
  };
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
  // try/finally guarantees the self-re-arming alarm is ALWAYS rescheduled — a throw here
  // must never silently kill the nag loop.
  let nextDelay = 60;
  try {
    try {
      await repo.generateRecurringInstances();
    } catch (e) {
      console.warn('[annoying] recurring generation failed', e);
    }

    const settings = await repo.getSettings();
    if (!settings.enabled || (settings.snoozeUntil && settings.snoozeUntil > Date.now())) {
      return;
    }

    const tab = await getActiveTab();
    if (!tab?.id || !isTargetSite(tab.url, settings)) {
      await setDwell(null);
      nextDelay = Math.max(30, settings.minIntervalSec);
      return;
    }

    const task = pickRandomTask(await repo.listTasks());
    if (!task) {
      nextDelay = Math.max(60, settings.minIntervalSec); // nothing to nag about yet
      return;
    }

    const dwell = await getDwell();
    const dwellMs = dwell ? Date.now() - dwell.since : 0;
    const level = effectiveLevel(settings, dwellMs);
    const { kind, sticky } = resolveStyle(level, settings.styles);

    const projects = await repo.listProjects();
    const project = task.projectId ? projects.find((p) => p.id === task.projectId) : undefined;

    const payload = makePayload(task, project, {
      style: kind,
      level,
      sticky,
      playful: settings.styles.playful,
      sound: settings.soundEnabled,
    });

    await deliverNag(tab.id, payload);
    nextDelay = nextDelaySec(settings, level);
  } catch (e) {
    console.warn('[annoying] tick failed', e);
  } finally {
    await scheduleNext(nextDelay);
  }
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

/** Fire a forced demo nag on the active tab, ignoring site/snooze. Returns delivery success. */
async function handleTestNag(opts: TestNagOpts): Promise<boolean> {
  const tab = await getActiveTab();
  if (!tab?.id) return false;

  const settings = await repo.getSettings();
  const tasks = await repo.listTasks();
  const task: Task =
    pickRandomTask(tasks) ??
    ({
      id: 'demo',
      userId: '',
      projectId: null,
      title: 'This is a test task ✨',
      status: 'todo',
      priority: 'med',
      order: 0,
      createdAt: 0,
      updatedAt: 0,
    } as Task);
  const projects = await repo.listProjects();
  const project = task.projectId ? projects.find((p) => p.id === task.projectId) : undefined;

  const style: NagStyleKind = opts.style ?? 'card';
  const level: NagLevel = opts.level ?? 1;
  const payload = makePayload(task, project, {
    style,
    level,
    sticky: style === 'takeover' || level >= 2,
    playful: opts.playful ?? settings.styles.playful,
    sound: settings.soundEnabled,
  });
  return deliverNag(tab.id, payload);
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async () => {
    await repo.ensureSeeded();
    await repo.generateRecurringInstances();
    try {
      // Clicking the toolbar icon opens the side-panel task board.
      await browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch {
      /* sidePanel not available (older Chrome / Firefox) */
    }
    await scheduleNext(20);
    await scheduleRollover();
  });

  browser.runtime.onStartup.addListener(async () => {
    await repo.ensureSeeded();
    await repo.generateRecurringInstances();
    await scheduleNext(30);
    await scheduleRollover();
  });

  // Heal the alarms if the worker restarted without them.
  void browser.alarms.get(ALARM).then((a) => {
    if (!a) void scheduleNext(30);
  });
  void browser.alarms.get(ROLLOVER).then((a) => {
    if (!a) void scheduleRollover();
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM) void tick();
    if (alarm.name === ROLLOVER) {
      void (async () => {
        await repo.generateRecurringInstances();
        await scheduleRollover();
      })();
    }
  });

  // Track dwell on time-wasting sites for escalation.
  browser.tabs.onActivated.addListener(() => void refreshDwell());
  browser.tabs.onUpdated.addListener((_id, info) => {
    if (info.url || info.status === 'complete') void refreshDwell();
  });
  browser.windows.onFocusChanged.addListener(() => void refreshDwell());

  // React to the user acting on a nag, and to demo/test requests from the side panel.
  browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!isRuntimeMessage(msg)) return;
    if (msg.type === 'NAG_ACTION') {
      void handleAction(msg.taskId, msg.action);
      return;
    }
    if (msg.type === 'TEST_NAG') {
      void handleTestNag(msg)
        .then((delivered) => sendResponse({ delivered }))
        .catch(() => sendResponse({ delivered: false }));
      return true; // keep the channel open for the async response
    }
  });
});
