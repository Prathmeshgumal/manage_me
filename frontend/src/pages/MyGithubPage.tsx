import { apiBase, useGithubStatus, useContributions, useDisconnectGithub } from "@/hooks/useGithub";
import { Button } from "@/components/ui/button";
import { ContributionsChart } from "@/components/github/ContributionsChart";

export function MyGithubPage() {
  const { data: status } = useGithubStatus();
  const disconnect = useDisconnectGithub();
  const connected = !!status?.user;
  const { data: calendar, isLoading, isError } = useContributions(connected);

  return (
    <div className="max-w-6xl mx-auto p-6 flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold">My GitHub</h1>

      {/* Account */}
      <section className="rounded-lg border border-border p-4 flex flex-col gap-3 bg-surface">
        <div className="font-mono text-xs uppercase tracking-wide text-ink-muted">Account</div>
        {connected ? (
          <div className="flex items-center gap-3">
            <img src={status!.user!.avatarUrl} alt="" className="size-8 rounded-full" />
            <span className="text-sm">Connected as <b>{status!.user!.login}</b></span>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => disconnect.mutate()}>Disconnect</Button>
          </div>
        ) : (
          <a href={`${apiBase}/github/authorize`}>
            <Button>Authorize GitHub</Button>
          </a>
        )}
      </section>

      {/* Contributions (left) + Installations (right) */}
      {connected && (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <section className="rounded-lg border border-border p-4 bg-surface flex-1 min-w-0 w-full">
            {isLoading ? (
              <p className="text-sm text-ink-muted">Loading contributions…</p>
            ) : isError || !calendar ? (
              <p className="text-sm text-ink-muted">Couldn't load contributions. Try disconnecting and reconnecting.</p>
            ) : (
              <ContributionsChart calendar={calendar} />
            )}
          </section>

          <section className="rounded-lg border border-border p-4 flex flex-col gap-3 bg-surface w-full lg:w-80 shrink-0">
            <div className="font-mono text-xs uppercase tracking-wide text-ink-muted">Installations</div>
            <p className="text-sm text-ink-muted">
              Install the app on your account or an organization. On GitHub you choose the org and either all
              repositories or only selected ones.
            </p>
            <a href={`${apiBase}/github/install`}>
              <Button variant="outline" className="w-full">Install / Configure on GitHub</Button>
            </a>
            <ul className="text-sm flex flex-col gap-1">
              {(status?.installations ?? []).map((i) => (
                <li key={i.installationId} className="flex items-center gap-2">
                  <span className="size-2 rounded-sm bg-ink shrink-0" />
                  <span className="truncate">{i.accountLogin}</span>
                  <span className="font-mono text-[11px] text-ink-muted">{i.accountType}</span>
                  <span className="ml-auto font-mono text-[11px] text-ink-muted">{i.repositorySelection}</span>
                </li>
              ))}
              {(status?.installations ?? []).length === 0 && (
                <li className="text-ink-muted text-xs">No installations yet.</li>
              )}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
