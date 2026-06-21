import { useEffect, useState } from "react";
import { PanelLeftOpen } from "lucide-react";
import type { Task } from "@/types";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar, type ViewMode, type GroupBy } from "@/components/layout/Topbar";
import { BoardView, type CreateDefaults } from "@/components/board/BoardView";
import { ListView } from "@/components/list/ListView";
import { QuickCreateDialog } from "@/components/task/QuickCreateDialog";
import { TaskDetailPanel } from "@/components/task/TaskDetailPanel";
import { CommandPalette } from "@/components/command/CommandPalette";
import { HotCornerCalendar } from "@/components/HotCornerCalendar";
import { SettingsPage } from "@/pages/SettingsPage";
import { ProjectSettingsPage } from "@/pages/ProjectSettingsPage";
import { LibraryRail } from "@/components/library/LibraryRail";
import { LibraryPage } from "@/pages/LibraryPage";
import { WishlistsPage } from "@/components/wishlist/WishlistsPage";
import { WishlistView } from "@/components/wishlist/WishlistView";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useTasks } from "@/hooks/useTasks";
import { useAuth } from "@/hooks/useAuth";
import { AuthPage } from "@/pages/AuthPage";
import type { DueBucket } from "@/lib/dueDate";

type Page = "tasks" | "settings" | "project-settings" | "library" | "wishlists" | "wishlist";

export default function App() {
  const [page, setPage] = useState<Page>("tasks");
  const [view, setView] = useState<ViewMode>("board");
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [dueFilter, setDueFilter] = useState<DueBucket | "ALL">("ALL");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [libraryBookId, setLibraryBookId] = useState<string | null>(null);
  const [wishlistId, setWishlistId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("sidebarCollapsed") === "true",
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<CreateDefaults>({});
  const [openTask, setOpenTask] = useState<Task | null>(null);

  const { toggle } = useTheme();
  const { status } = useAuth();
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
      setPage("settings");
      history.replaceState(null, "", location.pathname);
    }
  }, []);

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-ink-muted">Loading…</div>;
  }
  if (status === "anonymous") {
    return <AuthPage />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        page={page}
        selectedProjectId={projectId}
        onSelectProject={setProjectId}
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        onOpenTasks={() => setPage("tasks")}
        onOpenSettings={() => setPage("settings")}
        onSelectProjectRow={(id) => { setProjectId(id); setPage("tasks"); }}
      />
      <main className="flex-1 h-screen flex flex-col min-w-0">
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
            projectSelected={!!projectId}
            onOpenProjectSettings={() => setPage("project-settings")}
          />
        )}
        {!["tasks", "library", "wishlists", "wishlist"].includes(page) && (
          <header className="h-14 border-b border-border flex items-center px-4 bg-surface">
            {sidebarCollapsed && (
              <button className="p-2 rounded hover:bg-surface-muted mr-2" onClick={toggleSidebar} aria-label="Open sidebar">
                <PanelLeftOpen className="size-4" />
              </button>
            )}
            <h1 className="font-display text-xl font-bold">{page === "settings" ? "Settings" : "Project Settings"}</h1>
          </header>
        )}
        {(page === "library" || page === "wishlists" || page === "wishlist") && sidebarCollapsed && (
          <header className="h-14 border-b border-border flex items-center px-4 bg-surface">
            <button className="p-2 rounded hover:bg-surface-muted mr-2" onClick={toggleSidebar} aria-label="Open sidebar">
              <PanelLeftOpen className="size-4" />
            </button>
          </header>
        )}
        <section className="flex-1 overflow-auto p-4 no-scrollbar">
          {page === "settings" ? (
            <SettingsPage />
          ) : page === "library" ? (
            <LibraryPage projectId={projectId} initialBookId={libraryBookId} onBack={() => setPage("tasks")} />
          ) : page === "wishlists" ? (
            <WishlistsPage onSelectWishlist={(id) => { setWishlistId(id); setPage("wishlist"); }} />
          ) : page === "wishlist" && wishlistId ? (
            <WishlistView id={wishlistId} onBack={() => setPage("wishlists")} />
          ) : page === "project-settings" && projectId ? (
            <ProjectSettingsPage
              projectId={projectId}
              onBack={() => setPage("tasks")}
              onDeleted={() => { setProjectId(null); setPage("tasks"); }}
              onOpenBook={(bookId) => { setLibraryBookId(bookId); setPage("library"); }}
            />
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

      <LibraryRail
        onOpenShelf={() => { setLibraryBookId(null); setPage("library"); }}
        onOpenWishlists={() => setPage("wishlists")}
        shelfActive={page === "library"}
        wishlistActive={page === "wishlists" || page === "wishlist"}
      />

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
