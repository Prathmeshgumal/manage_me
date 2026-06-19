import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthPage() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") await signup(email, password);
      else await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h1 className="font-display text-xl font-bold tracking-tight mb-1">MySchedule</h1>
        <p className="text-sm text-ink-muted mb-6">
          {mode === "login" ? "Sign in to your account" : "Create a new account"}
        </p>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Input
            type="email" placeholder="you@example.com" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password" placeholder="Password (min 8 characters)"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required minLength={8}
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <button
          type="button"
          className="mt-4 text-sm text-ink-muted hover:text-ink w-full text-center"
          onClick={() => { setError(null); setMode((m) => (m === "login" ? "signup" : "login")); }}
        >
          {mode === "login" ? "No account? Sign up" : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
