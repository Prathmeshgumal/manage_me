import { useEffect, useState } from "react";
import { Plus, ArrowLeft, Trash2, Pencil, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWishlist, useUpdateWishlistItem, useDeleteWishlistItem } from "@/hooks/useWishlists";
import { WishlistItemDrawer } from "@/components/wishlist/WishlistItemDrawer";
import { CategoryIcon } from "@/components/wishlist/categories";
import { formatINR } from "@/components/wishlist/money";
import { cn } from "@/lib/utils";
import type { WishlistItem, WishlistItemStatus, WishlistItemPriority } from "@/types";

const STATUS_CONFIG: Record<WishlistItemStatus, { label: string; color: string }> = {
  WISHLIST: { label: "Wishlist", color: "bg-gray-100 text-gray-700" },
  SAVING: { label: "Saving", color: "bg-yellow-100 text-yellow-700" },
  PURCHASED: { label: "Purchased", color: "bg-green-100 text-green-700" },
  ARCHIVED: { label: "Archived", color: "bg-gray-100 text-gray-500" },
};

const PRIORITY_CONFIG: Record<WishlistItemPriority, { label: string; color: string }> = {
  MUST_HAVE: { label: "Must have", color: "text-red-500" },
  NICE_TO_HAVE: { label: "Nice to have", color: "text-yellow-500" },
  DREAM: { label: "Dream", color: "text-purple-500" },
};

function WishlistItemCard({
  item,
  onSelect,
  onStatusChange,
  onDelete,
}: {
  item: WishlistItem;
  onSelect: () => void;
  onStatusChange: (status: WishlistItemStatus) => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className="group relative bg-surface border border-border rounded-lg p-4 cursor-pointer hover:border-ink-muted transition-colors"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium truncate">{item.title}</h3>
            <span className={cn("text-xs px-2 py-0.5 rounded", STATUS_CONFIG[item.status].color)}>
              {STATUS_CONFIG[item.status].label}
            </span>
          </div>
          {item.description && (
            <p className="text-sm text-ink-muted line-clamp-2 mt-1">{item.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-ink-muted">
            {item.price !== null && (
              <span className="font-mono">{formatINR(item.price)}</span>
            )}
            <span className={PRIORITY_CONFIG[item.priority].color}>
              {PRIORITY_CONFIG[item.priority].label}
            </span>
            {item.targetDate && (
              <span>Target: {new Date(item.targetDate).toLocaleDateString()}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-bg"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </div>
      </div>
      {menuOpen && (
        <div
          className="absolute top-12 right-4 bg-surface border border-border rounded-md shadow-lg z-10 py-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStatusChange("PURCHASED");
              setMenuOpen(false);
            }}
            className="w-full px-3 py-1.5 text-sm text-left hover:bg-bg"
          >
            Mark Purchased
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
              setMenuOpen(false);
            }}
            className="w-full px-3 py-1.5 text-sm text-left hover:bg-bg flex items-center gap-2"
          >
            <Pencil className="size-3" /> Edit
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
              setMenuOpen(false);
            }}
            className="w-full px-3 py-1.5 text-sm text-left hover:bg-bg text-red-500 flex items-center gap-2"
          >
            <Trash2 className="size-3" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

export function WishlistView({
  id,
  onBack,
  initialItemId,
}: {
  id: string;
  onBack: () => void;
  initialItemId?: string | null;
}) {
  const [selectedItem, setSelectedItem] = useState<WishlistItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filter, setFilter] = useState<WishlistItemStatus | "ALL">("ALL");

  const { data: wishlist, isLoading } = useWishlist(id);

  useEffect(() => {
    if (!initialItemId || !wishlist) return;
    const match = wishlist.items.find((i) => i.id === initialItemId);
    if (match) {
      setSelectedItem(match);
      setDrawerOpen(true);
    }
  }, [initialItemId, wishlist]);
  const updateItem = useUpdateWishlistItem();
  const deleteItem = useDeleteWishlistItem();

  if (isLoading || !wishlist) {
    return <div className="p-6 text-ink-muted">Loading...</div>;
  }

  const filteredItems = filter === "ALL" 
    ? wishlist.items 
    : wishlist.items.filter((item) => item.status === filter);

  const totalValue = wishlist.items.reduce((sum, item) => sum + (item.price || 0), 0);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-1 rounded hover:bg-bg">
          <ArrowLeft className="size-5" />
        </button>
        <div
          className="size-8 rounded flex items-center justify-center"
          style={{ backgroundColor: wishlist.color + "20" }}
        >
          <span style={{ color: wishlist.color }}>
            <CategoryIcon category={wishlist.category} />
          </span>
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">{wishlist.name}</h1>
          {wishlist.description && (
            <p className="text-sm text-ink-muted">{wishlist.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-muted">
            {wishlist.items.length} items | Total: {formatINR(totalValue)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as WishlistItemStatus | "ALL")}
            className="text-sm border border-border rounded px-2 py-1 bg-surface"
          >
            <option value="ALL">All statuses</option>
            <option value="WISHLIST">Wishlist</option>
            <option value="SAVING">Saving</option>
            <option value="PURCHASED">Purchased</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <Button onClick={() => { setSelectedItem(null); setDrawerOpen(true); }}>
            <Plus className="size-4 mr-1" /> Add Item
          </Button>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="text-center py-12 text-ink-muted">
          <p>No items in this wishlist yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <WishlistItemCard
              key={item.id}
              item={item}
              onSelect={() => {
                setSelectedItem(item);
                setDrawerOpen(true);
              }}
              onStatusChange={(status) => {
                updateItem.mutate({ id: item.id, patch: { status } });
              }}
              onDelete={() => {
                deleteItem.mutate({ id: item.id, wishlistId: wishlist.id });
              }}
            />
          ))}
        </div>
      )}

      <WishlistItemDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setSelectedItem(null);
        }}
        wishlistId={id}
        item={selectedItem}
      />
    </div>
  );
}
