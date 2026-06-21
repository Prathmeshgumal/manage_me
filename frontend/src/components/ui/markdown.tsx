import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// Central, app-wide markdown renderer. GitHub-Flavored Markdown (tables, task
// lists, strikethrough, autolinks) via remark-gfm. Raw HTML is intentionally
// NOT enabled, so user content cannot inject markup — react-markdown escapes it.
const COMPONENTS: Components = {
  // Links always open in a new tab and never leak the referrer/opener.
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("markdown-body prose prose-sm max-w-none break-words", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
