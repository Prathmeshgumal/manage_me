import { useState } from "react";
import { Plus, MoreHorizontal, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WishlistDialog } from "@/components/wishlist/WishlistDialog";
import { WishlistItemDrawer } from "@/components/wishlist/WishlistItemDrawer";
import { CategoryIcon } from "@/components/wishlist/categories";
import { formatINR } from "@/components/wishlist/money";
import { useWishlists, useWishlist, useDeleteWishlist } from "@/hooks/useWishlists";
import { TodosBoard } from "@/components/todo/TodosBoard";
import type { Wishlist, WishlistItem } from "@/types";

function WishlistColumn({
  wishlist,
  onOpenList,
  onEditList,
  onDeleteList,
  onAddItem,
  onEditItem,
}: {
  wishlist: Wishlist;
  onOpenList: () => void;
  onEditList: () => void;
  onDeleteList: () => void;
  onAddItem: () => void;
  onEditItem: (item: WishlistItem) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: detail } = useWishlist(wishlist.id);
  const items = detail?.items ?? [];
  const total = items.reduce((sum, i) => sum + (i.price ?? 0), 0);

  return (
    <div className="w-72 shrink-0 flex flex-col bg-surface border border-border rounded-lg">
      <div className="relative flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <span
          className="size-7 shrink-0 rounded-md flex items-center justify-center"
          style={{ backgroundColor: wishlist.color + "20", color: wishlist.color }}
        >
          <CategoryIcon category={wishlist.category} className="size-3.5" />
        </span>
        <button onClick={onOpenList} className="min-w-0 flex-1 text-left">
          <span className="font-display text-sm font-semibold truncate block hover:underline">
            {wishlist.name}
          </span>
        </button>
        <span className="font-mono text-xs text-ink-muted shrink-0">{wishlist.itemCount}</span>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="List options"
          className="shrink-0 p-1 rounded hover:bg-bg text-ink-muted hover:text-ink"
        >
          <MoreHorizontal className="size-4" />
        </button>
        {menuOpen && (
          <div className="absolute top-11 right-2 bg-surface border border-border rounded-md shadow-lg z-10 py-1">
            <button
              onClick={() => { setMenuOpen(false); onEditList(); }}
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-bg flex items-center gap-2"
            >
              <Pencil className="size-3" /> Edit list
            </button>
            <button
              onClick={() => { setMenuOpen(false); onDeleteList(); }}
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-bg text-red-500 flex items-center gap-2"
            >
              <Trash2 className="size-3" /> Delete list
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1 p-2 min-h-16 max-h-[60vh] overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-2 py-3 text-xs text-ink-muted">No items yet.</p>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              onClick={() => onEditItem(item)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left hover:bg-bg"
            >
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              {item.price != null && (
                <span className="shrink-0 font-mono text-xs text-ink-muted">{formatINR(item.price)}</span>
              )}
            </button>
          ))
        )}
      </div>

      <div className="border-t border-border px-3 py-2 flex items-center justify-between">
        <button
          onClick={onAddItem}
          className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
        >
          <Plus className="size-4" /> Add item
        </button>
        {total > 0 && <span className="font-mono text-xs text-ink-muted">{formatINR(total)}</span>}
      </div>
    </div>
  );
}

export function WishlistsPage({ onSelectWishlist }: { onSelectWishlist: (id: string) => void }) {
  const [listDialog, setListDialog] = useState<{ open: boolean; editing: Wishlist | null }>({
    open: false,
    editing: null,
  });
  const [itemDrawer, setItemDrawer] = useState<{ open: boolean; wishlistId: string; item: WishlistItem | null }>({
    open: false,
    wishlistId: "",
    item: null,
  });
  const { data: wishlists = [], isLoading } = useWishlists();
  const deleteWishlist = useDeleteWishlist();

  if (isLoading) {
    return <div className="p-6 text-ink-muted">Loading...</div>;
  }

  return (
    <div className="p-2">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Wishlists</h1>
        <Button onClick={() => setListDialog({ open: true, editing: null })}>
          <Plus className="size-4 mr-1" /> New Wishlist
        </Button>
      </div>

      {wishlists.length === 0 ? (
        <div className="text-center py-12 text-ink-muted">
          <p>No wishlists yet. Create one to start tracking things you want to buy.</p>
        </div>
      ) : (
        <div className="flex gap-4 items-start overflow-x-auto pb-2">
          {wishlists.map((wl) => (
            <WishlistColumn
              key={wl.id}
              wishlist={wl}
              onOpenList={() => onSelectWishlist(wl.id)}
              onEditList={() => setListDialog({ open: true, editing: wl })}
              onDeleteList={() => deleteWishlist.mutate(wl.id)}
              onAddItem={() => setItemDrawer({ open: true, wishlistId: wl.id, item: null })}
              onEditItem={(item) => setItemDrawer({ open: true, wishlistId: wl.id, item })}
            />
          ))}
        </div>
      )}

      <div className="mt-10">
        <h1 className="font-display text-2xl font-bold mb-6">Lists</h1>
        <TodosBoard />
      </div>

      <WishlistDialog
        open={listDialog.open}
        onOpenChange={(o) => setListDialog((s) => ({ ...s, open: o }))}
        wishlist={listDialog.editing}
      />
      <WishlistItemDrawer
        open={itemDrawer.open}
        onOpenChange={(o) => setItemDrawer((s) => ({ ...s, open: o }))}
        wishlistId={itemDrawer.wishlistId}
        item={itemDrawer.item}
      />
    </div>
  );
}
