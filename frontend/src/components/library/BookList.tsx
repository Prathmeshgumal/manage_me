import { useState } from "react";
import { Book as BookIcon, Plus } from "lucide-react";
import type { BookSummary } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateBook } from "@/hooks/useLibrary";
import { randomBookColor } from "@/lib/bookColors";
import { cn } from "@/lib/utils";

export function BookList({ projectId, shelfId, books, variant, onOpenBook }: {
  projectId: string | null; shelfId: string; books: BookSummary[]; variant: "cards" | "list"; onOpenBook: (id: string) => void;
}) {
  const create = useCreateBook(projectId);
  const [name, setName] = useState("");
  const add = () => {
    if (!name.trim()) return;
    create.mutate({ shelfId, input: { name: name.trim(), color: randomBookColor() } }, { onSuccess: () => setName("") });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 max-w-md">
        <Input placeholder="New book name" value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()} />
        <Button onClick={add} disabled={!name.trim() || create.isPending} className="gap-1 shrink-0">
          <Plus className="size-4" /> Book
        </Button>
      </div>

      {books.length === 0 ? (
        <p className="text-sm text-ink-muted">No books yet.</p>
      ) : variant === "cards" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {books.map((b) => (
            <button key={b.id} onClick={() => onOpenBook(b.id)}
              className="text-left rounded-lg border border-border bg-surface p-3 hover:border-ink/40 flex flex-col gap-2">
              <span className="h-1.5 w-10 rounded-full" style={{ background: b.color }} />
              <span className="text-sm font-medium truncate">{b.name}</span>
              <span className="font-mono text-[11px] text-ink-muted">{b.pageCount} pages</span>
            </button>
          ))}
        </div>
      ) : (
        <ul className="border border-border rounded-lg divide-y divide-border overflow-hidden">
          {books.map((b) => (
            <li key={b.id}>
              <button onClick={() => onOpenBook(b.id)} className={cn("w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg")}>
                <BookIcon className="size-4" style={{ color: b.color }} />
                <span className="flex-1 truncate">{b.name}</span>
                <span className="font-mono text-[11px] text-ink-muted">{b.pageCount} pages</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
