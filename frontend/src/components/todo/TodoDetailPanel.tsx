import { useEffect, useState } from "react";
import { Star, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { useUpdateTodo, useDeleteTodo } from "@/hooks/useTodos";
import { cn } from "@/lib/utils";
import type { TodoItem } from "@/types";

export function TodoDetailPanel({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: TodoItem | null;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [starred, setStarred] = useState(false);

  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();

  // The panel stays mounted and is reused; reset the form whenever it opens.
  useEffect(() => {
    if (!open || !item) return;
    setTitle(item.title);
    setNotes(item.notes ?? "");
    setDueDate(item.dueDate ? new Date(item.dueDate).toISOString().split("T")[0] : "");
    setStarred(item.starred);
  }, [open, item]);

  if (!item) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await updateTodo.mutateAsync({
      id: item.id,
      patch: {
        title: title.trim(),
        notes: notes.trim() || null,
        dueDate: dueDate || null,
        starred,
      },
    });
    onOpenChange(false);
  };

  const handleDelete = async () => {
    await deleteTodo.mutateAsync({ id: item.id });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Task details</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSave} className="flex flex-col gap-4 mt-4">
          <div>
            <label className="text-xs text-ink-muted mb-1 block">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task" autoFocus />
          </div>

          <div>
            <label className="text-xs text-ink-muted mb-1 block">Notes</label>
            <MarkdownEditor
              key={item.id}
              value={notes}
              onChange={setNotes}
              minHeight="min-h-32"
              placeholder="Add details…"
            />
          </div>

          <div>
            <label className="text-xs text-ink-muted mb-1 block">Due date</label>
            <DatePicker value={dueDate || null} onChange={(v) => setDueDate(v ?? "")} placeholder="Pick a date" />
          </div>

          <button
            type="button"
            onClick={() => setStarred((s) => !s)}
            className={cn(
              "flex items-center gap-2 text-sm w-fit px-2 py-1 rounded-md hover:bg-bg",
              starred ? "text-amber-400" : "text-ink-muted hover:text-ink",
            )}
          >
            <Star className={cn("size-4", starred && "fill-current")} />
            {starred ? "Starred" : "Star"}
          </button>

          <div className="flex justify-between items-center mt-4">
            <Button type="button" variant="ghost" onClick={handleDelete} className="text-red-500 hover:text-red-500">
              <Trash2 className="size-4 mr-1" /> Delete
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!title.trim() || updateTodo.isPending}>
                Save
              </Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
