import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Project, Task, TaskStatus } from '@/data/types';
import { inputClass } from '@/components/ui';
import { SortableTaskCard } from './TaskCard';

const HEADER: Record<TaskStatus, { title: string; dot: string }> = {
  todo: { title: 'To Do', dot: 'bg-slate-400' },
  doing: { title: 'Doing', dot: 'bg-blue-500' },
  done: { title: 'Done', dot: 'bg-emerald-500' },
};

export function Column({
  status,
  tasks,
  projectsById,
  onAdd,
  onEdit,
  onToggleDone,
  onDelete,
}: {
  status: TaskStatus;
  tasks: Task[];
  projectsById: Record<string, Project>;
  onAdd?: (title: string) => void;
  onEdit: (t: Task) => void;
  onToggleDone: (t: Task) => void;
  onDelete: (t: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const [draft, setDraft] = useState('');
  const meta = HEADER[status];

  const submit = () => {
    const v = draft.trim();
    if (v && onAdd) {
      onAdd(v);
      setDraft('');
    }
  };

  return (
    <section className="mb-3">
      <div className="mb-1.5 flex items-center gap-2 px-1">
        <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{meta.title}</h3>
        <span className="text-xs text-slate-400">{tasks.length}</span>
      </div>

      <div
        ref={setNodeRef}
        className={`min-h-[12px] space-y-2 rounded-xl p-1 transition ${
          isOver ? 'bg-violet-50 ring-1 ring-violet-200' : ''
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <SortableTaskCard
              key={t.id}
              task={t}
              project={t.projectId ? projectsById[t.projectId] : undefined}
              onEdit={() => onEdit(t)}
              onToggleDone={() => onToggleDone(t)}
              onDelete={() => onDelete(t)}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && <p className="px-2 py-3 text-center text-xs text-slate-300">Drop tasks here</p>}
      </div>

      {onAdd && (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder="+ Add a task, press Enter"
          className={`${inputClass} mt-1.5`}
        />
      )}
    </section>
  );
}
