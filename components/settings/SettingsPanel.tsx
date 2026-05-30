import { useState, type ReactNode } from 'react';
import { repo } from '@/data';
import type { Intensity, SiteRule, Settings } from '@/data/types';
import { useActiveTabHost, useSettings } from '@/state/hooks';
import { INTENSITY_PRESETS } from '@/nag/engine';
import { isTargetSite, normalizePattern } from '@/lib/sites';
import { requestTestNag, type TestNagOpts } from '@/lib/messaging';
import { Button, Segmented, Toggle } from '@/components/ui';

const update = (patch: Partial<Settings>) => void repo.updateSettings(patch);

export function SettingsPanel() {
  const settings = useSettings();
  if (!settings) return <div className="p-6 text-center text-sm text-slate-400">Loading…</div>;

  const snoozedFor = settings.snoozeUntil && settings.snoozeUntil > Date.now()
    ? Math.ceil((settings.snoozeUntil - Date.now()) / 60000)
    : 0;

  return (
    <div className="overflow-y-auto pb-24">
      <Section title="Nagging" desc="The master switch for the whole annoyance engine.">
        <ToggleRow
          label="Enable nags"
          desc="Turn the reminders on or off everywhere."
          checked={settings.enabled}
          onChange={(v) => update({ enabled: v })}
        />
        <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
          {snoozedFor > 0 ? (
            <>
              <span className="text-xs text-slate-500">😴 Snoozed for ~{snoozedFor} min</span>
              <Button variant="ghost" onClick={() => update({ snoozeUntil: undefined })}>
                Resume now
              </Button>
            </>
          ) : (
            <>
              <span className="text-xs text-slate-500">Need a break?</span>
              <Button variant="ghost" onClick={() => update({ snoozeUntil: Date.now() + 60 * 60 * 1000 })}>
                Snooze 1 hour
              </Button>
            </>
          )}
        </div>
      </Section>

      <DemoSection />

      <Section title="How annoying?" desc="Sets how often nags fire and how pushy they get.">
        <Segmented<Intensity>
          value={settings.intensity}
          onChange={(intensity) =>
            update({
              intensity,
              minIntervalSec: INTENSITY_PRESETS[intensity].minSec,
              maxIntervalSec: INTENSITY_PRESETS[intensity].maxSec,
            })
          }
          options={[
            { value: 'chill', label: 'Chill' },
            { value: 'normal', label: 'Normal' },
            { value: 'relentless', label: 'Relentless' },
          ]}
        />
        <div className="mt-4 space-y-3">
          <RangeRow
            label="Soonest nag"
            value={settings.minIntervalSec}
            onChange={(v) => update({ minIntervalSec: Math.min(v, settings.maxIntervalSec) })}
          />
          <RangeRow
            label="Latest nag"
            value={settings.maxIntervalSec}
            onChange={(v) => update({ maxIntervalSec: Math.max(v, settings.minIntervalSec) })}
          />
          <p className="text-xs text-slate-400">
            A nag fires at a random gap between these while you’re on a target site (Chrome enforces a ~30s floor).
          </p>
        </div>
      </Section>

      <Section title="Styles" desc="Pick how the nags show up on the page.">
        <ToggleRow
          label="Slide-in card"
          desc="A reminder card slides into the corner."
          checked={settings.styles.slideCard}
          onChange={(v) => update({ styles: { ...settings.styles, slideCard: v } })}
        />
        <ToggleRow
          label="Full-screen takeover"
          desc="Blurs the page with a modal you must act on."
          checked={settings.styles.blurTakeover}
          onChange={(v) => update({ styles: { ...settings.styles, blurTakeover: v } })}
        />
        <ToggleRow
          label="Escalate"
          desc="Gets pushier the longer you keep scrolling."
          checked={settings.styles.escalate}
          onChange={(v) => update({ styles: { ...settings.styles, escalate: v } })}
        />
        <ToggleRow
          label="Playful guilt-trips"
          desc="Sassy copy and a little shake. Mute it any time below."
          checked={settings.styles.playful}
          onChange={(v) => update({ styles: { ...settings.styles, playful: v } })}
        />
        <ToggleRow
          label="Sound"
          desc="Play a small chime on the strongest nags."
          checked={settings.soundEnabled}
          onChange={(v) => update({ soundEnabled: v })}
        />
      </Section>

      <Section title="Where to nag" desc="Choose which sites count as time-wasting.">
        <CurrentSiteRow settings={settings} />
        <Segmented
          value={settings.targetingMode}
          onChange={(targetingMode) => update({ targetingMode })}
          options={[
            { value: 'list', label: 'Only these sites' },
            { value: 'all', label: 'Every site' },
          ]}
        />
        {settings.targetingMode === 'list' && (
          <div className="mt-3">
            <SiteList sites={settings.sites} onChange={(sites) => update({ sites })} />
          </div>
        )}
        {settings.targetingMode === 'all' && (
          <p className="mt-3 text-xs text-amber-600">
            ⚠️ Heads up: nags will fire on <strong>every</strong> website you visit.
          </p>
        )}
      </Section>
    </div>
  );
}

