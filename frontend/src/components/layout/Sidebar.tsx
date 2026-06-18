import { useState } from "react";
import { Plus, PanelLeftClose } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useLabels } from "@/hooks/useLabels";
import { CreateProjectDialog } from "@/components/project/CreateProjectDialog";
import { cn } from "@/lib/utils";

export function Sidebar({ selectedProjectId, onSelectProject, collapsed, onToggle }: {
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { data: projects = [] } = useProjects();
  const { data: labels = [] } = useLabels();
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
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
      <nav className="text-sm">
        <button
          onClick={() => onSelectProject(null)}
          className={cn("w-full text-left px-2 py-1 rounded-md hover:bg-bg", !selectedProjectId && "bg-bg font-medium")}
        >
          All tasks
        </button>
      </nav>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-xs uppercase tracking-wide text-ink-muted">Projects</span>
          <button
            onClick={() => setCreateProjectOpen(true)}
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
                onClick={() => onSelectProject(p.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1 rounded-md hover:bg-bg",
                  selectedProjectId === p.id && "bg-bg font-medium",
                )}
              >
                <span className="size-2 rounded-full" style={{ background: p.color }} />
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="font-mono text-xs uppercase tracking-wide text-ink-muted mb-2">Labels</div>
        <ul className="text-sm space-y-1">
          {labels.length === 0 && <li className="px-2 text-ink-muted text-xs">No labels yet</li>}
          {labels.map((l) => (
            <li key={l.id} className="flex items-center gap-2 px-2 py-1">
              <span className="size-2 rounded-sm" style={{ background: l.color }} />
              {l.name}
            </li>
          ))}
        </ul>
      </div>

      <CreateProjectDialog open={createProjectOpen} onOpenChange={setCreateProjectOpen} />
      </div>
    </aside>
  );
}
