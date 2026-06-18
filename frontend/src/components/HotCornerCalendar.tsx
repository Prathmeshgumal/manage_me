import { useEffect, useRef, useState } from "react";
import { Calendar } from "@/components/ui/calendar";

const CORNER = 56;      // px from the bottom-right corner that counts as "the corner"
const DELAY = 200;      // ms the cursor must linger before the calendar appears

export function HotCornerCalendar() {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (open) return; // while open, the popup manages its own dismissal
      const inCorner = e.clientX >= window.innerWidth - CORNER && e.clientY >= window.innerHeight - CORNER;
      if (inCorner) {
        if (timer.current === null) {
          timer.current = window.setTimeout(() => { setOpen(true); timer.current = null; }, DELAY);
        }
      } else {
        clearTimer();
      }
    }
    window.addEventListener("mousemove", onMove);
    return () => { window.removeEventListener("mousemove", onMove); clearTimer(); };
  }, [open]);

  if (!open) return null;

  const now = new Date();
  return (
    <div
      onMouseLeave={() => setOpen(false)}
      className="fixed bottom-4 right-4 z-50 origin-bottom-right rounded-xl border border-border bg-surface shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-4 slide-in-from-right-4"
    >
      <Calendar mode="single" selected={now} defaultMonth={now} className="rounded-xl" />
    </div>
  );
}
