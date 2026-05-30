// Small shared UI primitives used across the side panel. Tailwind-styled.
import { useEffect, type ReactNode } from 'react';
import type { Priority } from '@/data/types';

export const PROJECT_COLORS = [
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#EF4444',
  '#14B8A6',
  '#A855F7',
];

export function Button({
  children,
  onClick,
  variant = 'default',
  type = 'button',
  disabled,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed';
  const variants: Record<string, string> = {
    default: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    primary: 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm',
    ghost: 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
        checked ? 'bg-violet-600' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-md px-3 py-1 text-sm font-medium transition ${
            value === opt.value ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const PRIORITY_STYLES: Record<Priority, string> = {
  high: 'bg-red-100 text-red-700',
  med: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-500',
};
const PRIORITY_LABEL: Record<Priority, string> = { high: 'High', med: 'Med', low: 'Low' };

export function PriorityPill({ priority }: { priority: Priority }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_STYLES[priority]}`}>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PROJECT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Color ${c}`}
          onClick={() => onChange(c)}
          className={`h-6 w-6 rounded-full transition ${value === c ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            ✕
          </button>
        </div>
        {children}
        {footer && <div className="mt-4 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100';
