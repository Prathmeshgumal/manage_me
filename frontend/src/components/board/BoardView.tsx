import {
  DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useState } from "react";
import type { Task, Status, Priority, TaskFilter, UpdateTaskInput } from "@/types";
import { useTasks, useUpdateTask } from "@/hooks/useTasks";
import { STATUS_ORDER, PRIORITY_ORDER, statusMeta, priorityMeta } from "@/lib/priority";
import {
  DUE_BUCKET_ORDER, dueBucketMeta, dueBucket, bucketAnchorDate, type DueBucket,
} from "@/lib/dueDate";
import { Column } from "./Column";
import { TaskCardView } from "./TaskCard";
import type { GroupBy } from "@/components/layout/Topbar";

export type CreateDefaults = { status?: Status; priority?: Priority; dueDate?: string };

export function BoardView({ groupBy, projectId, dueFilter, onOpenTask, onCreateInColumn }: {
  groupBy: GroupBy; projectId: string | null; dueFilter: DueBucket | "ALL";
  onOpenTask: (t: Task) => void; onCreateInColumn: (defaults: CreateDefaults) => void;
}) {
  const filter: TaskFilter | undefined = projectId ? { projectId } : undefined;
  const { data: allTasks = [] } = useTasks(filter);
  const tasks = dueFilter === "ALL" ? allTasks : allTasks.filter((t) => dueBucket(t.dueDate) === dueFilter);
  const update = useUpdateTask();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  const groups: string[] =
    groupBy === "status" ? STATUS_ORDER : groupBy === "priority" ? PRIORITY_ORDER : DUE_BUCKET_ORDER;

  const groupValue = (t: Task): string =>
    groupBy === "status" ? t.status : groupBy === "priority" ? t.priority : dueBucket(t.dueDate);

  const colInfo = (key: string) =>
    groupBy === "status"
      ? { title: statusMeta[key as Status].label, accent: "var(--border)" }
      : groupBy === "priority"
        ? { title: priorityMeta[key as Priority].label, accent: priorityMeta[key as Priority].color }
        : { title: dueBucketMeta[key as DueBucket].label, accent: dueBucketMeta[key as DueBucket].accent };

  const patchForGroup = (key: string): UpdateTaskInput =>
    groupBy === "status" ? { status: key as Status }
      : groupBy === "priority" ? { priority: key as Priority }
        : { dueDate: bucketAnchorDate(key as DueBucket) };

  const createDefaultsForGroup = (key: string): CreateDefaults =>
    groupBy === "status" ? { status: key as Status }
      : groupBy === "priority" ? { priority: key as Priority }
        : { dueDate: bucketAnchorDate(key as DueBucket) ?? undefined };

  const byGroup = (key: string) =>
    tasks.filter((t) => groupValue(t) === key).sort((a, b) => a.sortOrder - b.sortOrder);

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const draggedId = String(e.active.id);
    const active = tasks.find((t) => t.id === draggedId);
    if (!active || !e.over) return;
    const overId = String(e.over.id);
    if (draggedId === overId) return;

    const overTask = tasks.find((t) => t.id === overId);
    const targetGroup = overTask ? groupValue(overTask) : overId;
    const sourceGroup = groupValue(active);

    // Ordered ids currently in the target column (includes active iff same group).
    const ids = byGroup(targetGroup).map((t) => t.id);

    let ordered: string[];
    if (sourceGroup === targetGroup) {
      const oldIndex = ids.indexOf(draggedId);
      const newIndex = overTask ? ids.indexOf(overId) : ids.length - 1;
      if (oldIndex === -1 || newIndex === -1) return;
      ordered = arrayMove(ids, oldIndex, newIndex);
    } else {
      const insertAt = overTask ? ids.indexOf(overId) : ids.length;
      ordered = [...ids.slice(0, insertAt), draggedId, ...ids.slice(insertAt)];
    }

    // New sortOrder = midpoint of the active card's neighbors in the resulting order.
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const pos = ordered.indexOf(draggedId);
    const prevSort = pos > 0 ? byId.get(ordered[pos - 1])!.sortOrder : undefined;
    const nextSort = pos < ordered.length - 1 ? byId.get(ordered[pos + 1])!.sortOrder : undefined;

    let sortOrder: number;
    if (prevSort === undefined && nextSort === undefined) sortOrder = 0;
    else if (prevSort === undefined) sortOrder = nextSort! - 1;
    else if (nextSort === undefined) sortOrder = prevSort + 1;
    else sortOrder = (prevSort + nextSort) / 2;

    update.mutate({ id: draggedId, patch: { ...patchForGroup(targetGroup), sortOrder } });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-4 h-full">
        {groups.map((key) => {
          const info = colInfo(key);
          return (
            <Column
              key={key}
              id={key}
              title={info.title}
              accent={info.accent}
              tasks={byGroup(key)}
              onOpenTask={onOpenTask}
              onAddTask={() => onCreateInColumn(createDefaultsForGroup(key))}
            />
          );
        })}
      </div>
      <DragOverlay>
        {activeTask ? (
          <TaskCardView task={activeTask} className="w-72 shadow-xl rotate-2 cursor-grabbing" />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
