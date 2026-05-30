// Root of the in-page overlay. Always mounted (so it can receive messages), but renders
// an empty, click-through layer until the background tells it to nag.
import { useCallback, useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import type { NagAction, NagPayload } from '@/data/types';
import { isRuntimeMessage, reportNagAction } from '@/lib/messaging';
import { NagCard } from './NagCard';
import { BlurTakeover } from './BlurTakeover';
import { playChime } from './useNagSound';

const AUTODISMISS_MS = 7000;
const LEAVE_ANIM_MS = 280;

export function NagOverlay() {
  const [payload, setPayload] = useState<NagPayload | null>(null);
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const dismiss = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => {
      setPayload(null);
      setLeaving(false);
    }, LEAVE_ANIM_MS);
  }, []);

  const act = useCallback(
    (a: NagAction) => {
      setPayload((cur) => {
        if (cur) void reportNagAction(cur.taskId, a);
        return cur;
      });
      clearTimer();
      dismiss();
    },
    [dismiss],
  );

  // Listen for nags from the background worker.
  useEffect(() => {
    const listener = (msg: unknown) => {
      if (!isRuntimeMessage(msg) || msg.type !== 'SHOW_NAG') return;
      clearTimer();
      setLeaving(false);
      setPayload(msg.payload);
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, []);

  // Sound + auto-dismiss for non-sticky nags.
  useEffect(() => {
    if (!payload) return;
    if (payload.sound) playChime();
    if (!payload.sticky) {
      timerRef.current = window.setTimeout(() => dismiss(), AUTODISMISS_MS);
    }
    return clearTimer;
  }, [payload, dismiss]);

  if (!payload) return <div className="ae-layer" aria-hidden="true" />;

  return (
    <div className="ae-layer">
      {payload.style === 'takeover' ? (
        <BlurTakeover payload={payload} leaving={leaving} onAction={act} />
      ) : (
        <NagCard payload={payload} leaving={leaving} onAction={act} />
      )}
    </div>
  );
}
