import type { BookSummary } from "@/types";

const PER_ROW = 5;

// Readable text color on a given spine color (luminance threshold).
function textOn(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#1A1A18" : "#FFFFFF";
}

// Deterministic slight height variation so the shelf looks natural.
function spineHeight(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 997;
  return 150 + (h % 44); // 150–193px
}

function Spine({ book, onClick }: { book: BookSummary; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={`${book.name} · ${book.pageCount} page${book.pageCount === 1 ? "" : "s"}`}
      style={{ background: book.color, height: spineHeight(book.id), color: textOn(book.color) }}
      className="w-8 shrink-0 rounded-t-[3px] border-x border-black/15 shadow-md flex items-center justify-center transition-transform hover:-translate-y-1.5"
    >
      <span className="[writing-mode:vertical-rl] text-[11px] font-medium leading-none py-2 max-h-full overflow-hidden text-ellipsis whitespace-nowrap">
        {book.name}
      </span>
    </button>
  );
}

export function BookShelf({ books, onOpenBook }: { books: BookSummary[]; onOpenBook: (id: string) => void }) {
  const rows: BookSummary[][] = [];
  for (let i = 0; i < books.length; i += PER_ROW) rows.push(books.slice(i, i + PER_ROW));
  if (rows.length === 0) rows.push([]);

  return (
    <div className="rounded-lg border border-border bg-bg p-3 flex flex-col">
      {rows.map((row, i) => (
        <div key={i}>
          <div className="flex items-end justify-start gap-1.5 min-h-[200px] px-2">
            {row.length === 0 ? (
              <span className="self-center text-xs text-ink-muted">Empty shelf</span>
            ) : (
              row.map((b) => <Spine key={b.id} book={b} onClick={() => onOpenBook(b.id)} />)
            )}
          </div>
          {/* wooden plank */}
          <div
            className="h-2.5 rounded-sm shadow-[0_3px_5px_rgba(0,0,0,0.35)]"
            style={{ background: "linear-gradient(#8a6648,#6f4f33)" }}
          />
        </div>
      ))}
    </div>
  );
}
