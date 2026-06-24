import { useEffect, useRef, useState } from "react";
import { Link2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { routeToLink, type Route } from "@/lib/appRoute";

export function CopyLinkButton({
  route,
  className,
  label = "Copy link",
}: {
  route?: Route;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  async function onClick(e: React.MouseEvent) {
    e.stopPropagation();
    const link = route ? routeToLink(route) : window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — silently ignore.
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={copied ? "Copied" : label}
      className={cn(
        "inline-flex items-center justify-center rounded-md p-1.5 text-ink-muted hover:text-ink hover:bg-bg",
        className,
      )}
    >
      {copied ? <Check className="size-4 text-green-500" /> : <Link2 className="size-4" />}
    </button>
  );
}
