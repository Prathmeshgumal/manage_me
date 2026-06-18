import type { Task, TaskFilter } from "@/types";
import { useTasks } from "@/hooks/useTasks";
import { priorityMeta, statusMeta, STATUS_ORDER } from "@/lib/priority";

export function ListView({ projectId, onOpenTask }: { projectId: string | null; onOpenTask: (t: Task) => void }) {
  const filter: TaskFilter | undefined = projectId ? { projectId } : undefined;
  const { data: tasks = [] } = useTasks(filter);

  return (
    <div className="max-w-4xl mx-auto">
      {STATUS_ORDER.map((status) => {
        const rows = tasks
          .filter((t) => t.status === status)
          .sort((a, b) => priorityMeta[a.priority].rank - priorityMeta[b.priority].rank || a.sortOrder - b.sortOrder);
        if (rows.length === 0) return null;
        return (
          <div key={status} className="mb-6">
            <div className="font-display text-sm font-semibold mb-2 text-ink-muted">
              {statusMeta[status].label} <span className="font-mono text-xs">{rows.length}</span>
            </div>
            <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
              {rows.map((t) => {
                const m = priorityMeta[t.priority];
                return (
                  <button
                    key={t.id}
                    onClick={() => onOpenTask(t)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface"
                  >
                    <span className="font-mono text-[11px]" style={{ color: m.color }} title={m.label}>{m.glyph}</span>
                    <span className="font-mono text-[11px] text-ink-muted w-14">{t.id.slice(0, 6)}</span>
                    <span className="text-sm flex-1">{t.title}</span>
                    {t.labels.map((l) => (
                      <span key={l.id} className="size-2 rounded-sm" style={{ background: l.color }} title={l.name} />
                    ))}
                    {t.dueDate && (
                      <span className="font-mono text-[11px] text-ink-muted">
                        {new Date(t.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
