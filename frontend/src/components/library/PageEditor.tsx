import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { usePage, useUpdatePage, useDeletePage } from "@/hooks/useLibrary";

export function PageEditor({ pageId, bookId, onDeleted }: {
  pageId: string; bookId: string; onDeleted: () => void;
}) {
  const { data: page, isLoading } = usePage(pageId);
  const update = useUpdatePage(bookId);
  const del = useDeletePage(bookId);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (page) { setTitle(page.title); setContent(page.content); setEditing(false); }
  }, [page?.id]);

  if (isLoading || !page) return <p className="text-sm text-ink-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Input
          className="font-display text-lg"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title.trim() !== page.title && update.mutate({ id: page.id, patch: { title: title.trim() } })}
        />
        <Button variant="ghost" size="icon" aria-label="Delete page"
          onClick={() => del.mutate(page.id, { onSuccess: onDeleted })}>
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-wide text-ink-muted">Content</span>
          {!editing && (
            <Button variant="ghost" size="sm" className="gap-1 h-7" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" /> Edit
            </Button>
          )}
        </div>
        {editing ? (
          <div className="flex flex-col gap-2">
            <Textarea autoFocus className="min-h-64 font-mono text-sm" placeholder="Write markdown…"
              value={content} onChange={(e) => setContent(e.target.value)} />
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setContent(page.content); setEditing(false); }}>Cancel</Button>
              <Button size="sm" onClick={() => update.mutate({ id: page.id, patch: { content } }, { onSuccess: () => setEditing(false) })}>Save</Button>
            </div>
          </div>
        ) : content.trim() ? (
          <div className="prose prose-sm max-w-none dark:prose-invert rounded-lg border border-border p-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        ) : (
          <button onClick={() => setEditing(true)}
            className="text-left text-sm text-ink-muted rounded-lg border border-dashed border-border p-4 hover:text-ink hover:border-ink/40">
            Empty page — click to write.
          </button>
        )}
      </div>
    </div>
  );
}
