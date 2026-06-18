import { useState } from "react";
import { ArrowLeft, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShelf, useBook, useDeleteBook, useCreateBook } from "@/hooks/useLibrary";
import { BookList } from "@/components/library/BookList";
import { BookShelf } from "@/components/library/BookShelf";
import { randomBookColor } from "@/lib/bookColors";
import { PageList } from "@/components/library/PageList";
import { PageEditor } from "@/components/library/PageEditor";

type Nav = { level: "shelf" | "book" | "page"; bookId?: string; pageId?: string };

export function LibraryPage({ projectId, tab, initialBookId, onBack }: {
  projectId: string | null; tab: "shelves" | "books"; initialBookId?: string | null; onBack: () => void;
}) {
  const { data: shelf } = useShelf(projectId);
  const deleteBook = useDeleteBook(projectId);
  const createBook = useCreateBook(projectId);
  const [nav, setNav] = useState<Nav>(
    initialBookId ? { level: "book", bookId: initialBookId } : { level: "shelf" },
  );
  const { data: book } = useBook(nav.bookId ?? null);

  if (!shelf) return <div className="p-6 text-sm text-ink-muted">Loading library…</div>;

  return (
    <div className="max-w-6xl p-6 flex flex-col gap-6">
      <button className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink w-fit" onClick={onBack}>
        <ArrowLeft className="size-4" /> Back to board
      </button>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm flex-wrap">
        <button className="font-display font-semibold hover:underline" onClick={() => setNav({ level: "shelf" })}>{shelf.name}</button>
        {book && nav.level !== "shelf" && (
          <>
            <ChevronRight className="size-4 text-ink-muted" />
            <button className="hover:underline" onClick={() => setNav({ level: "book", bookId: book.id })}>{book.name}</button>
          </>
        )}
        {nav.level === "page" && book && (
          <>
            <ChevronRight className="size-4 text-ink-muted" />
            <span className="text-ink-muted">{book.pages.find((p) => p.id === nav.pageId)?.title}</span>
          </>
        )}
      </div>

      {nav.level === "shelf" && (
        tab === "shelves" ? (
          <div className="w-full lg:w-1/2 h-[74vh]">
            <BookShelf
              books={shelf.books}
              onOpenBook={(id) => setNav({ level: "book", bookId: id })}
              onAddBook={(name) => createBook.mutate({ shelfId: shelf.id, input: { name, color: randomBookColor() } })}
            />
          </div>
        ) : (
          <BookList projectId={projectId} shelfId={shelf.id} books={shelf.books}
            variant="list"
            onOpenBook={(id) => setNav({ level: "book", bookId: id })} />
        )
      )}

      {nav.level === "book" && book && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="font-display text-lg font-bold">{book.name}</span>
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => deleteBook.mutate(book.id, { onSuccess: () => setNav({ level: "shelf" }) })}>
              <Trash2 className="size-4" /> Delete book
            </Button>
          </div>
          <PageList bookId={book.id} pages={book.pages}
            onOpenPage={(pid) => setNav({ level: "page", bookId: book.id, pageId: pid })} />
        </div>
      )}

      {nav.level === "page" && nav.pageId && nav.bookId && (
        <PageEditor pageId={nav.pageId} bookId={nav.bookId}
          onDeleted={() => setNav({ level: "book", bookId: nav.bookId })} />
      )}
    </div>
  );
}
