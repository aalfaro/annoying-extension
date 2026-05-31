import { useRef, useState, type ReactNode } from 'react';
import { repo } from '@/data';
import { parseBundle } from '@/data/schema';
import type { BackupBundle, BackupSectionId } from '@/data/types';
import { useMeta, useProjects, useRecurring, useSettings, useTasks, useUser } from '@/state/hooks';
import { BACKUP_SECTIONS, summarizeBundle, type BackupState, type ImportMode } from '@/lib/backup';
import { Button, Segmented, Toggle, inputClass } from '@/components/ui';

const SECTION_IDS = BACKUP_SECTIONS.map((s) => s.id);

function fileStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function formatTs(ts?: number): string {
  return ts ? new Date(ts).toLocaleString() : 'never';
}

export function BackupPanel() {
  const user = useUser();
  const projects = useProjects();
  const tasks = useTasks();
  const recurring = useRecurring();
  const settings = useSettings();
  const meta = useMeta();

  const state: BackupState | null =
    user && settings
      ? { user, projects, tasks, recurringTasks: recurring, settings }
      : null;

  if (!state) return <div className="p-6 text-center text-sm text-slate-400">Loading…</div>;

  return (
    <div className="h-full overflow-y-auto pb-10">
      <ProfileSection email={user?.email ?? ''} displayName={user?.displayName ?? ''} />
      <ExportSection state={state} lastExportAt={meta?.lastExportAt} />
      <ImportSection lastImportAt={meta?.lastImportAt} />
    </div>
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

function ProfileSection({ email, displayName }: { email: string; displayName: string }) {
  const [mail, setMail] = useState(email);
  const [name, setName] = useState(displayName);
  const [saved, setSaved] = useState(false);
  const dirty = mail !== email || name !== displayName;

  const save = async () => {
    await repo.updateUser({ email: mail, displayName: name });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <Section title="Profile" desc="Backups are tagged with this so you can recognize them across devices.">
      <div className="space-y-2">
        <input
          value={mail}
          onChange={(e) => setMail(e.target.value)}
          placeholder="you@example.com"
          type="email"
          className={inputClass}
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Display name (optional)"
          className={inputClass}
        />
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={save} disabled={!dirty}>
            Save profile
          </Button>
          {saved && <span className="text-xs text-emerald-600">Saved ✓</span>}
        </div>
      </div>
    </Section>
  );
}

function ExportSection({ state, lastExportAt }: { state: BackupState; lastExportAt?: number }) {
  const [selected, setSelected] = useState<Record<BackupSectionId, boolean>>({
    board: true,
    recurring: true,
    sites: true,
    preferences: true,
  });
  const [status, setStatus] = useState<string | null>(null);
  const anySelected = SECTION_IDS.some((id) => selected[id]);

  const exportNow = async () => {
    const sel = SECTION_IDS.filter((id) => selected[id]);
    if (!sel.length) return;
    const bundle = await repo.exportBundle(sel);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `annoying-extension-backup-${fileStamp()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Downloaded ✓');
    setTimeout(() => setStatus(null), 2000);
  };

  return (
    <Section title="Export" desc="Download a backup file you can keep or move to another device.">
      <div className="space-y-2">
        {BACKUP_SECTIONS.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm text-slate-700">{s.label}</p>
              <p className="text-[11px] text-slate-400">{s.describe(state)}</p>
            </div>
            <Toggle
              checked={selected[s.id]}
              onChange={(v) => setSelected((prev) => ({ ...prev, [s.id]: v }))}
              label={s.label}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button variant="primary" onClick={exportNow} disabled={!anySelected}>
          ⬇ Export backup
        </Button>
        {status && <span className="text-xs text-emerald-600">{status}</span>}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">Last exported: {formatTs(lastExportAt)}</p>
    </Section>
  );
}

function ImportSection({ lastImportAt }: { lastImportAt?: number }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [bundle, setBundle] = useState<BackupBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<ImportMode>('replace');
  const [status, setStatus] = useState<string | null>(null);

  const onFile = (file: File) => {
    setStatus(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseBundle(JSON.parse(String(reader.result)));
        if (!parsed) {
          setError('That doesn’t look like an Annoying-extension backup file.');
          setBundle(null);
          return;
        }
        setError(null);
        setBundle(parsed);
        setSel(Object.fromEntries(parsed.sections.map((s) => [s, true])));
      } catch {
        setError('Couldn’t read that file (invalid JSON).');
        setBundle(null);
      }
    };
    reader.readAsText(file);
  };

  const apply = async () => {
    if (!bundle) return;
    const chosen = bundle.sections.filter((s) => sel[s]);
    if (!chosen.length) return;
    if (
      mode === 'replace' &&
      !window.confirm('Replace will overwrite the selected data with this backup. Continue?')
    ) {
      return;
    }
    await repo.importBundle(bundle, chosen, mode);
    setBundle(null);
    setStatus('Imported ✓');
    if (fileRef.current) fileRef.current.value = '';
  };

  const summary = bundle ? summarizeBundle(bundle) : null;

  return (
    <Section title="Import" desc="Restore from a backup file. Choose what to bring in and how.">
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <div className="flex items-center gap-2">
        <Button onClick={() => fileRef.current?.click()}>Choose backup file…</Button>
        {status && <span className="text-xs text-emerald-600">{status}</span>}
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {summary && bundle && (
        <div className="mt-3 rounded-xl border border-slate-200 p-3">
          <p className="text-xs text-slate-500">
            From {summary.userEmail || 'unknown'} · {formatTs(summary.exportedAt)} · v{summary.appVersion}
          </p>
          <div className="mt-2 space-y-1.5">
            {summary.sections.map((s) => (
              <label key={s.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="text-sm text-slate-700">{s.label}</span>
                  <span className="ml-1 text-[11px] text-slate-400">{s.detail}</span>
                </span>
                <Toggle
                  checked={!!sel[s.id]}
                  onChange={(v) => setSel((prev) => ({ ...prev, [s.id]: v }))}
                  label={s.label}
                />
              </label>
            ))}
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-slate-500">How to apply</label>
            <Segmented<ImportMode>
              value={mode}
              onChange={setMode}
              options={[
                { value: 'replace', label: 'Replace' },
                { value: 'merge', label: 'Merge' },
              ]}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              {mode === 'replace'
                ? 'Overwrites the selected data with the backup.'
                : 'Adds missing items from the backup; never deletes. Preferences still overwrite.'}
            </p>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button onClick={() => setBundle(null)}>Cancel</Button>
            <Button variant="primary" onClick={apply}>
              Import
            </Button>
          </div>
        </div>
      )}

      <p className="mt-2 text-[11px] text-slate-400">Last imported: {formatTs(lastImportAt)}</p>
    </Section>
  );
}
