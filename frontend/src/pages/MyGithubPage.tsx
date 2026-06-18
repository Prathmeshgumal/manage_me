import { useGithubStatus, useContributions } from "@/hooks/useGithub";
import { ContributionsChart } from "@/components/github/ContributionsChart";

export function MyGithubPage({ onGoToSettings }: { onGoToSettings: () => void }) {
  const { data: status } = useGithubStatus();
  const connected = !!status?.user;
  const { data: calendar, isLoading, isError } = useContributions(connected);

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold">My GitHub</h1>
      {!connected ? (
        <p className="text-sm text-ink-muted">
          Not connected.{" "}
          <button className="underline" onClick={onGoToSettings}>Connect GitHub</button> to see your contributions.
        </p>
      ) : isLoading ? (
        <p className="text-sm text-ink-muted">Loading contributions…</p>
      ) : isError || !calendar ? (
        <p className="text-sm text-ink-muted">Couldn't load contributions. Try reconnecting in settings.</p>
      ) : (
        <section className="rounded-lg border border-border p-4 bg-surface">
          <ContributionsChart calendar={calendar} />
        </section>
      )}
    </div>
  );
}
