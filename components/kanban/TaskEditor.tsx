import { useState } from 'react';
import type { ID, Priority, Project, Task } from '@/data/types';
import { Button, Modal, Segmented, inputClass } from '@/components/ui';
import { dateInputValue, parseDateInput } from '@/lib/time';

export interface TaskDraft {
  title: string;
  notes: string;
  priority: Priority;
  projectId: ID | null;
  dueDate?: number;
}

export function TaskEditor({
  task,
  projects,
  defaultProjectId,
  onSave,
  onDelete,
  onClose,
}: {
  task: Task | null;
  projects: Project[];
  defaultProjectId: ID | null;
  onSave: (draft: TaskDraft) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'med');
  const [projectId, setProjectId] = useState<ID | null>(task?.projectId ?? defaultProjectId);
  const [due, setDue] = useState(dateInputValue(task?.dueDate));

  const save = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), notes: notes.trim(), priority, projectId, dueDate: parseDateInput(due) });
  };

  return (
    <Modal
      title={task ? 'Edit task' : 'New task'}
      onClose={onClose}
      footer={
        <>
          {onDelete && (
            <Button variant="danger" onClick={onDelete}>
              Delete
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            {task ? 'Save' : 'Add task'}
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
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Due date</label>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputClass} />
        </div>
      </div>
    </Modal>
  );
}
