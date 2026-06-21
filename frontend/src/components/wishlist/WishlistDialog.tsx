import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColorPicker } from "@/components/ui/color-picker";
import { useCreateWishlist, useUpdateWishlist } from "@/hooks/useWishlists";
import { CATEGORIES, CategoryIcon } from "@/components/wishlist/categories";
import { cn } from "@/lib/utils";
import type { Wishlist, WishlistCategory } from "@/types";

export function WishlistDialog({
  open,
  onOpenChange,
  wishlist,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the dialog edits this wishlist instead of creating one. */
  wishlist?: Wishlist | null;
  onSelect?: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<WishlistCategory>("Other");
  const [color, setColor] = useState("#8A8A86");

  const create = useCreateWishlist();
  const update = useUpdateWishlist();
  const isEditing = !!wishlist;
  const isPending = create.isPending || update.isPending;

  // The dialog stays mounted and is reused, so sync fields each time it opens.
  useEffect(() => {
    if (!open) return;
    setName(wishlist?.name ?? "");
    setDescription(wishlist?.description ?? "");
    setCategory(wishlist?.category ?? "Other");
    setColor(wishlist?.color ?? "#8A8A86");
  }, [open, wishlist]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const data = {
      name: name.trim(),
      description: description.trim() || null,
      category,
      color,
    };
    if (isEditing) {
      await update.mutateAsync({ id: wishlist.id, patch: data });
    } else {
      const wl = await create.mutateAsync(data);
      onSelect?.(wl.id);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">{isEditing ? "Edit wishlist" : "New wishlist"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-ink-muted mb-1 block">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Wishlist"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-ink-muted mb-1 block">Description (optional)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this wishlist for?"
            />
          </div>
          <div>
            <label className="text-xs text-ink-muted mb-1 block">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 text-sm rounded-md border",
                    category === cat ? "bg-ink text-bg border-ink" : "bg-surface border-border hover:bg-bg",
                  )}
                >
                  <CategoryIcon category={cat} className="size-3.5" /> {cat}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-ink-muted mb-1 block">Color</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isPending}>
              {isEditing ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
