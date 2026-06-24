import { useRef, useState } from "react";
import {
  Heading, Bold, Italic, TextQuote, Code, Link as LinkIcon,
  ListOrdered, List, ListChecks,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/ui/markdown";
import {
  type TextState, type EditResult,
  wrapInline, toggleCode, insertLink, heading, quote,
  unorderedList, taskList, orderedList, linkOnPaste,
} from "@/components/ui/markdown-commands";
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

function ToolbarButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // Keep textarea focus/selection when clicking the toolbar.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="p-1.5 rounded text-ink-muted hover:text-ink hover:bg-bg"
    >
      {children}
    </button>
  );
}

/**
 * GitHub-style markdown input with Preview / Write tabs and a formatting
 * toolbar. Preview-first: with existing content it opens on the rendered view,
 * and the user opts into editing via the Write tab. Empty content starts on
 * Write. Override with `defaultMode`.
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
  const ref = useRef<HTMLTextAreaElement>(null);

  // Run a pure transform against the live textarea selection, then restore the
  // resulting selection so typing continues where the user expects.
  function apply(fn: (s: TextState) => EditResult) {
    const el = ref.current;
    if (!el) return;
    const result = fn({ value, selectionStart: el.selectionStart, selectionEnd: el.selectionEnd });
    onChange(result.value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const el = ref.current;
    if (!el) return;
    const pasted = e.clipboardData.getData("text");
    const result = linkOnPaste(
      { value, selectionStart: el.selectionStart, selectionEnd: el.selectionEnd },
      pasted,
    );
    if (!result) return; // no selection or not a URL → let the browser paste normally
    e.preventDefault();
    onChange(result.value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  }

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
        <>
          <div className="flex items-center gap-0.5 border-b border-border px-2 py-1">
            <ToolbarButton label="Heading" onClick={() => apply(heading)}><Heading className="size-4" /></ToolbarButton>
            <ToolbarButton label="Bold" onClick={() => apply((s) => wrapInline(s, "**", "**", "bold text"))}><Bold className="size-4" /></ToolbarButton>
            <ToolbarButton label="Italic" onClick={() => apply((s) => wrapInline(s, "_", "_", "italic text"))}><Italic className="size-4" /></ToolbarButton>
            <ToolbarButton label="Quote" onClick={() => apply(quote)}><TextQuote className="size-4" /></ToolbarButton>
            <ToolbarButton label="Code" onClick={() => apply(toggleCode)}><Code className="size-4" /></ToolbarButton>
            <ToolbarButton label="Link" onClick={() => apply(insertLink)}><LinkIcon className="size-4" /></ToolbarButton>
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            <ToolbarButton label="Numbered list" onClick={() => apply(orderedList)}><ListOrdered className="size-4" /></ToolbarButton>
            <ToolbarButton label="Bulleted list" onClick={() => apply(unorderedList)}><List className="size-4" /></ToolbarButton>
            <ToolbarButton label="Task list" onClick={() => apply(taskList)}><ListChecks className="size-4" /></ToolbarButton>
          </div>
          <Textarea
            ref={ref}
            autoFocus={autoFocus}
            className={cn("border-0 rounded-none shadow-none focus-visible:ring-0 font-mono text-sm", minHeight)}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={onPaste}
          />
        </>
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
