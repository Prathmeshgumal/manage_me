import { useState } from "react";
import { FileText, Plus } from "lucide-react";
import type { PageSummary } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreatePage } from "@/hooks/useLibrary";

export function PageList({ bookId, pages, onOpenPage }: {
  bookId: string; pages: PageSummary[]; onOpenPage: (id: string) => void;
}) {
  const create = useCreatePage(bookId);
  const [title, setTitle] = useState("");
  const add = () => {
    if (!title.trim()) return;
    create.mutate({ title: title.trim() }, { onSuccess: (p) => { setTitle(""); onOpenPage(p.id); } });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 max-w-md">
        <Input placeholder="New page title" value={title} onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()} />
        <Button onClick={add} disabled={!title.trim() || create.isPending} className="gap-1 shrink-0">
          <Plus className="size-4" /> Page
        </Button>
      </div>

      {pages.length === 0 ? (
        <p className="text-sm text-ink-muted">No pages yet.</p>
      ) : (
        <ul className="border border-border rounded-lg divide-y divide-border overflow-hidden">
          {pages.map((p) => (
            <li key={p.id}>
              <button onClick={() => onOpenPage(p.id)} className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg">
                <FileText className="size-4 text-ink-muted" />
                <span className="flex-1 truncate">{p.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
