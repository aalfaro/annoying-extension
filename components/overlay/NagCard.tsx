import type { NagAction, NagPayload } from '@/data/types';

export function NagCard({
  payload,
  leaving,
  onAction,
}: {
  payload: NagPayload;
  leaving: boolean;
  onAction: (a: NagAction) => void;
}) {
  const cls = [
    'ae-card',
    payload.level >= 2 ? 'ae-card--lg' : '',
    payload.playful ? 'ae-shake' : '',
    leaving ? 'ae-out' : 'ae-slide-in',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} role="alert">
      <div className="ae-eyebrow">
        <span className="ae-badge">!</span> Annoying-extension
        {payload.sticky && <span className="ae-tag">won’t leave</span>}
      </div>
      <p className="ae-msg">{payload.message}</p>
      <div className="ae-taskchip">
        <span className="ae-dot" style={{ background: payload.projectColor || '#8B5CF6' }} />
        <span className="ae-taskchip-text">{payload.taskTitle}</span>
      </div>
      <div className="ae-actions">
        <button className="ae-btn ae-btn--primary" onClick={() => onAction('complete')}>
          ✓ Done
        </button>
        <button className="ae-btn" onClick={() => onAction('working')}>
          I’m on it
        </button>
        <button className="ae-btn ae-btn--ghost" onClick={() => onAction('snooze')}>
          Snooze
        </button>
      </div>
    </div>
  );
}
