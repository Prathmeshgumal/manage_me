import { Moon, Sun, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils";

export type ViewMode = "board" | "list";
export type GroupBy = "status" | "priority";

export function Topbar({ view, onView, groupBy, onGroupBy, onNewTask, onOpenPalette }: {
  view: ViewMode; onView: (v: ViewMode) => void;
  groupBy: GroupBy; onGroupBy: (g: GroupBy) => void;
  onNewTask: () => void; onOpenPalette: () => void;
}) {
  const { theme, toggle } = useTheme();
  const seg = (active: boolean) =>
    cn("px-3 py-1 text-sm rounded-md font-mono transition-colors",
      active ? "bg-ink text-bg" : "text-ink-muted hover:text-ink");
  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-4 gap-4 bg-surface">
      <div className="flex items-center gap-1">
        <button className={seg(view === "board")} onClick={() => onView("board")}>Board</button>
        <button className={seg(view === "list")} onClick={() => onView("list")}>List</button>
      </div>
      <div className="flex items-center gap-3">
        {view === "board" && (
          <div className="flex items-center gap-1 border border-border rounded-md p-0.5">
            <button className={seg(groupBy === "status")} onClick={() => onGroupBy("status")}>Status</button>
            <button className={seg(groupBy === "priority")} onClick={() => onGroupBy("priority")}>Priority</button>
          </div>
        )}
        <Button variant="ghost" size="icon" onClick={onOpenPalette} aria-label="Search (Cmd+K)">
          <Search className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
        <Button onClick={onNewTask} className="gap-1">
          <Plus className="size-4" /> New
        </Button>
      </div>
    </header>
  );
}
