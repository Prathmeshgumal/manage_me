import { useState } from "react";
import { Plus } from "lucide-react";
import type { BookSummary } from "@/types";

// Shelf theme — colors only, so more themes can be added later.
type ShelfTheme = { frame: string; frameLight: string; back: string; plankFrom: string; plankTo: string };
const THEMES: Record<string, ShelfTheme> = {
  oak: { frame: "#6f4a28", frameLight: "#9a6a3a", back: "#2c2018", plankFrom: "#9a6a3a", plankTo: "#6f4a28" },
};
const theme = THEMES.oak;

const PER_ROW = 9;
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
const flatWidth = (id: string) => 58 + (hash(id + "f") % 20); // 58–77px

type Slot = { type: "spine"; book: BookSummary } | { type: "pile"; books: BookSummary[] };

// Group a row's books: occasionally pile 2–3 flat books, otherwise upright spines.
function groupRow(books: BookSummary[]): Slot[] {
  const slots: Slot[] = [];
  let i = 0;
  while (i < books.length) {
    const b = books[i];
    const remaining = books.length - i;
    if (remaining >= 2 && hash(b.id) % 3 === 0) {
      const size = Math.min(remaining, 2 + (hash(b.id + "s") % 2)); // 2–3
      slots.push({ type: "pile", books: books.slice(i, i + size) });
      i += size;
    } else {
      slots.push({ type: "spine", book: b });
      i += 1;
    }
  }
  return slots;
}

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

function BookPile({ books, onOpen }: { books: BookSummary[]; onOpen: (id: string) => void }) {
  return (
    <div className="self-end shrink-0 flex flex-col gap-0.5">
      {books.map((b) => (
        <button
          key={b.id}
          onClick={() => onOpen(b.id)}
          title={`${b.name} · ${b.pageCount} page${b.pageCount === 1 ? "" : "s"}`}
          style={{ background: b.color, color: textOn(b.color), width: flatWidth(b.id) }}
          className="h-4 rounded-[2px] border border-black/25 shadow-sm flex items-center px-1.5 transition-[filter] hover:brightness-110"
        >
          <span className="text-[9px] font-medium leading-none truncate">{b.name}</span>
        </button>
      ))}
    </div>
  );
}

function AddSpine({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Add book"
      style={{ width: 26, height: "68%" }}
      className="self-end shrink-0 rounded-t-[3px] border-2 border-dashed border-white/40 text-white/70 flex items-center justify-center hover:bg-white/10 hover:text-white"
    >
      <Plus className="size-4" />
    </button>
  );
}

export function BookShelf({ books, onOpenBook, onAddBook }: {
  books: BookSummary[]; onOpenBook: (id: string) => void; onAddBook: (name: string) => void;
}) {
  const [addingRow, setAddingRow] = useState<number | null>(null);
  const [name, setName] = useState("");

  const rows: BookSummary[][] = [];
  for (let i = 0; i < books.length; i += PER_ROW) rows.push(books.slice(i, i + PER_ROW));
  while (rows.length < MIN_ROWS) rows.push([]);

  const submit = () => {
    if (name.trim()) onAddBook(name.trim());
    setName("");
    setAddingRow(null);
  };

  return (
    <div className="h-full rounded-lg p-2 shadow-inner" style={{ background: theme.frameLight, border: `5px solid ${theme.frame}` }}>
      <div className="h-full rounded flex flex-col overflow-hidden" style={{ background: theme.back }}>
        {rows.map((rowBooks, ri) => (
          <div key={ri} className="flex-1 min-h-0 flex flex-col justify-end">
            <div className="flex items-end gap-1.5 px-3 flex-1 min-h-0 overflow-hidden">
              {groupRow(rowBooks).map((s) =>
                s.type === "spine" ? (
                  <BookSpine key={s.book.id} book={s.book} onOpen={() => onOpenBook(s.book.id)} />
                ) : (
                  <BookPile key={s.books[0].id} books={s.books} onOpen={onOpenBook} />
                ),
              )}
              {addingRow === ri ? (
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                    if (e.key === "Escape") { setName(""); setAddingRow(null); }
                  }}
                  onBlur={submit}
                  placeholder="Book name"
                  className="self-center w-32 rounded bg-white text-ink text-xs px-2 py-1 outline-none"
                />
              ) : (
                <AddSpine onClick={() => { setName(""); setAddingRow(ri); }} />
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
