import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { isInternalLink } from "@/lib/appRoute";

// Central, app-wide markdown renderer. GitHub-Flavored Markdown (tables, task
// lists, strikethrough, autolinks) via remark-gfm. Raw HTML is intentionally
// NOT enabled, so user content cannot inject markup — react-markdown escapes it.
const COMPONENTS: Components = {
  a: ({ node: _node, href, ...props }) => {
    // Internal app links navigate in-place via a hash change (no new tab).
    if (href && isInternalLink(href)) {
      return <a href={href} {...props} />;
    }
    // External links always open in a new tab and never leak referrer/opener.
    return <a href={href} {...props} target="_blank" rel="noopener noreferrer" />;
  },
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
