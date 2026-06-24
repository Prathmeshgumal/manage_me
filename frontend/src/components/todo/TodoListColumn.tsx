import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, MoreHorizontal, Trash2, Pencil, ChevronRight, ChevronDown } from "lucide-react";
import { TodoRow } from "./TodoRow";
import type { TodoListDetail, TodoItem } from "@/types";

export function TodoListColumn({
  list,
  onAddTask,
  onToggle,
  onOpenItem,
  onRename,
  onDelete,
}: {
  list: TodoListDetail;
  onAddTask: (title: string) => void;
  onToggle: (item: TodoItem) => void;
  onOpenItem: (item: TodoItem) => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const { setNodeRef } = useDroppable({ id: list.id });

  const active = list.items.filter((i) => !i.completed);
  const completed = list.items.filter((i) => i.completed);

  const submit = () => {
    const t = draft.trim();
    if (t) onAddTask(t);
    setDraft("");
    setAdding(false);
  };

  return (
    <div className="w-72 shrink-0 flex flex-col bg-surface border border-border rounded-lg">
      <div className="relative flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <span className="size-2.5 shrink-0 rounded-full" style={{ background: list.color }} />
        <span className="font-display text-sm font-semibold truncate flex-1">{list.name}</span>
        <span className="font-mono text-xs text-ink-muted shrink-0">{active.length}</span>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="List options"
          className="shrink-0 p-1 rounded hover:bg-bg text-ink-muted hover:text-ink"
        >
          <MoreHorizontal className="size-4" />
        </button>
        {menuOpen && (
          <div className="absolute top-11 right-2 bg-surface border border-border rounded-md shadow-lg z-10 py-1">
            <button
              onClick={() => { setMenuOpen(false); onRename(); }}
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-bg flex items-center gap-2"
            >
              <Pencil className="size-3" /> Rename list
            </button>
            <button
              onClick={() => { setMenuOpen(false); onDelete(); }}
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-bg text-red-500 flex items-center gap-2"
            >
              <Trash2 className="size-3" /> Delete list
            </button>
          </div>
        )}
      </div>

      <div className="px-2 pt-2">
        {adding ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") { setDraft(""); setAdding(false); }
            }}
            placeholder="Task title"
            className="w-full bg-bg border border-border rounded-md px-2 py-1.5 text-sm outline-none focus:border-ink/40"
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center gap-1 px-2 py-1.5 text-sm text-ink-muted hover:text-ink"
          >
            <Plus className="size-4" /> Add a task
          </button>
        )}
      </div>

      <SortableContext items={active.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex flex-col gap-0.5 p-2 min-h-16 max-h-[50vh] overflow-y-auto">
          {active.length === 0 ? (
            <p className="px-2 py-3 text-xs text-ink-muted">No tasks yet.</p>
          ) : (
            active.map((item) => (
              <TodoRow
                key={item.id}
                item={item}
                onToggle={() => onToggle(item)}
                onOpen={() => onOpenItem(item)}
              />
            ))
          )}
        </div>
      </SortableContext>

      {completed.length > 0 && (
        <div className="border-t border-border p-2">
          <button
            onClick={() => setShowCompleted((s) => !s)}
            className="w-full flex items-center gap-1 px-2 py-1 text-xs text-ink-muted hover:text-ink"
          >
            {showCompleted ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            Completed ({completed.length})
          </button>
          {showCompleted && (
            <div className="flex flex-col gap-0.5 mt-1">
              {completed.map((item) => (
                <TodoRow
                  key={item.id}
                  item={item}
                  onToggle={() => onToggle(item)}
                  onOpen={() => onOpenItem(item)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
