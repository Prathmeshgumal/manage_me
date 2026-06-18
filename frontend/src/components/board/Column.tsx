import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Task } from "@/types";
import { TaskCard } from "./TaskCard";

export function Column({ id, title, accent, tasks, onOpenTask }: {
  id: string; title: string; accent: string; tasks: Task[]; onOpenTask: (t: Task) => void;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div className="w-72 shrink-0 flex flex-col">
      <div className="flex items-center gap-2 mb-3 pb-1 border-b-2" style={{ borderColor: accent }}>
        <span className="font-display text-sm font-semibold">{title}</span>
        <span className="font-mono text-xs text-ink-muted">{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex flex-col gap-2 min-h-24">
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} onClick={() => onOpenTask(t)} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
