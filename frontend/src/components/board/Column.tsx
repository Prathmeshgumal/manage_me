import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import type { Task } from "@/types";
import { TaskCard } from "./TaskCard";

export function Column({ id, title, accent, tasks, onOpenTask, onAddTask }: {
  id: string; title: string; accent: string; tasks: Task[];
  onOpenTask: (t: Task) => void; onAddTask: () => void;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div className="w-72 shrink-0 flex flex-col">
      <div className="flex items-center gap-2 mb-3 pb-1 border-b-2" style={{ borderColor: accent }}>
        <span className="font-display text-sm font-semibold">{title}</span>
        <span className="font-mono text-xs text-ink-muted">{tasks.length}</span>
        <button
          onClick={onAddTask}
          aria-label={`Add task to ${title}`}
          className="ml-auto text-ink-muted hover:text-ink rounded p-0.5 hover:bg-bg"
        >
          <Plus className="size-4" />
        </button>
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