function CurrentSiteRow({ settings }: { settings: Settings }) {
  const { host } = useActiveTabHost();
  if (!host) return null;
  const targeted = isTargetSite(`https://${host}`, settings);
  const normalized = normalizePattern(host);
  const inList = settings.sites.some((s) => normalizePattern(s.pattern) === normalized);
  return (
    <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-600">{host}</p>
        <p className="text-[11px] text-slate-400">
          {targeted ? '✓ nags fire on this site' : 'not a target — silent here'}
        </p>
      </div>
      {settings.targetingMode === 'list' && !inList && (
        <Button
          variant="primary"
          onClick={() => update({ sites: [...settings.sites, { pattern: normalized, enabled: true }] })}
        >
          ➕ Add
        </Button>
      )}
    </div>
  );
}

function DemoSection() {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fire = async (label: string, opts: TestNagOpts) => {
    setBusy(true);
    setStatus(`Sending ${label}…`);
    const ok = await requestTestNag(opts);
    setBusy(false);
    setStatus(
      ok
        ? `✓ ${label} shown on the current page`
        : '✗ Couldn’t reach this page — reload the tab (it also can’t run on chrome:// pages or the New Tab page).',
    );
  };

  return (
    <Section title="Demo & test" desc="Preview each nag style on the current page — and confirm the extension works.">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => fire('Slide-in card', { style: 'card', level: 1 })} disabled={busy}>
          Slide-in card
        </Button>
        <Button onClick={() => fire('Sticky card', { style: 'card', level: 2 })} disabled={busy}>
          Sticky card
        </Button>
        <Button onClick={() => fire('Blur takeover', { style: 'takeover', level: 3 })} disabled={busy}>
          Blur takeover
        </Button>
        <Button onClick={() => fire('Playful card', { style: 'card', level: 1, playful: true })} disabled={busy}>
          Playful
        </Button>
        <Button variant="primary" onClick={() => fire('Test nag', {})} disabled={busy}>
          Test nag
        </Button>
      </div>
      {status && <p className="mt-3 text-xs text-slate-500">{status}</p>}
    </Section>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="border-b border-slate-100 px-4 py-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {desc && <p className="mt-0.5 text-xs text-slate-400">{desc}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className="text-sm text-slate-700">{label}</p>
        {desc && <p className="text-xs text-slate-400">{desc}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function RangeRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className="font-medium text-slate-700">{value}s</span>
      </div>
      <input
        type="range"
        min={15}
        max={600}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-violet-600"
      />
    </label>
  );
}

function SiteList({ sites, onChange }: { sites: SiteRule[]; onChange: (sites: SiteRule[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const p = normalizePattern(draft);
    if (!p) return;
    if (!sites.some((s) => normalizePattern(s.pattern) === p)) {
      onChange([...sites, { pattern: p, enabled: true }]);
    }
    setDraft('');
  };
  return (
    <div className="space-y-1.5">
      {sites.map((s, i) => (
        <div key={s.pattern + i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
          <Toggle
            checked={s.enabled}
            onChange={(v) => onChange(sites.map((x, j) => (j === i ? { ...x, enabled: v } : x)))}
            label={s.pattern}
          />
          <span className={`flex-1 text-sm ${s.enabled ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
            {s.pattern}
          </span>
          <button
            onClick={() => onChange(sites.filter((_, j) => j !== i))}
            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
            aria-label={`Remove ${s.pattern}`}
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="add a site, e.g. news.ycombinator.com"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-violet-400"
        />
        <Button onClick={add}>Add</Button>
      </div>
    </div>
  );
}
