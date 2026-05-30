import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { repo } from '@/data';
import type { ID, Project, Task, TaskStatus } from '@/data/types';
import { useProjects, useTasks } from '@/state/hooks';
import { Button, ColorPicker, Modal, PROJECT_COLORS, inputClass } from '@/components/ui';
import { Column } from './Column';
import { TaskCardView } from './TaskCard';
import { TaskEditor, type TaskDraft } from './TaskEditor';

const STATUSES: TaskStatus[] = ['todo', 'doing', 'done'];
type BoardState = Record<TaskStatus, Task[]>;

function buildBoard(tasks: Task[]): BoardState {
  const b: BoardState = { todo: [], doing: [], done: [] };
  for (const t of tasks) b[t.status].push(t);
  for (const s of STATUSES) b[s].sort((a, z) => a.order - z.order);
  return b;
}

export function Board() {
  const tasks = useTasks();
  const projects = useProjects();
  const projectsById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])) as Record<string, Project>,
    [projects],
  );

  const [selected, setSelected] = useState<'all' | ID>('all');
  const visibleTasks = useMemo(
    () => (selected === 'all' ? tasks : tasks.filter((t) => t.projectId === selected)),
    [tasks, selected],
  );

  const [board, setBoard] = useState<BoardState>(() => buildBoard(visibleTasks));
  const [activeId, setActiveId] = useState<string | null>(null);
  const draggingRef = useRef(false);

  // Re-sync board from storage when data/filter changes — but never while dragging.
  useEffect(() => {
    if (!draggingRef.current) setBoard(buildBoard(visibleTasks));
  }, [visibleTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findContainer = (id: string): TaskStatus | null => {
    if ((STATUSES as string[]).includes(id)) return id as TaskStatus;
    return STATUSES.find((s) => board[s].some((t) => t.id === id)) ?? null;
  };

  const activeTask = activeId
    ? STATUSES.flatMap((s) => board[s]).find((t) => t.id === activeId) ?? null
    : null;

  const onDragStart = (e: DragStartEvent) => {
    draggingRef.current = true;
    setActiveId(String(e.active.id));
  };

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const aId = String(active.id);
    const oId = String(over.id);
    const from = findContainer(aId);
    const to = findContainer(oId);
    if (!from || !to || from === to) return;
    setBoard((prev) => {
      const moving = prev[from].find((t) => t.id === aId);
      if (!moving) return prev;
      const overIndex = prev[to].findIndex((t) => t.id === oId);
      const insertAt = overIndex >= 0 ? overIndex : prev[to].length;
      return {
        ...prev,
        [from]: prev[from].filter((t) => t.id !== aId),
        [to]: [...prev[to].slice(0, insertAt), moving, ...prev[to].slice(insertAt)],
      };
    });
  };

  const finishDrag = () => {
    draggingRef.current = false;
    setActiveId(null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    const aId = String(active.id);
    const from = findContainer(aId);
    if (!over || !from) return finishDrag();
    const to = findContainer(String(over.id));
    if (!to) return finishDrag();

    let finalBoard = board;
    if (from === to) {
      const items = board[to];
      const oldIndex = items.findIndex((t) => t.id === aId);
      let newIndex = items.findIndex((t) => t.id === String(over.id));
      if (newIndex < 0) newIndex = items.length - 1;
      if (oldIndex !== newIndex && oldIndex >= 0) {
        finalBoard = { ...board, [to]: arrayMove(items, oldIndex, newIndex) };
        setBoard(finalBoard);
      }
    }
    const finalIndex = Math.max(0, finalBoard[to].findIndex((t) => t.id === aId));
    finishDrag();
    void repo.moveTask(aId, to, finalIndex);
  };

  // ---- editors ----
  const [editor, setEditor] = useState<{ mode: 'new' | 'edit'; task?: Task } | null>(null);
  const [addingProject, setAddingProject] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const defaultProjectId: ID | null = selected === 'all' ? null : selected;

  const saveTask = async (draft: TaskDraft) => {
    const { daysOfWeek, ...rest } = draft;
    if (editor?.mode === 'edit' && editor.task) {
      await repo.updateTask(editor.task.id, rest);
    } else if (daysOfWeek.length > 0) {
      // Recurrence selected → create a repeating rule and materialize today's instance.
      await repo.createRecurring({
        title: rest.title,
        notes: rest.notes,
        priority: rest.priority,
        projectId: rest.projectId,
        daysOfWeek,
      });
      await repo.generateRecurringInstances();
    } else {
      await repo.createTask(rest);
    }
    setEditor(null);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Project filter bar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-3 py-2">
        <ProjectChip label="All" active={selected === 'all'} onClick={() => setSelected('all')} />
        {projects.map((p) => (
          <ProjectChip
            key={p.id}
            label={p.name}
            color={p.color}
            active={selected === p.id}
            onClick={() => setSelected(p.id)}
          />
        ))}
        <button
          onClick={() => setAddingProject(true)}
          className="rounded-full px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          + New
        </button>
        {selected !== 'all' && projectsById[selected] && (
          <button
            onClick={() => setEditingProject(projectsById[selected])}
            className="ml-auto rounded-full p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Edit project"
          >
            ⚙️
          </button>
        )}
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={finishDrag}
        >
          {STATUSES.map((s) => (
            <Column
              key={s}
              status={s}
              tasks={board[s]}
              projectsById={projectsById}
              onAdd={
                s === 'todo'
                  ? (title) => void repo.createTask({ title, projectId: defaultProjectId, status: 'todo' })
                  : undefined
              }
              onEdit={(t) => setEditor({ mode: 'edit', task: t })}
              onToggleDone={(t) =>
                void repo.updateTask(t.id, { status: t.status === 'done' ? 'todo' : 'done' })
              }
              onDelete={(t) => void repo.deleteTask(t.id)}
            />
          ))}
          <DragOverlay>
            {activeTask && (
              <TaskCardView
                task={activeTask}
                project={activeTask.projectId ? projectsById[activeTask.projectId] : undefined}
                overlay
              />
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* New task button */}
      <button
        onClick={() => setEditor({ mode: 'new' })}
        className="fixed bottom-4 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-2xl leading-none text-white shadow-lg transition hover:bg-violet-700"
        aria-label="New task"
      >
        ＋
      </button>

      {editor && (
        <TaskEditor
          task={editor.mode === 'edit' ? editor.task ?? null : null}
          projects={projects}
          defaultProjectId={defaultProjectId}
          allowRecurrence={editor.mode === 'new'}
          onSave={saveTask}
          onDelete={
            editor.mode === 'edit' && editor.task
              ? async () => {
                  await repo.deleteTask(editor.task!.id);
                  setEditor(null);
                }
              : undefined
          }
          onClose={() => setEditor(null)}
        />
      )}

      {addingProject && (
        <ProjectCreate
          onClose={() => setAddingProject(false)}
          onCreate={async (name, color) => {
            const p = await repo.createProject({ name, color });
            setAddingProject(false);
            setSelected(p.id);
          }}
        />
      )}

      {editingProject && (
        <ProjectEditModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onSave={async (patch) => {
            await repo.updateProject(editingProject.id, patch);
            setEditingProject(null);
          }}
          onDelete={async () => {
            await repo.deleteProject(editingProject.id);
            setEditingProject(null);
            setSelected('all');
          }}
        />
      )}
    </div>
  );
}

function ProjectChip({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition ${
        active ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'
      }`}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
      {label}
    </button>
  );
}

function ProjectCreate({
  onCreate,
  onClose,
}: {
  onCreate: (name: string, color: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const submit = () => name.trim() && onCreate(name.trim(), color);
  return (
    <Modal
      title="New project"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Project name"
          className={inputClass}
        />
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Color</label>
          <ColorPicker value={color} onChange={setColor} />
        </div>
      </div>
    </Modal>
  );
}

function ProjectEditModal({
  project,
  onSave,
  onDelete,
  onClose,
}: {
  project: Project;
  onSave: (patch: { name: string; color: string }) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [color, setColor] = useState(project.color);
  return (
    <Modal
      title="Edit project"
      onClose={onClose}
      footer={
        <>
          <Button variant="danger" onClick={onDelete}>
            Delete
          </Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => name.trim() && onSave({ name: name.trim(), color })}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Color</label>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <p className="text-xs text-slate-400">Deleting a project keeps its tasks (moves them to Inbox).</p>
      </div>
    </Modal>
  );
}
