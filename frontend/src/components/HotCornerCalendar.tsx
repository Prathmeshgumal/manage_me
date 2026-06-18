import { useEffect, useRef, useState } from "react";
import { Calendar } from "@/components/ui/calendar";

const CORNER = 56;      // px from the bottom-right corner that counts as "the corner"
const DELAY = 200;      // ms the cursor must linger before the calendar appears

export function HotCornerCalendar() {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  // Arm the reveal while the cursor lingers in the corner.
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (open) return;
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

  // Once open, dismiss only when the user clicks outside the calendar.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  if (!open) return null;

  const now = new Date();
  return (
    <div
      ref={popupRef}
      className="fixed bottom-4 right-4 z-50 origin-bottom-right rounded-xl border border-border bg-surface shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-4 slide-in-from-right-4"
    >
      <Calendar mode="single" selected={now} defaultMonth={now} className="rounded-xl" />
    </div>
  );
}
