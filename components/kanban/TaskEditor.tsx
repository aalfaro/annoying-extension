import { useState } from 'react';
import type { ID, Priority, Project, Task } from '@/data/types';
import { Button, Modal, Segmented, inputClass } from '@/components/ui';
import { dateInputValue, parseDateInput } from '@/lib/time';
import { EVERY_DAY, WEEKDAYS, WEEKDAY_LABELS } from '@/lib/recurrence';

export interface TaskDraft {
  title: string;
  notes: string;
  priority: Priority;
  projectId: ID | null;
  dueDate?: number;
  daysOfWeek: number[];
}

export function TaskEditor({
  task,
  isEdit,
  projects,
  defaultProjectId,
  allowRecurrence = false,
  requireDays = false,
  initialDays = [],
  onSave,
  onDelete,
  onClose,
}: {
  task: Partial<Task> | null;
  isEdit?: boolean;
  projects: Project[];
  defaultProjectId: ID | null;
  allowRecurrence?: boolean;
  requireDays?: boolean; // template mode: needs >= 1 day, hides due date
  initialDays?: number[];
  onSave: (draft: TaskDraft) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const editing = isEdit ?? !!task;
  const noun = requireDays ? 'repeating task' : 'task';

  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'med');
  const [projectId, setProjectId] = useState<ID | null>(task?.projectId ?? defaultProjectId);
  const [due, setDue] = useState(dateInputValue(task?.dueDate));
  const [days, setDays] = useState<number[]>(initialDays);

  const toggleDay = (i: number) =>
    setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]));

  const valid = title.trim().length > 0 && (!requireDays || days.length > 0);

  const save = () => {
    if (!valid) return;
    onSave({
      title: title.trim(),
      notes: notes.trim(),
      priority,
      projectId,
      dueDate: parseDateInput(due),
      daysOfWeek: days,
    });
  };

  return (
    <Modal
      title={`${editing ? 'Edit' : 'New'} ${noun}`}
      onClose={onClose}
      footer={
        <>
          {onDelete && (
            <Button variant="danger" onClick={onDelete}>
              Delete
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!valid}>
            {editing ? 'Save' : `Add ${noun}`}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
          }}
          placeholder="What needs doing?"
          className={inputClass}
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          className={inputClass}
        />
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Priority</label>
          <Segmented
            value={priority}
            onChange={setPriority}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'med', label: 'Med' },
              { value: 'high', label: 'High' },
            ]}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Project</label>
          <select
            value={projectId ?? ''}
            onChange={(e) => setProjectId(e.target.value || null)}
            className={inputClass}
          >
            <option value="">Inbox (no project)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {allowRecurrence && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Repeat on{' '}
              {!requireDays && <span className="text-slate-300">· leave empty for a one-off</span>}
            </label>
            <div className="flex gap-1">
              {WEEKDAY_LABELS.map((label, i) => {
                const on = days.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    aria-pressed={on}
                    className={`h-8 w-8 rounded-full text-xs font-semibold transition ${
                      on ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex gap-2 text-xs">
              <button className="text-violet-600 hover:underline" onClick={() => setDays(EVERY_DAY)}>
                Every day
              </button>
              <button className="text-violet-600 hover:underline" onClick={() => setDays(WEEKDAYS)}>
                Weekdays
              </button>
              <button className="text-slate-400 hover:underline" onClick={() => setDays([])}>
                Clear
              </button>
            </div>
          </div>
        )}

        {!requireDays && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Due date</label>
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputClass} />
          </div>
        )}
      </div>
    </Modal>
  );
}
