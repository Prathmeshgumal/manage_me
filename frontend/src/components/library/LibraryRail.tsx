import { Library, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";

export function LibraryRail({ onOpen }: { onOpen: () => void }) {
  const { theme, toggle } = useTheme();
  return (
    <div className="w-16 shrink-0 border-l border-border bg-surface flex flex-col py-2">
      <button
        className="flex flex-col items-center gap-1 w-full py-3 text-[11px] text-ink-muted hover:text-ink hover:bg-bg"
        onClick={onOpen}
      >
        <Library className="size-5" /> Shelf
      </button>
      <button
        onClick={toggle}
        aria-label="Toggle theme"
        className="mt-auto flex flex-col items-center gap-1 w-full py-3 text-[11px] text-ink-muted hover:text-ink hover:bg-bg"
      >
        {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />} Theme
      </button>
    </div>
  );
}
