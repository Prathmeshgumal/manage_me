import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/ui/markdown";
import { cn } from "@/lib/utils";

function Tab({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 text-xs rounded-md",
        active ? "bg-bg font-medium text-ink" : "text-ink-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/**
 * GitHub-style markdown input with Preview / Write tabs. Used everywhere users
 * author rich text. Preview-first: with existing content it opens on the
 * rendered view, and the user opts into editing via the Write tab. Empty
 * content starts on Write (nothing to preview yet). Override with `defaultMode`.
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Write markdown…",
  autoFocus,
  minHeight = "min-h-48",
  className,
  defaultMode,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  minHeight?: string;
  className?: string;
  defaultMode?: "write" | "preview";
}) {
  const [mode, setMode] = useState<"write" | "preview">(defaultMode ?? (value.trim() ? "preview" : "write"));
  return (
    <div className={cn("rounded-md border border-border overflow-hidden bg-surface", className)}>
      <div className="flex items-center gap-1 border-b border-border px-2 py-1">
        <Tab active={mode === "preview"} onClick={() => setMode("preview")}>Preview</Tab>
        <Tab active={mode === "write"} onClick={() => setMode("write")}>Write</Tab>
        <a
          href="https://docs.github.com/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs text-ink-muted hover:text-ink"
        >
          Markdown supported
        </a>
      </div>
      {mode === "write" ? (
        <Textarea
          autoFocus={autoFocus}
          className={cn("border-0 rounded-none shadow-none focus-visible:ring-0 font-mono text-sm", minHeight)}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className={cn("p-3 overflow-auto", minHeight)}>
          {value.trim() ? (
            <Markdown>{value}</Markdown>
          ) : (
            <p className="text-sm text-ink-muted">Nothing to preview.</p>
          )}
        </div>
      )}
    </div>
  );
}
