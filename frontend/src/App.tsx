import { useEffect, useState } from "react";
import type { Task } from "@/types";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar, type ViewMode, type GroupBy } from "@/components/layout/Topbar";
import { BoardView, type CreateDefaults } from "@/components/board/BoardView";
import { ListView } from "@/components/list/ListView";
import { QuickCreateDialog } from "@/components/task/QuickCreateDialog";
import { TaskDetailPanel } from "@/components/task/TaskDetailPanel";
import { CommandPalette } from "@/components/command/CommandPalette";
import { HotCornerCalendar } from "@/components/HotCornerCalendar";
import { SettingsGithubPage } from "@/pages/SettingsGithubPage";
import { MyGithubPage } from "@/pages/MyGithubPage";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useTasks } from "@/hooks/useTasks";
import type { DueBucket } from "@/lib/dueDate";

type Page = "tasks" | "my-github" | "settings-github";

export default function App() {
  const [page, setPage] = useState<Page>("tasks");
  const [view, setView] = useState<ViewMode>("board");
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [dueFilter, setDueFilter] = useState<DueBucket | "ALL">("ALL");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("sidebarCollapsed") === "true",
  );
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

  const toggleSidebar = () =>
    setSidebarCollapsed((c) => {
      localStorage.setItem("sidebarCollapsed", String(!c));
      return !c;
    });

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

  // After the GitHub OAuth/install redirect, land on the settings page and clean the URL.
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if (p.has("connected") || p.has("installed") || p.has("error")) {
      setPage("settings-github");
      history.replaceState(null, "", location.pathname);
    }
  }, []);

  return (
    <div className="flex">
      <Sidebar
        selectedProjectId={projectId}
        onSelectProject={setProjectId}
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        onOpenTasks={() => setPage("tasks")}
        onOpenMyGithub={() => setPage("my-github")}
        onOpenSettingsGithub={() => setPage("settings-github")}
      />
      <main className="flex-1 h-screen flex flex-col">
        {page === "tasks" && (
          <Topbar
            view={view}
            onView={setView}
            groupBy={groupBy}
            onGroupBy={setGroupBy}
            dueFilter={dueFilter}
            onDueFilter={setDueFilter}
            onNewTask={() => openCreate()}
            onOpenPalette={() => setPaletteOpen(true)}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={toggleSidebar}
          />
        )}
        <section className="flex-1 overflow-auto p-4">
          {page === "my-github" ? (
            <MyGithubPage onGoToSettings={() => setPage("settings-github")} />
          ) : page === "settings-github" ? (
            <SettingsGithubPage />
          ) : view === "board" ? (
            <BoardView
              groupBy={groupBy}
              projectId={projectId}
              dueFilter={dueFilter}
              onOpenTask={setOpenTask}
              onCreateInColumn={openCreate}
            />
          ) : (
            <ListView projectId={projectId} dueFilter={dueFilter} onOpenTask={setOpenTask} />
          )}
        </section>
      </main>

      <QuickCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultProjectId={projectId}
        defaultStatus={createDefaults.status}
        defaultPriority={createDefaults.priority}
        defaultDueDate={createDefaults.dueDate}
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
      <HotCornerCalendar />
    </div>
  );
}
