import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";

export function AccountMenu() {
  const { user, logout, changePassword } = useAuth();
  const [open, setOpen] = useState(false);
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
    <div className="mt-auto border-t border-border pt-3 flex flex-col gap-2">
      <span className="px-2 text-xs text-ink-muted truncate" title={user?.email}>{user?.email}</span>
      <div className="flex gap-2">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); setDone(false); }}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1">Change password</Button>
          </DialogTrigger>
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
        <Button variant="ghost" size="sm" onClick={() => logout()}>Log out</Button>
      </div>
    </div>
  );
}
