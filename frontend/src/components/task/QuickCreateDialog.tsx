import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Status, Priority } from "@/types";
import { statusMeta, priorityMeta, STATUS_ORDER, PRIORITY_ORDER } from "@/lib/priority";
import { useCreateTask } from "@/hooks/useTasks";
import { useProjects } from "@/hooks/useProjects";

export function QuickCreateDialog({ open, onOpenChange, defaultProjectId, defaultStatus, defaultPriority, defaultDueDate }: {
  open: boolean; onOpenChange: (o: boolean) => void; defaultProjectId: string | null;
  defaultStatus?: Status; defaultPriority?: Priority; defaultDueDate?: string;
}) {
  const create = useCreateTask();
  const { data: projects = [] } = useProjects();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>("BACKLOG");
  const [priority, setPriority] = useState<Priority>("NONE");
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? "none");
  const [dueDate, setDueDate] = useState("");

  // Seed the form from the column / sidebar context each time the dialog opens.
  useEffect(() => {
    if (open) {
      setStatus(defaultStatus ?? "BACKLOG");
      setPriority(defaultPriority ?? "NONE");
      setProjectId(defaultProjectId ?? "none");
      setDueDate(defaultDueDate ?? "");
    }
  }, [open, defaultStatus, defaultPriority, defaultProjectId, defaultDueDate]);

  function submit() {
    if (!title.trim()) return;
    create.mutate(
      {
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        projectId: projectId === "none" ? null : projectId,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      { onSuccess: () => { setTitle(""); setDescription(""); setDueDate(""); onOpenChange(false); } },
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-3xl rounded-t-2xl h-[90vh] overflow-y-auto flex flex-col gap-4"
      >
        <SheetHeader className="p-0">
          <SheetTitle className="font-display text-left">New task</SheetTitle>
        </SheetHeader>

        <Input
          autoFocus
          placeholder="Task title"
          className="font-display text-lg"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{statusMeta[s].label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITY_ORDER.map((p) => <SelectItem key={p} value={p}>{priorityMeta[p].label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No project</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>

        <div className="flex flex-col gap-2 flex-1 min-h-0">
          <span className="font-mono text-xs uppercase tracking-wide text-ink-muted">Description</span>
          <Textarea
            placeholder="Write markdown… (optional)"
            className="flex-1 min-h-32 font-mono text-sm resize-none"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <Button onClick={submit} disabled={!title.trim() || create.isPending}>
          Create task
        </Button>
      </SheetContent>
    </Sheet>
  );
}
