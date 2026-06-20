import { RotateCcw, X } from "lucide-react";
import { useTrash, useRestoreTrash, usePurgeTrash } from "@/hooks/useTrash";
import { Button } from "@/components/ui/button";
import type { TrashKind } from "@/types";

type Row = { kind: TrashKind; id: string; label: string; type: string };

export function TrashSettings() {
  const { data } = useTrash();
  const restore = useRestoreTrash();
  const purge = usePurgeTrash();

  const rows: Row[] = [
    ...(data?.projects ?? []).map((p) => ({ kind: "project" as const, id: p.id, label: p.name, type: "Project" })),
    ...(data?.tasks ?? []).map((t) => ({ kind: "task" as const, id: t.id, label: t.title, type: "Task" })),
    ...(data?.books ?? []).map((b) => ({ kind: "book" as const, id: b.id, label: b.name, type: "Book" })),
    ...(data?.pages ?? []).map((p) => ({ kind: "page" as const, id: p.id, label: p.title, type: "Page" })),
  ];

  return (
    <section className="rounded-lg border border-border p-4 flex flex-col gap-3 bg-surface">
      <div className="font-mono text-xs uppercase tracking-wide text-ink-muted">Trash</div>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">Trash is empty.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {rows.map((r) => (
            <li key={`${r.kind}-${r.id}`} className="flex items-center gap-3 py-2">
              <span className="font-mono text-[11px] uppercase text-ink-muted w-16 shrink-0">{r.type}</span>
              <span className="text-sm truncate flex-1 min-w-0">{r.label || <span className="text-ink-muted">Untitled</span>}</span>
              <Button
                variant="ghost" size="sm" className="gap-1" disabled={restore.isPending}
                onClick={() => restore.mutate({ kind: r.kind, id: r.id })}
              >
                <RotateCcw className="size-3.5" /> Restore
              </Button>
              <Button
                variant="ghost" size="sm" className="gap-1 text-destructive hover:text-destructive" disabled={purge.isPending}
                onClick={() => {
                  if (confirm(`Permanently delete this ${r.type.toLowerCase()}? This cannot be undone.`)) {
                    purge.mutate({ kind: r.kind, id: r.id });
                  }
                }}
              >
                <X className="size-3.5" /> Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
