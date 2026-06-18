import { useEffect, useState } from "react";
import type { Task } from "@/types";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar, type ViewMode, type GroupBy } from "@/components/layout/Topbar";
import { BoardView, type CreateDefaults } from "@/components/board/BoardView";
import { ListView } from "@/components/list/ListView";
import { QuickCreateDialog } from "@/components/task/QuickCreateDialog";
import { TaskDetailPanel } from "@/components/task/TaskDetailPanel";
import { CommandPalette } from "@/components/command/CommandPalette";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useTasks } from "@/hooks/useTasks";

export default function App() {
  const [view, setView] = useState<ViewMode>("board");
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<CreateDefaults>({});
  const [openTask, setOpenTask] = useState<Task | null>(null);

  const { toggle } = useTheme();
  const { data: allTasks = [] } = useTasks(projectId ? { projectId } : undefined);

  const openCreate = (defaults: CreateDefaults = {}) => {
    setCreateDefaults(defaults);
    setCreateOpen(true);
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (["INPUT", "TEXTAREA"].includes(el.tagName) || el.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (typing) return;
      if (e.key === "c") { e.preventDefault(); openCreate(); }
      if (e.key === "/") { e.preventDefault(); setPaletteOpen(true); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex">
      <Sidebar selectedProjectId={projectId} onSelectProject={setProjectId} />
      <main className="flex-1 h-screen flex flex-col">
        <Topbar
          view={view}
          onView={setView}
          groupBy={groupBy}
          onGroupBy={setGroupBy}
          onNewTask={() => openCreate()}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        <section className="flex-1 overflow-auto p-4">
          {view === "board" ? (
            <BoardView
              groupBy={groupBy}
              projectId={projectId}
              onOpenTask={setOpenTask}
              onCreateInColumn={openCreate}
            />
          ) : (
            <ListView projectId={projectId} onOpenTask={setOpenTask} />
          )}
        </section>
      </main>

      <QuickCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultProjectId={projectId}
        defaultStatus={createDefaults.status}
        defaultPriority={createDefaults.priority}
      />
      <TaskDetailPanel task={openTask} open={!!openTask} onOpenChange={(o) => !o && setOpenTask(null)} />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        tasks={allTasks}
        onOpenTask={(t) => { setOpenTask(t); setPaletteOpen(false); }}
        actions={{
          newTask: () => openCreate(),
          board: () => setView("board"),
          list: () => setView("list"),
          groupStatus: () => setGroupBy("status"),
          groupPriority: () => setGroupBy("priority"),
          toggleTheme: toggle,
        }}
      />
    </div>
  );
}
