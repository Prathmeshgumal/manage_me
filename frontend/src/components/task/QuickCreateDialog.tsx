import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Status, Priority } from "@/types";
import { statusMeta, priorityMeta, STATUS_ORDER, PRIORITY_ORDER } from "@/lib/priority";
import { useCreateTask } from "@/hooks/useTasks";
import { useProjects } from "@/hooks/useProjects";

export function QuickCreateDialog({ open, onOpenChange, defaultProjectId, defaultStatus, defaultPriority }: {
  open: boolean; onOpenChange: (o: boolean) => void; defaultProjectId: string | null;
  defaultStatus?: Status; defaultPriority?: Priority;
}) {
  const create = useCreateTask();
  const { data: projects = [] } = useProjects();
  const [title, setTitle] = useState("");
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
    }
  }, [open, defaultStatus, defaultPriority, defaultProjectId]);

  function submit() {
    if (!title.trim()) return;
    create.mutate(
      {
        title: title.trim(),
        status,
        priority,
        projectId: projectId === "none" ? null : projectId,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      { onSuccess: () => { setTitle(""); setDueDate(""); onOpenChange(false); } },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">New task</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <div className="grid grid-cols-2 gap-3">
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
        <Button onClick={submit} disabled={!title.trim() || create.isPending}>Create task</Button>
      </DialogContent>
    </Dialog>
  );
}
