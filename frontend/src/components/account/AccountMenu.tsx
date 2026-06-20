import { useState } from "react";
import { Settings, KeyRound, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export function AccountMenu() {
  const { user, logout, changePassword } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setDone(false); setBusy(true);
    try {
      await changePassword(current, next);
      setDone(true); setCurrent(""); setNext("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-auto border-t border-border pt-3">
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-ink-muted hover:text-ink hover:bg-bg"
            aria-label="Settings"
          >
            <Settings className="size-4 shrink-0" />
            <span className="truncate">Settings</span>
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-56 p-1.5">
          <div className="px-2 py-1.5 text-xs text-ink-muted truncate" title={user?.email}>
            {user?.email}
          </div>
          <div className="my-1 border-t border-border" />
          <button
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-bg text-left"
            onClick={() => { setMenuOpen(false); setError(null); setDone(false); setPwOpen(true); }}
          >
            <KeyRound className="size-4 shrink-0 text-ink-muted" /> Change password
          </button>
          <button
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-bg text-left"
            onClick={() => { setMenuOpen(false); logout(); }}
          >
            <LogOut className="size-4 shrink-0 text-ink-muted" /> Log out
          </button>
        </PopoverContent>
      </Popover>

      <Dialog open={pwOpen} onOpenChange={(o) => { setPwOpen(o); setError(null); setDone(false); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change password</DialogTitle></DialogHeader>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Input type="password" placeholder="Current password" autoComplete="current-password"
              required value={current} onChange={(e) => setCurrent(e.target.value)} />
            <Input type="password" placeholder="New password (min 8)" autoComplete="new-password"
              required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
            {error && <p className="text-sm text-destructive">{error}</p>}
            {done && <p className="text-sm text-ink-muted">Password updated.</p>}
            <DialogFooter>
              <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Update password"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
