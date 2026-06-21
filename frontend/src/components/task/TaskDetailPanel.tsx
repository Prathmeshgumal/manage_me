import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Markdown } from "@/components/ui/markdown";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import type { Task, Status, Priority, UpdateTaskInput } from "@/types";
import { statusMeta, priorityMeta, STATUS_ORDER, PRIORITY_ORDER } from "@/lib/priority";
import { useUpdateTask, useDeleteTask } from "@/hooks/useTasks";
import { useProjects } from "@/hooks/useProjects";

export function TaskDetailPanel({ task, open, onOpenChange }: {
  task: Task | null; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const update = useUpdateTask();
  const del = useDeleteTask();
  const { data: projects = [] } = useProjects();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setEditingDesc(false);
    }
  }, [task]);
  if (!task) return null;

  const save = (patch: UpdateTaskInput) => update.mutate({ id: task.id, patch });
  const dueValue = task.dueDate ? task.dueDate.slice(0, 10) : "";

  function saveDescription() {
    save({ description: description.trim() || null });
    setEditingDesc(false);
  }
  function cancelEdit() {
    setDescription(task!.description ?? "");
    setEditingDesc(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-3xl rounded-t-2xl h-[90vh] overflow-y-auto flex flex-col gap-4"
      >
        <SheetHeader className="p-0">
          <SheetTitle className="font-mono text-xs text-ink-muted text-left">{task.id.slice(0, 6)}</SheetTitle>
        </SheetHeader>

        <Input
          className="font-display text-lg"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && save({ title: title.trim() })}
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Select value={task.status} onValueChange={(v) => save({ status: v as Status })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{statusMeta[s].label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={task.priority} onValueChange={(v) => save({ priority: v as Priority })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITY_ORDER.map((p) => <SelectItem key={p} value={p}>{priorityMeta[p].label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            value={task.projectId ?? "none"}
            onValueChange={(v) => save({ projectId: v === "none" ? null : v })}
          >
            <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No project</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <DatePicker value={dueValue || null} onChange={(v) => save({ dueDate: v })} />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wide text-ink-muted">Description</span>
            {!editingDesc && (
              <Button variant="ghost" size="sm" className="gap-1 h-7" onClick={() => setEditingDesc(true)}>
                <Pencil className="size-3.5" /> Edit
              </Button>
            )}
          </div>

          {editingDesc ? (
            <div className="flex flex-col gap-2">
              <MarkdownEditor autoFocus defaultMode="write" value={description} onChange={setDescription} />
              <div className="flex items-center gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={cancelEdit}>Cancel</Button>
                <Button size="sm" onClick={saveDescription}>Save</Button>
              </div>
            </div>
          ) : description.trim() ? (
            <div className="rounded-lg border border-border p-4">
              <Markdown>{description}</Markdown>
            </div>
          ) : (
            <button
              onClick={() => setEditingDesc(true)}
              className="text-left text-sm text-ink-muted rounded-lg border border-dashed border-border p-4 hover:text-ink hover:border-ink/40"
            >
              No description yet — click to add one.
            </button>
          )}
        </div>

        <div className="mt-auto border-t border-border pt-4 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-destructive hover:text-destructive"
            disabled={del.isPending}
            onClick={() => {
              if (!confirm("Delete this task? You can restore it from Settings → Trash.")) return;
              del.mutate(task.id, { onSuccess: () => onOpenChange(false) });
            }}
          >
            <Trash2 className="size-4" /> Delete task
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
