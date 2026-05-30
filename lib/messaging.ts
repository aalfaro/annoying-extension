// Typed message contract between the background worker and the content-script overlay.
import { browser } from 'wxt/browser';
import type { ID, NagAction, NagPayload } from '@/data/types';

export interface ShowNagMsg {
  type: 'SHOW_NAG';
  payload: NagPayload;
}

export interface NagActionMsg {
  type: 'NAG_ACTION';
  taskId: ID;
  action: NagAction;
}

export type RuntimeMessage = ShowNagMsg | NagActionMsg;

export function isRuntimeMessage(x: unknown): x is RuntimeMessage {
  return !!x && typeof x === 'object' && 'type' in x;
}

/** background -> a specific tab's content script */
export function sendNagToTab(tabId: number, payload: NagPayload): Promise<void> {
  const msg: ShowNagMsg = { type: 'SHOW_NAG', payload };
  return browser.tabs.sendMessage(tabId, msg).then(
    () => {},
    () => {}, // tab may have no content script (e.g. just navigated) — ignore
  );
}

/** content script -> background */
export function reportNagAction(taskId: ID, action: NagAction): Promise<void> {
  const msg: NagActionMsg = { type: 'NAG_ACTION', taskId, action };
  return browser.runtime.sendMessage(msg).then(
    () => {},
    () => {},
  );
}
