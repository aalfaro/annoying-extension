import { useMemo, useState } from 'react';
import { repo } from '@/data';
import type { Project, RecurringTask } from '@/data/types';
import { useProjects, useRecurring } from '@/state/hooks';
import { Button, PriorityPill, Toggle } from '@/components/ui';
import { TaskEditor, type TaskDraft } from '@/components/kanban/TaskEditor';
import { describeDays } from '@/lib/recurrence';

export function RecurringPanel() {
  const templates = useRecurring();
  const projects = useProjects();
  const projectsById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])) as Record<string, Project>,
    [projects],
  );
  const [editor, setEditor] = useState<{ mode: 'new' | 'edit'; tpl?: RecurringTask } | null>(null);

  const save = async (draft: TaskDraft) => {
    const payload = {
      title: draft.title,
      notes: draft.notes,
      priority: draft.priority,
      projectId: draft.projectId,
      daysOfWeek: draft.daysOfWeek,
    };
    if (editor?.mode === 'edit' && editor.tpl) await repo.updateRecurring(editor.tpl.id, payload);
    else await repo.createRecurring(payload);
    await repo.generateRecurringInstances();
    setEditor(null);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-xs text-slate-400">
          Repeating tasks add themselves to your board on the days you pick — and keep nagging until done.
        </p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3 pb-24">
        {templates.length === 0 && (
          <div className="px-2 py-12 text-center text-sm text-slate-400">
            No repeating tasks yet.
            <br />
            Add one to get nagged on a schedule.
          </div>
        )}
        {templates.map((t) => {
          const project = t.projectId ? projectsById[t.projectId] : undefined;
          return (
            <div
              key={t.id}
              className={`rounded-xl border border-slate-200 bg-white p-3 ${t.active ? '' : 'opacity-60'}`}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium text-slate-800">{t.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                      ↻ {describeDays(t.daysOfWeek)}
                    </span>
                    <PriorityPill priority={t.priority} />
                    {project && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project.color }} />
                        {project.name}
                      </span>
                    )}
                  </div>
                </div>
                <Toggle
                  checked={t.active}
                  onChange={(v) => void repo.updateRecurring(t.id, { active: v })}
                  label="Active"
                />
              </div>
              <div className="mt-2 flex justify-end gap-1">
                <Button variant="ghost" onClick={() => setEditor({ mode: 'edit', tpl: t })}>
                  Edit
                </Button>
                <Button variant="ghost" onClick={() => void repo.deleteRecurring(t.id)}>
                  Delete
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setEditor({ mode: 'new' })}
        className="fixed bottom-4 right-4 z-30 flex h-12 items-center gap-1.5 rounded-full bg-violet-600 px-5 text-sm font-semibold text-white shadow-lg transition hover:bg-violet-700"
        aria-label="New repeating task"
      >
        ＋ Repeating
      </button>

      {editor && (
        <TaskEditor
          task={editor.tpl ?? null}
          isEdit={editor.mode === 'edit'}
          projects={projects}
          defaultProjectId={editor.tpl?.projectId ?? null}
          allowRecurrence
          requireDays
          initialDays={editor.tpl?.daysOfWeek ?? []}
          onSave={save}
          onDelete={
            editor.mode === 'edit' && editor.tpl
              ? async () => {
                  await repo.deleteRecurring(editor.tpl!.id);
                  setEditor(null);
                }
              : undefined
          }
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
