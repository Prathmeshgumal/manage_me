import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, ChevronDown, Trash2, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShelf, useBook, useDeleteBook, useCreateBook, useOrphanShelves, useShelfById, usePage } from "@/hooks/useLibrary";
import { BookList } from "@/components/library/BookList";
import { BookShelf } from "@/components/library/BookShelf";
import { randomBookColor } from "@/lib/bookColors";
import { PageList } from "@/components/library/PageList";
import { PageEditor } from "@/components/library/PageEditor";
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";
import { type Route } from "@/lib/appRoute";

type Nav = {
  level: "shelf" | "orphan" | "book" | "page";
  bookId?: string;
  pageId?: string;
  orphanShelfId?: string;
};

function navToRoute(nav: Nav): Route {
  if (nav.level === "page" && nav.pageId) return { kind: "page", id: nav.pageId };
  if (nav.level === "book" && nav.bookId) return { kind: "book", id: nav.bookId };
  return { kind: "library" };
}

export function LibraryPage({ projectId, target, onBack, onRoute }: {
  projectId: string | null; target?: Route | null; onBack: () => void; onRoute?: (route: Route) => void;
}) {
  const isGeneral = projectId === null;
  const { data: shelf } = useShelf(projectId);
  const { data: orphans = [] } = useOrphanShelves(isGeneral);
  const deleteBook = useDeleteBook(projectId);
  const createBook = useCreateBook(projectId);
  const [nav, setNav] = useState<Nav>(
    target?.kind === "book" ? { level: "book", bookId: target.id } : { level: "shelf" },
  );
  const [showList, setShowList] = useState(false);
  const { data: book } = useBook(nav.bookId ?? null);
  const { data: orphanShelf } = useShelfById(nav.orphanShelfId ?? null);

  // A `page` deep-link only knows the page id; fetch it to learn its book.
  const { data: targetPage } = usePage(target?.kind === "page" ? target.id : null);

  // Apply an incoming navigation command (rail click / deep link / hashchange).
  useEffect(() => {
    if (target?.kind === "book") setNav({ level: "book", bookId: target.id });
    else if (target?.kind === "library") setNav({ level: "shelf" });
    // `page` targets are applied once `targetPage` resolves (below).
  }, [target]);

  useEffect(() => {
    if (targetPage) setNav({ level: "page", bookId: targetPage.bookId, pageId: targetPage.id });
  }, [targetPage]);

  // Report the current location upward so the address bar/URL stays in sync.
  useEffect(() => {
    onRoute?.(navToRoute(nav));
  }, [nav, onRoute]);

  if (!shelf) return <div className="p-6 text-sm text-ink-muted">Loading library…</div>;

  const backFromBook = (): Nav =>
    nav.orphanShelfId ? { level: "orphan", orphanShelfId: nav.orphanShelfId } : { level: "shelf" };

  return (
    <div className="max-w-6xl p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <button className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink w-fit" onClick={onBack}>
          <ArrowLeft className="size-4" /> Back to board
        </button>
        {nav.level === "shelf" && <CopyLinkButton />}
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm flex-wrap">
        <button className="font-display font-semibold hover:underline" onClick={() => setNav({ level: "shelf" })}>{shelf.name}</button>
        {nav.orphanShelfId && orphanShelf && (
          <>
            <ChevronRight className="size-4 text-ink-muted" />
            <button className="hover:underline" onClick={() => setNav({ level: "orphan", orphanShelfId: nav.orphanShelfId })}>{orphanShelf.name}</button>
          </>
        )}
        {book && (nav.level === "book" || nav.level === "page") && (
          <>
            <ChevronRight className="size-4 text-ink-muted" />
            <button className="hover:underline" onClick={() => setNav({ level: "book", bookId: book.id, orphanShelfId: nav.orphanShelfId })}>{book.name}</button>
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
        <div className="flex flex-col lg:flex-row gap-6 items-stretch min-h-[74vh]">
          <div className="flex-1 min-w-0 w-full flex flex-col gap-1.5">
            <div className="flex justify-end">
              <button
                onClick={() => setShowList((s) => !s)}
                aria-label={showList ? "Hide book list" : "Show book list"}
                title={showList ? "Hide book list" : "Show book list"}
                className="rounded-md border border-border bg-surface text-ink-muted hover:text-ink p-1.5"
              >
                <ChevronDown className={`size-4 transition-transform ${showList ? "rotate-180" : ""}`} />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <BookShelf
                books={shelf.books}
                onOpenBook={(id) => setNav({ level: "book", bookId: id })}
                onAddBook={(name) => createBook.mutate({ shelfId: shelf.id, input: { name, color: randomBookColor() } })}
              />
            </div>
          </div>
          <div className="flex-1 min-w-0 w-full overflow-auto flex flex-col gap-6">
            {showList && (
              <BookList projectId={projectId} shelfId={shelf.id} books={shelf.books}
                variant="list"
                onOpenBook={(id) => setNav({ level: "book", bookId: id })} />
            )}
            {isGeneral && orphans.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="font-mono text-xs uppercase tracking-wide text-ink-muted">Archived project shelves</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {orphans.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setNav({ level: "orphan", orphanShelfId: o.id })}
                      title={o.name}
                      className="aspect-square rounded-lg border border-border bg-surface hover:bg-bg flex flex-col items-center justify-center gap-1 p-2 text-center"
                    >
                      <Library className="size-6 text-ink-muted" />
                      <span className="text-xs font-medium truncate w-full">{o.name}</span>
                      <span className="font-mono text-[10px] text-ink-muted">{o.bookCount} book{o.bookCount === 1 ? "" : "s"}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {nav.level === "orphan" && orphanShelf && (
        orphanShelf.books.length === 0 ? (
          <p className="text-sm text-ink-muted">No books in this shelf.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {orphanShelf.books.map((b) => (
              <button
                key={b.id}
                onClick={() => setNav({ level: "book", bookId: b.id, orphanShelfId: nav.orphanShelfId })}
                className="rounded-lg border border-border bg-surface hover:bg-bg p-4 text-left flex flex-col gap-1.5"
              >
                <span className="size-3 rounded-sm" style={{ background: b.color }} />
                <span className="text-sm font-medium truncate">{b.name}</span>
                <span className="font-mono text-[11px] text-ink-muted">{b.pageCount} page{b.pageCount === 1 ? "" : "s"}</span>
              </button>
            ))}
          </div>
        )
      )}

      {nav.level === "book" && book && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="font-display text-lg font-bold">{book.name}</span>
              <CopyLinkButton route={{ kind: "book", id: book.id }} />
            </div>
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => deleteBook.mutate(book.id, { onSuccess: () => setNav(backFromBook()) })}>
              <Trash2 className="size-4" /> Delete book
            </Button>
          </div>
          <PageList bookId={book.id} pages={book.pages}
            onOpenPage={(pid) => setNav({ level: "page", bookId: book.id, pageId: pid, orphanShelfId: nav.orphanShelfId })} />
        </div>
      )}

      {nav.level === "page" && nav.pageId && nav.bookId && (
        <PageEditor pageId={nav.pageId} bookId={nav.bookId}
          onDeleted={() => setNav({ level: "book", bookId: nav.bookId, orphanShelfId: nav.orphanShelfId })} />
      )}
    </div>
  );
}
