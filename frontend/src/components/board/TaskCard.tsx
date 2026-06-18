import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "@/types";
import { priorityMeta } from "@/lib/priority";

export function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const meta = priorityMeta[task.priority];
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="relative bg-surface border border-border rounded-lg p-3 pl-4 cursor-grab active:cursor-grabbing hover:border-ink/40"
    >
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
        {task.dueDate && (
          <span className="font-mono text-[11px] text-ink-muted">
            {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        )}
        {task.labels.map((l) => (
          <span key={l.id} className="size-2 rounded-sm" style={{ background: l.color }} title={l.name} />
        ))}
      </div>
    </div>
  );
}
