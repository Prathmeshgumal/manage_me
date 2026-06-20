import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AccountSettings() {
  const { user, logout, changePassword } = useAuth();
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
    <section className="rounded-lg border border-border p-4 flex flex-col gap-4 bg-surface">
      <div className="font-mono text-xs uppercase tracking-wide text-ink-muted">Account</div>

      <div className="flex items-center gap-3">
        <span className="text-sm">Signed in as <b>{user?.email}</b></span>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => logout()}>Log out</Button>
      </div>

      <div className="border-t border-border" />

      <form onSubmit={onSubmit} className="flex flex-col gap-3 max-w-sm">
        <span className="text-sm font-medium">Change password</span>
        <Input type="password" placeholder="Current password" autoComplete="current-password"
          required value={current} onChange={(e) => setCurrent(e.target.value)} />
        <Input type="password" placeholder="New password (min 8)" autoComplete="new-password"
          required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
        {error && <p className="text-sm text-destructive">{error}</p>}
        {done && <p className="text-sm text-ink-muted">Password updated.</p>}
        <div>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Update password"}</Button>
        </div>
      </form>
    </section>
  );
}
