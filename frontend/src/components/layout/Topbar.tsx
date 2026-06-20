import { Plus, Search, CalendarClock, PanelLeftOpen, Settings, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DUE_BUCKET_ORDER, dueBucketMeta, type DueBucket } from "@/lib/dueDate";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils";

export type ViewMode = "board" | "list";
export type GroupBy = "status" | "priority" | "due";

export function Topbar({ view, onView, groupBy, onGroupBy, dueFilter, onDueFilter, onNewTask, onOpenPalette, sidebarCollapsed, onToggleSidebar, projectSelected, onOpenProjectSettings }: {
  view: ViewMode; onView: (v: ViewMode) => void;
  groupBy: GroupBy; onGroupBy: (g: GroupBy) => void;
  dueFilter: DueBucket | "ALL"; onDueFilter: (f: DueBucket | "ALL") => void;
  onNewTask: () => void; onOpenPalette: () => void;
  sidebarCollapsed: boolean; onToggleSidebar: () => void;
  projectSelected: boolean; onOpenProjectSettings: () => void;
}) {
  const { theme, toggle } = useTheme();
  const seg = (active: boolean) =>
    cn("px-3 py-1 text-sm rounded-md font-mono transition-colors",
      active ? "bg-ink text-bg" : "text-ink-muted hover:text-ink");
  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-4 gap-4 bg-surface">
      <div className="flex items-center gap-1">
        {sidebarCollapsed && (
          <Button variant="ghost" size="icon" onClick={onToggleSidebar} aria-label="Open sidebar" className="mr-1">
            <PanelLeftOpen className="size-4" />
          </Button>
        )}
        <button className={seg(view === "board")} onClick={() => onView("board")}>Board</button>
        <button className={seg(view === "list")} onClick={() => onView("list")}>List</button>
      </div>
      <div className="flex items-center gap-3">
        {view === "board" && (
          <div className="flex items-center gap-1 border border-border rounded-md p-0.5">
            <button className={seg(groupBy === "status")} onClick={() => onGroupBy("status")}>Status</button>
            <button className={seg(groupBy === "priority")} onClick={() => onGroupBy("priority")}>Priority</button>
            <button className={seg(groupBy === "due")} onClick={() => onGroupBy("due")}>Due</button>
          </div>
        )}
        <Select value={dueFilter} onValueChange={(v) => onDueFilter(v as DueBucket | "ALL")}>
          <SelectTrigger className="w-[150px] h-9" aria-label="Filter by due date">
            <CalendarClock className="size-4 text-ink-muted" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All dates</SelectItem>
            {DUE_BUCKET_ORDER.map((b) => (
              <SelectItem key={b} value={b}>{dueBucketMeta[b].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {projectSelected && (
          <Button variant="ghost" size="icon" onClick={onOpenProjectSettings} aria-label="Project settings">
            <Settings className="size-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={onOpenPalette} aria-label="Search (Cmd+K)">
          <Search className="size-4" />
        </Button>
        <Button onClick={onNewTask} className="gap-1">
          <Plus className="size-4" /> New
        </Button>
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </div>
    </header>
  );
}
