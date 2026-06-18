import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Project } from "@/types";
import { useCreateProject, useUpdateProject, useDeleteProject } from "@/hooks/useProjects";
import { useGithubStatus, useRepositories } from "@/hooks/useGithub";
import { cn } from "@/lib/utils";

const SWATCHES = ["#4FA3D1", "#E0B341", "#F5872B", "#F4404A", "#8A8A86", "#7C5CFC", "#3FB68B"];
const NONE = "none";

/** Create a new project, or edit/delete an existing one (when `project` is provided). */
export function ProjectDialog({ open, onOpenChange, project }: {
  open: boolean; onOpenChange: (o: boolean) => void; project?: Project;
}) {
  const create = useCreateProject();
  const update = useUpdateProject();
  const del = useDeleteProject();
  const editing = !!project;

  const { data: status } = useGithubStatus();
  const hasInstalls = (status?.installations?.length ?? 0) > 0;
  const { data: repos = [] } = useRepositories(open && hasInstalls);

  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const [repoFullName, setRepoFullName] = useState<string>(NONE); // value = fullName or NONE

  useEffect(() => {
    if (open) {
      setName(project?.name ?? "");
      setColor(project?.color ?? SWATCHES[0]);
      setRepoFullName(project?.githubRepoFullName ?? NONE);
    }
  }, [open, project]);

  // Ensure the project's currently-linked repo shows even if not in the fetched list.
  const options = [...repos];
  if (editing && project!.githubRepoFullName && !options.some((r) => r.fullName === project!.githubRepoFullName)) {
    options.unshift({
      id: project!.githubRepoId!, fullName: project!.githubRepoFullName,
      private: false, installationId: project!.githubInstallationId ?? 0,
    });
  }

  function repoFields() {
    if (repoFullName === NONE) return { githubRepoId: null, githubRepoFullName: null, githubInstallationId: null };
    const r = options.find((o) => o.fullName === repoFullName);
    return r
      ? { githubRepoId: r.id, githubRepoFullName: r.fullName, githubInstallationId: r.installationId }
      : { githubRepoId: null, githubRepoFullName: null, githubInstallationId: null };
  }

  function submit() {
    if (!name.trim()) return;
    const payload = { name: name.trim(), color, ...repoFields() };
    if (editing) {
      update.mutate({ id: project!.id, patch: payload }, { onSuccess: () => onOpenChange(false) });
    } else {
      create.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">{editing ? "Edit project" : "New project"}</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <div>
          <div className="font-mono text-xs uppercase tracking-wide text-ink-muted mb-2">Color</div>
          <div className="flex items-center gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                onClick={() => setColor(c)}
                className={cn("size-6 rounded-full border-2 transition-transform", color === c ? "border-ink scale-110" : "border-transparent")}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <div>
          <div className="font-mono text-xs uppercase tracking-wide text-ink-muted mb-2">GitHub repository</div>
          {hasInstalls ? (
            <Select value={repoFullName} onValueChange={setRepoFullName}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No repository</SelectItem>
                {options.map((r) => (
                  <SelectItem key={r.fullName} value={r.fullName}>{r.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-xs text-ink-muted">
              Install the app on GitHub (Connect GitHub) to link a repository.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button className="flex-1" onClick={submit} disabled={!name.trim() || create.isPending || update.isPending}>
            {editing ? "Save changes" : "Create project"}
          </Button>
          {editing && (
            <Button
              variant="destructive"
              onClick={() => del.mutate(project!.id, { onSuccess: () => onOpenChange(false) })}
              disabled={del.isPending}
            >
              Delete
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
