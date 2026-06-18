import { Library, BookOpen } from "lucide-react";

export function LibraryRail({ onOpen }: { onOpen: (tab: "shelves" | "books") => void }) {
  const btn = "flex flex-col items-center gap-1 w-full py-3 text-[11px] text-ink-muted hover:text-ink hover:bg-bg";
  return (
    <div className="w-16 shrink-0 border-l border-border bg-surface flex flex-col py-2">
      <button className={btn} onClick={() => onOpen("shelves")}>
        <Library className="size-5" /> Shelves
      </button>
      <button className={btn} onClick={() => onOpen("books")}>
        <BookOpen className="size-5" /> Books
      </button>
    </div>
  );
}
