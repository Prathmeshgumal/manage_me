import { Library, ShoppingBag, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

export function LibraryRail({ onOpenShelf, onOpenWishlists, onOpenLists, shelfActive, wishlistActive, listsActive }: {
  onOpenShelf: () => void;
  onOpenWishlists: () => void;
  onOpenLists: () => void;
  shelfActive?: boolean;
  wishlistActive?: boolean;
  listsActive?: boolean;
}) {
  const itemClass = "flex flex-col items-center gap-1 w-full py-3 text-[11px] hover:bg-bg";
  return (
    <div className="w-16 shrink-0 border-l border-border bg-surface flex flex-col py-2">
      <button
        className={cn(itemClass, shelfActive ? "text-ink bg-bg font-medium" : "text-ink-muted hover:text-ink")}
        onClick={onOpenShelf}
      >
        <Library className="size-5" /> Shelf
      </button>
      <button
        className={cn(itemClass, wishlistActive ? "text-ink bg-bg font-medium" : "text-ink-muted hover:text-ink")}
        onClick={onOpenWishlists}
      >
        <ShoppingBag className="size-5" /> Wishlist
      </button>
      <button
        className={cn(itemClass, listsActive ? "text-ink bg-bg font-medium" : "text-ink-muted hover:text-ink")}
        onClick={onOpenLists}
      >
        <ListChecks className="size-5" /> Lists
      </button>
    </div>
  );
}
