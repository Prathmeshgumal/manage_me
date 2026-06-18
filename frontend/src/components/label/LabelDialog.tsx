import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Label } from "@/types";
import { useCreateLabel, useUpdateLabel, useDeleteLabel } from "@/hooks/useLabels";
import { cn } from "@/lib/utils";

const SWATCHES = ["#F4404A", "#F5872B", "#E0B341", "#3FB68B", "#4FA3D1", "#7C5CFC", "#8A8A86"];

/** Create a new label (label omitted) or edit/delete an existing one (label provided). */
export function LabelDialog({ open, onOpenChange, label }: {
  open: boolean; onOpenChange: (o: boolean) => void; label?: Label;
}) {
  const create = useCreateLabel();
  const update = useUpdateLabel();
  const del = useDeleteLabel();
  const editing = !!label;

  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);

  useEffect(() => {
    if (open) {
      setName(label?.name ?? "");
      setColor(label?.color ?? SWATCHES[0]);
    }
  }, [open, label]);

  function submit() {
    if (!name.trim()) return;
    if (editing) {
      update.mutate(
        { id: label!.id, patch: { name: name.trim(), color } },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      create.mutate(
        { name: name.trim(), color },
        { onSuccess: () => onOpenChange(false) },
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">{editing ? "Edit label" : "New label"}</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Label name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <div>
          <div className="font-mono text-xs uppercase tracking-wide text-ink-muted mb-2">Color</div>
          <div className="flex items-center gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                onClick={() => setColor(c)}
                className={cn(
                  "size-6 rounded-full border-2 transition-transform",
                  color === c ? "border-ink scale-110" : "border-transparent",
                )}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="flex-1"
            onClick={submit}
            disabled={!name.trim() || create.isPending || update.isPending}
          >
            {editing ? "Save changes" : "Create label"}
          </Button>
          {editing && (
            <Button
              variant="destructive"
              onClick={() => del.mutate(label!.id, { onSuccess: () => onOpenChange(false) })}
              disabled={del.isPending}
            >
              Delete
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
