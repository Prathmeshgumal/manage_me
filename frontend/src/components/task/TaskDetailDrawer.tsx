import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Task, Status, Priority, UpdateTaskInput } from "@/types";
import { statusMeta, priorityMeta, STATUS_ORDER, PRIORITY_ORDER } from "@/lib/priority";
import { useUpdateTask, useDeleteTask } from "@/hooks/useTasks";

export function TaskDetailDrawer({ task, open, onOpenChange }: {
  task: Task | null; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const update = useUpdateTask();
  const del = useDeleteTask();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  useEffect(() => {
    if (task) { setTitle(task.title); setDescription(task.description ?? ""); }
  }, [task]);
  if (!task) return null;

  const save = (patch: UpdateTaskInput) => update.mutate({ id: task.id, patch });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:max-w-none flex flex-col gap-4">
        <SheetHeader className="p-0">
          <SheetTitle className="font-mono text-xs text-ink-muted">{task.id.slice(0, 6)}</SheetTitle>
        </SheetHeader>
        <Input
          className="font-display text-lg"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && save({ title: title.trim() })}
        />
        <div className="grid grid-cols-2 gap-3">
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
        </div>
        <Textarea
          className="min-h-40 font-mono text-sm"
          placeholder="Description (markdown)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => save({ description: description || null })}
        />
        <Button
          variant="destructive"
          className="mt-auto"
          onClick={() => del.mutate(task.id, { onSuccess: () => onOpenChange(false) })}
        >
          Delete task
        </Button>
      </SheetContent>
    </Sheet>
  );
}
