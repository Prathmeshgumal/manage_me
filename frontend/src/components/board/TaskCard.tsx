import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "@/types";
import { priorityMeta } from "@/lib/priority";
import { dueDateDisplay } from "@/lib/dueDate";
import { cn } from "@/lib/utils";

/** Pure visual card — reused by the sortable card and the drag overlay. */
export function TaskCardView({ task, className }: { task: Task; className?: string }) {
  const meta = priorityMeta[task.priority];
  return (
    <div className={cn("relative bg-surface border border-border rounded-lg p-3 pl-4", className)}>
      <span
        className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${task.priority === "URGENT" ? "animate-spine" : ""}`}
        style={{ background: meta.color }}
        aria-hidden
      />
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] text-ink-muted">{task.id.slice(0, 6)}</span>
        <span className="font-mono text-[11px]" style={{ color: meta.color }} title={meta.label}>
          {meta.glyph}
        </span>
      </div>
      <p className="text-sm mt-1 leading-snug">{task.title}</p>
      <div className="flex items-center gap-2 mt-2">
        {task.dueDate && (() => {
          const due = dueDateDisplay(task.dueDate);
          return <span className="font-mono text-[11px]" style={{ color: due.color }}>{due.text}</span>;
        })()}
        {task.labels.map((l) => (
          <span key={l.id} className="size-2 rounded-sm" style={{ background: l.color }} title={l.name} />
        ))}
      </div>
    </div>
  );
}

export function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    // The dragged card is represented by the DragOverlay; leave a faint placeholder behind.
    opacity: isDragging ? 0.3 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={onClick}>
      <TaskCardView task={task} className="cursor-grab active:cursor-grabbing hover:border-ink/40" />
    </div>
  );
}
