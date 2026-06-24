import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Circle, CheckCircle2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TodoItem } from "@/types";

/** Pure visual row — reused by the sortable row and the drag overlay. */
export function TodoRowView({ item, className }: { item: TodoItem; className?: string }) {
  return (
    <div className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-md", className)}>
      {item.completed ? (
        <CheckCircle2 className="size-4 shrink-0 text-ink-muted" />
      ) : (
        <Circle className="size-4 shrink-0 text-ink-muted" />
      )}
      <span className={cn("min-w-0 flex-1 truncate text-sm", item.completed && "line-through text-ink-muted")}>
        {item.title}
      </span>
      {item.starred && <Star className="size-3.5 shrink-0 text-amber-400 fill-current" />}
    </div>
  );
}

export function TodoRow({
  item,
  onToggle,
  onOpen,
}: {
  item: TodoItem;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="group flex items-center hover:bg-bg rounded-md">
      {/* Checkbox click toggles completion and must not start a drag or open the panel. */}
      <button
        type="button"
        aria-label={item.completed ? "Mark incomplete" : "Mark complete"}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="pl-2 py-1.5 text-ink-muted hover:text-ink"
      >
        {item.completed ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
      </button>
      {/* The label area is the drag handle and opens the detail panel on click. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={onOpen}
        className="min-w-0 flex-1 flex items-center gap-2 pr-2 py-1.5 text-left cursor-grab active:cursor-grabbing"
      >
        <span className={cn("min-w-0 flex-1 truncate text-sm", item.completed && "line-through text-ink-muted")}>
          {item.title}
        </span>
        {item.starred && <Star className="size-3.5 shrink-0 text-amber-400 fill-current" />}
      </button>
    </div>
  );
}
