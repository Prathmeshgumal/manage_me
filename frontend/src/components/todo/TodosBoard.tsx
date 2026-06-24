import { useState } from "react";
import {
  DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import {
  useTodoLists, useCreateList, useUpdateList, useDeleteList, useCreateTodo, useUpdateTodo,
} from "@/hooks/useTodos";
import { TodoListColumn } from "./TodoListColumn";
import { TodoRowView } from "./TodoRow";
import { TodoDetailPanel } from "./TodoDetailPanel";
import type { TodoItem } from "@/types";

export function TodosBoard() {
  const { data: lists = [] } = useTodoLists();
  const createList = useCreateList();
  const updateList = useUpdateList();
  const deleteList = useDeleteList();
  const createTodo = useCreateTodo();
  const updateTodo = useUpdateTodo();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<TodoItem | null>(null);

  // Only incomplete items participate in drag (completed ones live in a separate section).
  const allActive = lists.flatMap((l) => l.items.filter((i) => !i.completed));
  const activeItem = activeId ? allActive.find((i) => i.id === activeId) ?? null : null;

  const listOfItem = (id: string) => lists.find((l) => l.items.some((i) => i.id === id));

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const draggedId = String(e.active.id);
    if (!e.over) return;
    const overId = String(e.over.id);
    if (draggedId === overId) return;

    const sourceList = listOfItem(draggedId);
    if (!sourceList) return;
    // `over` is either another item or an empty column droppable (id === list id).
    const overItemList = listOfItem(overId);
    const targetList = overItemList ?? lists.find((l) => l.id === overId);
    if (!targetList) return;

    const targetActive = targetList.items.filter((i) => !i.completed);
    const ids = targetActive.map((i) => i.id);

    let ordered: string[];
    if (sourceList.id === targetList.id) {
      const oldIndex = ids.indexOf(draggedId);
      const newIndex = overItemList ? ids.indexOf(overId) : ids.length - 1;
      if (oldIndex === -1 || newIndex === -1) return;
      ordered = arrayMove(ids, oldIndex, newIndex);
    } else {
      const insertAt = overItemList ? ids.indexOf(overId) : ids.length;
      ordered = [...ids.slice(0, insertAt), draggedId, ...ids.slice(insertAt)];
    }

    const byId = new Map(allActive.map((i) => [i.id, i]));
    const pos = ordered.indexOf(draggedId);
    const prev = pos > 0 ? byId.get(ordered[pos - 1]) : undefined;
    const next = pos < ordered.length - 1 ? byId.get(ordered[pos + 1]) : undefined;
    const prevSort = prev?.sortOrder;
    const nextSort = next?.sortOrder;

    let sortOrder: number;
    if (prevSort === undefined && nextSort === undefined) sortOrder = 0;
    else if (prevSort === undefined) sortOrder = nextSort! - 1;
    else if (nextSort === undefined) sortOrder = prevSort + 1;
    else sortOrder = (prevSort + nextSort) / 2;

    const patch: { sortOrder: number; listId?: string } = { sortOrder };
    if (sourceList.id !== targetList.id) patch.listId = targetList.id;
    updateTodo.mutate({ id: draggedId, patch });
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex gap-4 items-start overflow-x-auto pb-2">
          {lists.map((list) => (
            <TodoListColumn
              key={list.id}
              list={list}
              onAddTask={(title) => createTodo.mutate({ listId: list.id, input: { title } })}
              onToggle={(item) => updateTodo.mutate({ id: item.id, patch: { completed: !item.completed } })}
              onOpenItem={(item) => setOpenItem(item)}
              onRename={() => {
                const name = window.prompt("Rename list", list.name);
                if (name && name.trim()) updateList.mutate({ id: list.id, patch: { name: name.trim() } });
              }}
              onDelete={() => {
                if (window.confirm(`Delete list "${list.name}" and all its tasks?`)) deleteList.mutate(list.id);
              }}
            />
          ))}

          <button
            onClick={() => createList.mutate({ name: "New list" })}
            className="w-72 shrink-0 flex items-center justify-center gap-1 py-3 text-sm text-ink-muted hover:text-ink border border-dashed border-border rounded-lg hover:bg-bg"
          >
            <Plus className="size-4" /> Create new list
          </button>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <TodoRowView item={activeItem} className="w-64 bg-surface border border-border shadow-xl cursor-grabbing" />
          ) : null}
        </DragOverlay>
      </DndContext>

      <TodoDetailPanel open={!!openItem} onOpenChange={(o) => !o && setOpenItem(null)} item={openItem} />
    </>
  );
}
