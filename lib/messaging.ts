// Typed message contract between the background worker and the content-script overlay.
import { browser } from 'wxt/browser';
import type { ID, NagAction, NagLevel, NagPayload, NagStyleKind } from '@/data/types';

export interface ShowNagMsg {
  type: 'SHOW_NAG';
  payload: NagPayload;
}

export interface NagActionMsg {
  type: 'NAG_ACTION';
  taskId: ID;
  action: NagAction;
}

export interface TestNagOpts {
  style?: NagStyleKind;
  level?: NagLevel;
  playful?: boolean;
}

/** side panel -> background: fire a forced demo nag on the active tab, bypassing site/snooze. */
export interface TestNagMsg extends TestNagOpts {
  type: 'TEST_NAG';
}

export type RuntimeMessage = ShowNagMsg | NagActionMsg | TestNagMsg;

export function isRuntimeMessage(x: unknown): x is RuntimeMessage {
  return !!x && typeof x === 'object' && 'type' in x;
}

/** background -> a specific tab's content script. Resolves to whether it was delivered. */
export function sendNagToTab(tabId: number, payload: NagPayload): Promise<boolean> {
  const msg: ShowNagMsg = { type: 'SHOW_NAG', payload };
  return browser.tabs.sendMessage(tabId, msg).then(
    () => true,
    () => false, // tab may have no content script (e.g. just navigated) — caller can re-inject
  );
}

/** side panel -> background. Returns whether the demo nag reached the page. */
export async function requestTestNag(opts: TestNagOpts = {}): Promise<boolean> {
  const msg: TestNagMsg = { type: 'TEST_NAG', ...opts };
  try {
    const res = (await browser.runtime.sendMessage(msg)) as { delivered?: boolean } | undefined;
    return !!res?.delivered;
  } catch {
    return false;
  }
}

/** content script -> background */
export function reportNagAction(taskId: ID, action: NagAction): Promise<void> {
  const msg: NagActionMsg = { type: 'NAG_ACTION', taskId, action };
  return browser.runtime.sendMessage(msg).then(
    () => {},
    () => {},
  );
}
