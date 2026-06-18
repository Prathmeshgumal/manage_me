import { DndContext, closestCorners, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import type { Task, Status, Priority, TaskFilter, UpdateTaskInput } from "@/types";
import { useTasks, useUpdateTask } from "@/hooks/useTasks";
import { STATUS_ORDER, PRIORITY_ORDER, statusMeta, priorityMeta } from "@/lib/priority";
import {
  DUE_BUCKET_ORDER, dueBucketMeta, dueBucket, bucketAnchorDate, type DueBucket,
} from "@/lib/dueDate";
import { Column } from "./Column";
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
    const activeId = String(e.active.id);
    const task = tasks.find((t) => t.id === activeId);
    if (!task || !e.over) return;
    const overId = String(e.over.id);

    const overTask = tasks.find((t) => t.id === overId);
    const targetGroup = overTask ? groupValue(overTask) : overId;
    const column = byGroup(targetGroup).filter((t) => t.id !== activeId);

    const idx = overTask ? column.findIndex((t) => t.id === overTask.id) : column.length;
    const before = column[idx - 1]?.sortOrder ?? (column[0] ? column[0].sortOrder - 1 : 0);
    const after = column[idx]?.sortOrder ?? before + 2;
    const sortOrder = (before + after) / 2;

    update.mutate({ id: activeId, patch: { ...patchForGroup(targetGroup), sortOrder } });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
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
    </DndContext>
  );
}
