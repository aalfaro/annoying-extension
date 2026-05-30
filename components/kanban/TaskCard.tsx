import { forwardRef, type CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Project, Task } from '@/data/types';
import { PriorityPill } from '@/components/ui';
import { formatDue, isOverdue } from '@/lib/time';

interface ViewProps {
  task: Task;
  project?: Project;
  dragging?: boolean;
  overlay?: boolean;
  onEdit?: () => void;
  onToggleDone?: () => void;
  onDelete?: () => void;
  style?: CSSProperties;
  listeners?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
}

/** Presentational card. Used both inside the sortable list and in the DragOverlay. */
export const TaskCardView = forwardRef<HTMLDivElement, ViewProps>(function TaskCardView(
  { task, project, dragging, overlay, onEdit, onToggleDone, onDelete, style, listeners, attributes },
  ref,
) {
  const due = formatDue(task.dueDate);
  const overdue = isOverdue(task.dueDate) && task.status !== 'done';
  const done = task.status === 'done';

  return (
    <div
      ref={ref}
      style={style}
      className={`group relative rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm transition ${
        dragging ? 'opacity-40' : ''
      } ${overlay ? 'rotate-2 shadow-lg' : ''}`}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={onToggleDone}
          aria-label={done ? 'Mark not done' : 'Mark done'}
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition ${
            done ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 hover:border-violet-400'
          }`}
        >
          {done && <span className="text-[9px] leading-none text-white">✓</span>}
        </button>

        <div className="min-w-0 flex-1 cursor-grab active:cursor-grabbing" {...listeners} {...attributes}>
          <p className={`break-words text-sm font-medium ${done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
            {task.title}
          </p>
          {task.notes && <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{task.notes}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <PriorityPill priority={task.priority} />
            {task.templateId && (
              <span className="text-[11px] leading-none text-violet-500" title="Repeating task">
                ↻
              </span>
            )}
            {project && (
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project.color }} />
                {project.name}
              </span>
            )}
            {due && (
              <span className={`text-[10px] font-medium ${overdue ? 'text-red-500' : 'text-slate-400'}`}>
                📅 {due}
              </span>
            )}
          </div>
        </div>
      </div>

      {!overlay && (
        <div className="absolute right-1.5 top-1.5 flex gap-0.5 opacity-0 transition group-hover:opacity-100">
          <button onClick={onEdit} className="rounded p-1 text-xs hover:bg-slate-100" aria-label="Edit task">
            ✏️
          </button>
          <button onClick={onDelete} className="rounded p-1 text-xs hover:bg-red-50" aria-label="Delete task">
            🗑️
          </button>
        </div>
      )}
    </div>
  );
});

interface SortableProps {
  task: Task;
  project?: Project;
  onEdit: () => void;
  onToggleDone: () => void;
  onDelete: () => void;
}

export function SortableTaskCard(props: SortableProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.task.id,
  });
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition };
  return (
    <TaskCardView
      ref={setNodeRef}
      style={style}
      listeners={listeners as unknown as Record<string, unknown>}
      attributes={attributes as unknown as Record<string, unknown>}
      dragging={isDragging}
      {...props}
    />
  );
}
