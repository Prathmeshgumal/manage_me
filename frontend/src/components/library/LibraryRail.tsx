import { Library } from "lucide-react";

export function LibraryRail({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="w-16 shrink-0 border-l border-border bg-surface flex flex-col py-2">
      <button
        className="flex flex-col items-center gap-1 w-full py-3 text-[11px] text-ink-muted hover:text-ink hover:bg-bg"
        onClick={onOpen}
      >
        <Library className="size-5" /> Shelf
      </button>
    </div>
  );
}
