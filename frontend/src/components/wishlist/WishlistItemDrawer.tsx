import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { useCreateWishlistItem, useUpdateWishlistItem } from "@/hooks/useWishlists";
import { CURRENCY } from "@/components/wishlist/money";
import type { WishlistItem, WishlistItemStatus, WishlistItemPriority } from "@/types";

const STATUS_LABELS: Record<WishlistItemStatus, string> = {
  WISHLIST: "Wishlist",
  SAVING: "Saving",
  PURCHASED: "Purchased",
  ARCHIVED: "Archived",
};
const PRIORITY_LABELS: Record<WishlistItemPriority, string> = {
  MUST_HAVE: "Must have",
  NICE_TO_HAVE: "Nice to have",
  DREAM: "Dream",
};
const STATUSES = Object.keys(STATUS_LABELS) as WishlistItemStatus[];
const PRIORITIES = Object.keys(PRIORITY_LABELS) as WishlistItemPriority[];

export function WishlistItemDrawer({
  open,
  onOpenChange,
  wishlistId,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wishlistId: string;
  item: WishlistItem | null;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState<WishlistItemStatus>("WISHLIST");
  const [priority, setPriority] = useState<WishlistItemPriority>("NICE_TO_HAVE");
  const [targetDate, setTargetDate] = useState("");

  const createItem = useCreateWishlistItem();
  const updateItem = useUpdateWishlistItem();

  const isEditing = !!item;

  // Sync the form with the selected item every time the drawer opens. useState
  // initializers only run on mount, but this drawer stays mounted and is reused
  // for both create and edit, so the fields must be reset whenever open/item changes.
  useEffect(() => {
    if (!open) return;
    setTitle(item?.title ?? "");
    setDescription(item?.description ?? "");
    setPrice(item?.price != null ? String(item.price) : "");
    setStatus(item?.status ?? "WISHLIST");
    setPriority(item?.priority ?? "NICE_TO_HAVE");
    setTargetDate(item?.targetDate ? new Date(item.targetDate).toISOString().split("T")[0] : "");
  }, [open, item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const data = {
      title: title.trim(),
      description: description.trim() || null,
      price: price ? parseFloat(price) : null,
      currency: CURRENCY,
      status,
      priority,
      targetDate: targetDate || null,
    };

    if (isEditing) {
      await updateItem.mutateAsync({ id: item.id, patch: data });
    } else {
      await createItem.mutateAsync({ wishlistId, input: data });
    }

    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Item" : "New Item"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4">
          <div>
            <label className="text-xs text-ink-muted mb-1 block">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Item name"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-ink-muted mb-1 block">Description</label>
            <MarkdownEditor
              key={item?.id ?? "new"}
              value={description}
              onChange={setDescription}
              minHeight="min-h-32"
              placeholder="Details, why you want it, where to buy…"
            />
          </div>

          <div>
            <label className="text-xs text-ink-muted mb-1 block">Price (₹)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">₹</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                className="pl-7"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-ink-muted mb-1 block">Status</label>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`px-3 py-1 text-sm rounded-md border ${
                    status === s
                      ? "bg-ink text-bg border-ink"
                      : "bg-surface border-border hover:bg-bg"
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-ink-muted mb-1 block">Priority</label>
            <div className="flex flex-wrap gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`px-3 py-1 text-sm rounded-md border ${
                    priority === p
                      ? "bg-ink text-bg border-ink"
                      : "bg-surface border-border hover:bg-bg"
                  }`}
                >
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-ink-muted mb-1 block">Target Purchase Date</label>
            <DatePicker
              value={targetDate || null}
              onChange={(v) => setTargetDate(v ?? "")}
              placeholder="Pick a target date"
            />
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || createItem.isPending || updateItem.isPending}>
              {isEditing ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
