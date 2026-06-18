import { useState } from "react";
import { Plus } from "lucide-react";
import type { BookSummary } from "@/types";

// Shelf theme — colors only, so more themes can be added later.
type ShelfTheme = { frame: string; frameLight: string; back: string; plankFrom: string; plankTo: string };
const THEMES: Record<string, ShelfTheme> = {
  oak: { frame: "#6f4a28", frameLight: "#9a6a3a", back: "#2c2018", plankFrom: "#9a6a3a", plankTo: "#6f4a28" },
};
const theme = THEMES.oak;

const PER_ROW = 10;
const MIN_ROWS = 4;

function textOn(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#1A1A18" : "#FFFFFF";
}
function hash(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 997;
  return h;
}
const spineWidth = (id: string) => 22 + (hash(id) % 12); // 22–33px
const spineHeightPct = (id: string) => 78 + (hash(id + "h") % 18); // 78–95%

type Item = { kind: "book"; book: BookSummary } | { kind: "add" };

function BookSpine({ book, onOpen }: { book: BookSummary; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      title={`${book.name} · ${book.pageCount} page${book.pageCount === 1 ? "" : "s"}`}
      style={{ background: book.color, color: textOn(book.color), width: spineWidth(book.id), height: `${spineHeightPct(book.id)}%` }}
      className="self-end shrink-0 rounded-t-[3px] border-x border-black/25 shadow-md flex items-center justify-center transition-transform hover:-translate-y-1.5"
    >
      <span className="[writing-mode:vertical-rl] text-[10px] font-medium leading-none py-1.5 overflow-hidden whitespace-nowrap max-h-full">
        {book.name}
      </span>
    </button>
  );
}

function AddSpine({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Add book"
      style={{ width: 26, height: "70%" }}
      className="self-end shrink-0 rounded-t-[3px] border-2 border-dashed border-white/40 text-white/70 flex items-center justify-center hover:bg-white/10 hover:text-white"
    >
      <Plus className="size-4" />
    </button>
  );
}

export function BookShelf({ books, onOpenBook, onAddBook }: {
  books: BookSummary[]; onOpenBook: (id: string) => void; onAddBook: (name: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const items: Item[] = [...books.map((b) => ({ kind: "book" as const, book: b })), { kind: "add" as const }];
  const rows: Item[][] = [];
  for (let i = 0; i < items.length; i += PER_ROW) rows.push(items.slice(i, i + PER_ROW));
  while (rows.length < MIN_ROWS) rows.push([]);

  const submit = () => {
    if (name.trim()) onAddBook(name.trim());
    setName("");
    setAdding(false);
  };

  return (
    <div className="h-full rounded-lg p-2 shadow-inner" style={{ background: theme.frameLight, border: `5px solid ${theme.frame}` }}>
      <div className="h-full rounded flex flex-col overflow-hidden" style={{ background: theme.back }}>
        {rows.map((row, i) => (
          <div key={i} className="flex-1 min-h-0 flex flex-col justify-end">
            <div className="flex items-end gap-1.5 px-3 flex-1 min-h-0 overflow-hidden">
              {row.map((it) =>
                it.kind === "book" ? (
                  <BookSpine key={it.book.id} book={it.book} onOpen={() => onOpenBook(it.book.id)} />
                ) : adding ? (
                  <input
                    key="add-input"
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submit();
                      if (e.key === "Escape") { setName(""); setAdding(false); }
                    }}
                    onBlur={submit}
                    placeholder="Book name"
                    className="self-center w-32 rounded bg-white text-ink text-xs px-2 py-1 outline-none"
                  />
                ) : (
                  <AddSpine key="add" onClick={() => setAdding(true)} />
                ),
              )}
            </div>
            <div
              className="h-3 shrink-0"
              style={{ background: `linear-gradient(${theme.plankFrom}, ${theme.plankTo})`, boxShadow: "0 3px 6px rgba(0,0,0,0.45)" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
