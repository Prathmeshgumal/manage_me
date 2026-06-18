import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Folder, FileText, ChevronRight } from "lucide-react";
import { useRepoContents } from "@/hooks/useGithub";

export function RepoFileBrowser({ installationId, owner, repo }: {
  installationId: number; owner: string; repo: string;
}) {
  const [path, setPath] = useState("");
  const { data, isLoading, isError } = useRepoContents({ installationId, owner, repo, path });

  const segments = path ? path.split("/") : [];
  const crumbTo = (i: number) => segments.slice(0, i + 1).join("/");

  return (
    <div className="flex flex-col gap-3">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm flex-wrap">
        <button className="font-mono hover:text-ink text-ink-muted" onClick={() => setPath("")}>{repo}</button>
        {segments.map((seg, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="size-3 text-ink-muted" />
            <button className="font-mono hover:text-ink text-ink-muted" onClick={() => setPath(crumbTo(i))}>{seg}</button>
          </span>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : isError || !data ? (
        <p className="text-sm text-ink-muted">Couldn't load this path.</p>
      ) : data.type === "dir" ? (
        <ul className="border border-border rounded-lg divide-y divide-border overflow-hidden">
          {data.entries.map((e) => (
            <li key={e.path}>
              <button
                onClick={() => setPath(e.path)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg"
              >
                {e.type === "dir"
                  ? <Folder className="size-4 text-priority-low" />
                  : <FileText className="size-4 text-ink-muted" />}
                <span className="font-mono">{e.name}</span>
              </button>
            </li>
          ))}
          {data.entries.length === 0 && <li className="px-3 py-2 text-xs text-ink-muted">Empty folder</li>}
        </ul>
      ) : data.isBinary ? (
        <p className="text-sm text-ink-muted">Binary file — no preview ({data.size} bytes).</p>
      ) : data.tooLarge ? (
        <p className="text-sm text-ink-muted">File too large to preview ({data.size} bytes).</p>
      ) : data.name.toLowerCase().endsWith(".md") ? (
        <div className="prose prose-sm max-w-none dark:prose-invert rounded-lg border border-border p-4">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.content}</ReactMarkdown>
        </div>
      ) : (
        <pre className="rounded-lg border border-border p-4 overflow-x-auto text-xs font-mono leading-relaxed">
          {data.content}
        </pre>
      )}
    </div>
  );
}
