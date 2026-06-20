import { useState } from "react";
import { Plus } from "lucide-react";
import { useLabels } from "@/hooks/useLabels";
import { LabelDialog } from "@/components/label/LabelDialog";
import { Button } from "@/components/ui/button";
import type { Label } from "@/types";

export function LabelsSettings() {
  const { data: labels = [] } = useLabels();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Label | undefined>(undefined);

  return (
    <section className="rounded-lg border border-border p-4 flex flex-col gap-3 bg-surface">
      <div className="flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-ink-muted">Labels</div>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => { setEditing(undefined); setOpen(true); }}>
          <Plus className="size-4" /> New label
        </Button>
      </div>
      {labels.length === 0 ? (
        <p className="text-sm text-ink-muted">No labels yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {labels.map((l) => (
            <li key={l.id}>
              <button
                onClick={() => { setEditing(l); setOpen(true); }}
                className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1 text-sm hover:bg-bg"
                title="Edit label"
              >
                <span className="size-2.5 rounded-sm" style={{ background: l.color }} />
                {l.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <LabelDialog open={open} onOpenChange={setOpen} label={editing} />
    </section>
  );
}
