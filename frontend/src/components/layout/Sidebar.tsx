import { useState } from "react";
import { Plus, PanelLeftClose, Github } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useLabels } from "@/hooks/useLabels";
import { ProjectDialog } from "@/components/project/ProjectDialog";
import { LabelDialog } from "@/components/label/LabelDialog";
import type { Label } from "@/types";
import { cn } from "@/lib/utils";

export function Sidebar({ selectedProjectId, onSelectProject, collapsed, onToggle, onOpenTasks, onOpenMyGithub, onSelectProjectRow }: {
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  collapsed: boolean;
  onToggle: () => void;
  onOpenTasks: () => void;
  onOpenMyGithub: () => void;
  onSelectProjectRow: (id: string) => void;
}) {
  const { data: projects = [] } = useProjects();
  const { data: labels = [] } = useLabels();
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<Label | undefined>(undefined);
  return (
    <aside
      className={cn(
        "shrink-0 h-screen bg-surface overflow-hidden transition-[width] duration-200 ease-in-out",
        collapsed ? "w-0 border-r-0" : "w-60 border-r border-border",
      )}
    >
      <div className="w-60 h-screen p-4 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <span className="font-display text-lg font-bold tracking-tight">MySchedule</span>
        <button
          onClick={onToggle}
          aria-label="Collapse sidebar"
          className="text-ink-muted hover:text-ink rounded p-1 hover:bg-bg"
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>
      <nav className="text-sm flex flex-col gap-1">
        <button
          onClick={() => { onSelectProject(null); onOpenTasks(); }}
          className={cn("w-full text-left px-2 py-1 rounded-md hover:bg-bg", !selectedProjectId && "bg-bg font-medium")}
        >
          All tasks
        </button>
        <button onClick={onOpenMyGithub} className="w-full text-left px-2 py-1 rounded-md hover:bg-bg">My GitHub</button>
      </nav>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-xs uppercase tracking-wide text-ink-muted">Projects</span>
          <button
            onClick={() => setProjectDialogOpen(true)}
            aria-label="New project"
            className="text-ink-muted hover:text-ink rounded p-0.5 hover:bg-bg"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
        <ul className="text-sm space-y-1">
          {projects.length === 0 && <li className="px-2 text-ink-muted text-xs">No projects yet</li>}
          {projects.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => onSelectProjectRow(p.id)}
                className={cn(
                  "w-full min-w-0 flex items-center gap-2 px-2 py-1 rounded-md hover:bg-bg",
                  selectedProjectId === p.id && "bg-bg font-medium",
                )}
              >
                <span className="size-2 shrink-0 rounded-full" style={{ background: p.color }} />
                <span className="truncate">{p.name}</span>
                {p.githubRepoFullName && (
                  <Github className="size-3 shrink-0 text-ink-muted ml-auto" aria-label={`Linked to ${p.githubRepoFullName}`} />
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-xs uppercase tracking-wide text-ink-muted">Labels</span>
          <button
            onClick={() => { setEditingLabel(undefined); setLabelDialogOpen(true); }}
            aria-label="New label"
            className="text-ink-muted hover:text-ink rounded p-0.5 hover:bg-bg"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
        <ul className="text-sm space-y-1">
          {labels.length === 0 && <li className="px-2 text-ink-muted text-xs">No labels yet</li>}
          {labels.map((l) => (
            <li key={l.id}>
              <button
                onClick={() => { setEditingLabel(l); setLabelDialogOpen(true); }}
                className="w-full flex items-center gap-2 px-2 py-1 rounded-md hover:bg-bg text-left"
                title="Edit label"
              >
                <span className="size-2 rounded-sm" style={{ background: l.color }} />
                {l.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <ProjectDialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen} />
      <LabelDialog open={labelDialogOpen} onOpenChange={setLabelDialogOpen} label={editingLabel} />
      </div>
    </aside>
  );
}
