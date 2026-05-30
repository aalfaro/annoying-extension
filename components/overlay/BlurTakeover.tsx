import { useEffect, useState } from 'react';
import type { NagAction, NagPayload } from '@/data/types';

const SNOOZE_UNLOCK_MS = 4000;

export function BlurTakeover({
  payload,
  leaving,
  onAction,
}: {
  payload: NagPayload;
  leaving: boolean;
  onAction: (a: NagAction) => void;
}) {
  const [unlocked, setUnlocked] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setUnlocked(true), SNOOZE_UNLOCK_MS);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className={`ae-backdrop ${leaving ? 'ae-out' : 'ae-fade-in'}`}>
      <div className={`ae-modal ae-pop-in ${payload.playful ? 'ae-shake' : ''}`} role="alertdialog" aria-modal="true">
        <div className="ae-eyebrow ae-eyebrow--center">
          <span className="ae-badge">!</span> Annoying-extension
        </div>
        <p className="ae-modal-msg">{payload.message}</p>
        <div className="ae-taskchip ae-taskchip--center">
          <span className="ae-dot" style={{ background: payload.projectColor || '#8B5CF6' }} />
          <span className="ae-taskchip-text">{payload.taskTitle}</span>
        </div>
        <div className="ae-actions ae-actions--stack">
          <button className="ae-btn ae-btn--primary ae-btn--lg" onClick={() => onAction('complete')}>
            ✓ Mark it done
          </button>
          <button className="ae-btn ae-btn--lg" onClick={() => onAction('working')}>
            I’ll do it right now
          </button>
          <button
            className="ae-btn ae-btn--ghost ae-btn--lg"
            disabled={!unlocked}
            onClick={() => unlocked && onAction('snooze')}
          >
            {unlocked ? 'Snooze 10 min' : 'Snooze (think about it…)'}
          </button>
        </div>
      </div>
    </div>
  );
}
