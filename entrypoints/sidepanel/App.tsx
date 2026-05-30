import { useState } from 'react';
import { repo } from '@/data';
import { useSettings, useTasks } from '@/state/hooks';
import { Segmented, Toggle } from '@/components/ui';
import { Board } from '@/components/kanban/Board';
import { SettingsPanel } from '@/components/settings/SettingsPanel';

type Tab = 'board' | 'settings';

export default function App() {
  const [tab, setTab] = useState<Tab>('board');
  const settings = useSettings();
  const tasks = useTasks();
  const openCount = tasks.filter((t) => t.status !== 'done').length;

  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-900">
      <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-sm font-extrabold text-white">
          !
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold leading-tight text-slate-800">Annoying-extension</h1>
          <p className="truncate text-[11px] leading-tight text-slate-400">
            {openCount} open · don’t make me come find you
          </p>
        </div>
        {settings && (
          <div className="flex items-center gap-1.5" title={settings.enabled ? 'Nagging is on' : 'Nagging is off'}>
            <span className="text-[11px] font-medium text-slate-400">{settings.enabled ? 'On' : 'Off'}</span>
            <Toggle
              checked={settings.enabled}
              onChange={(v) => void repo.updateSettings({ enabled: v })}
              label="Toggle nagging"
            />
          </div>
        )}
      </header>

      <div className="border-b border-slate-200 bg-white px-3 py-2">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'board', label: 'Board' },
            { value: 'settings', label: 'Settings' },
          ]}
        />
      </div>

      <main className="relative flex-1 overflow-hidden">
        {tab === 'board' ? <Board /> : <SettingsPanel />}
      </main>
    </div>
  );
}
