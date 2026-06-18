import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar, type ViewMode, type GroupBy } from "@/components/layout/Topbar";

export default function App() {
  const [view, setView] = useState<ViewMode>("board");
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex">
      <Sidebar selectedProjectId={projectId} onSelectProject={setProjectId} />
      <main className="flex-1 h-screen flex flex-col">
        <Topbar
          view={view}
          onView={setView}
          groupBy={groupBy}
          onGroupBy={setGroupBy}
          onNewTask={() => setCreateOpen(true)}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        <section className="flex-1 overflow-auto p-4">
          <p className="font-mono text-sm text-ink-muted">
            view={view} · group={groupBy} · project={projectId ?? "all"} · palette=
            {String(paletteOpen)} · create={String(createOpen)}
          </p>
        </section>
      </main>
    </div>
  );
}
