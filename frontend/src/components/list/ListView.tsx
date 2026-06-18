import { DndContext, closestCorners, PointerSensor, useSensor, useSensors, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task, Status, TaskFilter } from "@/types";
import { useTasks, useUpdateTask } from "@/hooks/useTasks";
import { priorityMeta, statusMeta, STATUS_ORDER } from "@/lib/priority";
import { dueBucket, dueDateDisplay, type DueBucket } from "@/lib/dueDate";

function Row({ task, onOpenTask }: { task: Task; onOpenTask: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const m = priorityMeta[task.priority];
  const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpenTask(task)}
      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface cursor-grab active:cursor-grabbing"
    >
      <span className="font-mono text-[11px]" style={{ color: m.color }} title={m.label}>{m.glyph}</span>
      <span className="font-mono text-[11px] text-ink-muted w-14">{task.id.slice(0, 6)}</span>
      <span className="text-sm flex-1">{task.title}</span>
      {task.labels.map((l) => (
        <span key={l.id} className="size-2 rounded-sm" style={{ background: l.color }} title={l.name} />
      ))}
      {task.dueDate && (() => {
        const due = dueDateDisplay(task.dueDate);
        return <span className="font-mono text-[11px]" style={{ color: due.color }}>{due.text}</span>;
      })()}
    </div>
  );
}

function StatusGroup({ status, rows, onOpenTask }: {
  status: Status; rows: Task[]; onOpenTask: (t: Task) => void;
}) {
  const { setNodeRef } = useDroppable({ id: status });
  return (
    <div className="mb-6">
      <div className="font-display text-sm font-semibold mb-2 text-ink-muted">
        {statusMeta[status].label} <span className="font-mono text-xs">{rows.length}</span>
      </div>
      <SortableContext items={rows.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="divide-y divide-border border border-border rounded-lg overflow-hidden min-h-10">
          {rows.length === 0 ? (
            <div className="px-3 py-2 text-xs text-ink-muted">Drop a task here</div>
          ) : (
            rows.map((t) => <Row key={t.id} task={t} onOpenTask={onOpenTask} />)
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function ListView({ projectId, dueFilter, onOpenTask }: {
  projectId: string | null; dueFilter: DueBucket | "ALL"; onOpenTask: (t: Task) => void;
}) {
  const filter: TaskFilter | undefined = projectId ? { projectId } : undefined;
  const { data: allTasks = [] } = useTasks(filter);
  const update = useUpdateTask();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const tasks = dueFilter === "ALL" ? allTasks : allTasks.filter((t) => dueBucket(t.dueDate) === dueFilter);

  const rowsFor = (status: Status) =>
    tasks.filter((t) => t.status === status).sort((a, b) => a.sortOrder - b.sortOrder);

  function onDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id);
    const active = tasks.find((t) => t.id === activeId);
    if (!active || !e.over) return;
    const overId = String(e.over.id);
    if (activeId === overId) return;

    const overTask = tasks.find((t) => t.id === overId);
    const targetStatus = (overTask ? overTask.status : overId) as Status;
    const ids = rowsFor(targetStatus).map((t) => t.id);

    let ordered: string[];
    if (active.status === targetStatus) {
      const oldIndex = ids.indexOf(activeId);
      const newIndex = overTask ? ids.indexOf(overId) : ids.length - 1;
      if (oldIndex === -1 || newIndex === -1) return;
      ordered = arrayMove(ids, oldIndex, newIndex);
    } else {
      const insertAt = overTask ? ids.indexOf(overId) : ids.length;
      ordered = [...ids.slice(0, insertAt), activeId, ...ids.slice(insertAt)];
    }

    const byId = new Map(tasks.map((t) => [t.id, t]));
    const pos = ordered.indexOf(activeId);
    const prevSort = pos > 0 ? byId.get(ordered[pos - 1])!.sortOrder : undefined;
    const nextSort = pos < ordered.length - 1 ? byId.get(ordered[pos + 1])!.sortOrder : undefined;

    let sortOrder: number;
    if (prevSort === undefined && nextSort === undefined) sortOrder = 0;
    else if (prevSort === undefined) sortOrder = nextSort! - 1;
    else if (nextSort === undefined) sortOrder = prevSort + 1;
    else sortOrder = (prevSort + nextSort) / 2;

    update.mutate({ id: activeId, patch: { status: targetStatus, sortOrder } });
  }

  return (
    <div className="max-w-4xl mx-auto">
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        {STATUS_ORDER.map((status) => (
          <StatusGroup key={status} status={status} rows={rowsFor(status)} onOpenTask={onOpenTask} />
        ))}
      </DndContext>
    </div>
  );
}
