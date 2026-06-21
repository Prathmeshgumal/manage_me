import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects, useUpdateProject, useDeleteProject } from "@/hooks/useProjects";
import { useGithubStatus, useRepositories } from "@/hooks/useGithub";
import { useShelf } from "@/hooks/useLibrary";
import { RepoFileBrowser } from "@/components/github/RepoFileBrowser";
import { BookList } from "@/components/library/BookList";
import { cn } from "@/lib/utils";

const SWATCHES = ["#4FA3D1", "#E0B341", "#F5872B", "#F4404A", "#8A8A86", "#7C5CFC", "#3FB68B"];
const NONE = "none";

export function ProjectSettingsPage({ projectId, onBack, onDeleted, onOpenBook }: {
  projectId: string; onBack: () => void; onDeleted: () => void; onOpenBook: (bookId: string) => void;
}) {
  const { data: shelf } = useShelf(projectId);
  const { data: projects = [] } = useProjects();
  const project = projects.find((p) => p.id === projectId);
  const update = useUpdateProject();
  const del = useDeleteProject();

  const { data: status } = useGithubStatus();
  const hasInstalls = (status?.installations?.length ?? 0) > 0;
  const { data: repos = [] } = useRepositories(hasInstalls);

  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);
  useEffect(() => { if (project) { setName(project.name); setKey(project.key); setKeyError(null); } }, [project?.id]);

  function saveKey() {
    if (!project) return;
    const next = key.trim().toUpperCase();
    setKey(next);
    if (!next || next === project.key) { setKeyError(null); return; }
    if (!/^[A-Z0-9]{2,6}$/.test(next)) { setKeyError("2–6 letters or digits"); return; }
    setKeyError(null);
    update.mutate(
      { id: project.id, patch: { key: next } },
      { onError: () => { setKeyError("Key already in use"); setKey(project.key); } },
    );
  }

  if (!project) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <button className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink" onClick={onBack}>
          <ArrowLeft className="size-4" /> Back
        </button>
        <p className="mt-4 text-sm text-ink-muted">Project not found.</p>
      </div>
    );
  }

  const options = [...repos];
  if (project.githubRepoFullName && !options.some((r) => r.fullName === project.githubRepoFullName)) {
    options.unshift({ id: project.githubRepoId!, fullName: project.githubRepoFullName, private: false, installationId: project.githubInstallationId ?? 0 });
  }

  function setRepo(value: string) {
    if (value === NONE) {
      update.mutate({ id: project!.id, patch: { githubRepoId: null, githubRepoFullName: null, githubInstallationId: null } });
    } else {
      const r = options.find((o) => o.fullName === value);
      if (r) update.mutate({ id: project!.id, patch: { githubRepoId: r.id, githubRepoFullName: r.fullName, githubInstallationId: r.installationId } });
    }
  }

  const repo = project.githubRepoFullName;
  const [owner, repoName] = repo ? repo.split("/") : ["", ""];

  return (
    <div className="max-w-6xl p-6 flex flex-col gap-6">
      <button className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink w-fit" onClick={onBack}>
        <ArrowLeft className="size-4" /> Back to board
      </button>

      <div className="flex items-center gap-3">
        <span className="size-3 rounded-full" style={{ background: project.color }} />
        <h1 className="font-display text-2xl font-bold">Project settings</h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left: compact settings */}
        <div className="w-full lg:w-[340px] shrink-0 flex flex-col gap-6">
          {/* Name + color */}
          <section className="rounded-lg border border-border p-4 flex flex-col gap-3 bg-surface">
            <div className="font-mono text-xs uppercase tracking-wide text-ink-muted">Name</div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && name.trim() !== project.name && update.mutate({ id: project.id, patch: { name: name.trim() } })}
            />
            <div className="font-mono text-xs uppercase tracking-wide text-ink-muted mt-2">Task key</div>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              onBlur={saveKey}
              maxLength={6}
              className="font-mono w-32"
              aria-label="Project task key"
            />
            <p className={cn("text-xs", keyError ? "text-destructive" : "text-ink-muted")}>
              {keyError ?? `Task ids look like ${(key || project.key)}-001`}
            </p>
            <div className="font-mono text-xs uppercase tracking-wide text-ink-muted mt-2">Color</div>
            <div className="flex items-center gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  aria-label={`Color ${c}`}
                  onClick={() => update.mutate({ id: project.id, patch: { color: c } })}
                  className={cn("size-6 rounded-full border-2 transition-transform", project.color === c ? "border-ink scale-110" : "border-transparent")}
                  style={{ background: c }}
                />
              ))}
            </div>
          </section>

          {/* Repo */}
          <section className="rounded-lg border border-border p-4 flex flex-col gap-3 bg-surface">
            <div className="font-mono text-xs uppercase tracking-wide text-ink-muted">GitHub repository</div>
            {hasInstalls ? (
              <Select value={repo ?? NONE} onValueChange={setRepo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No repository</SelectItem>
                  {options.map((r) => <SelectItem key={r.fullName} value={r.fullName}>{r.fullName}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-ink-muted">Install the app on GitHub (My GitHub) to link a repository.</p>
            )}
          </section>

          {/* Library / Books */}
          <section className="rounded-lg border border-border p-4 flex flex-col gap-3 bg-surface">
            <div className="font-mono text-xs uppercase tracking-wide text-ink-muted">Books</div>
            {shelf ? (
              <BookList
                projectId={projectId}
                shelfId={shelf.id}
                books={shelf.books}
                variant="list"
                onOpenBook={onOpenBook}
              />
            ) : (
              <p className="text-xs text-ink-muted">Loading…</p>
            )}
          </section>

          {/* Danger */}
          <section className="rounded-lg border border-destructive/40 p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Delete project</div>
              <div className="text-xs text-ink-muted">Tasks are kept (unassigned).</div>
            </div>
            <Button variant="destructive" size="sm" onClick={() => del.mutate(project.id, { onSuccess: onDeleted })} disabled={del.isPending}>
              Delete
            </Button>
          </section>
        </div>

        {/* Right: repository files */}
        {repo && project.githubInstallationId ? (
          <section className="rounded-lg border border-border p-4 flex flex-col gap-3 bg-surface flex-1 min-w-0 w-full">
            <div className="font-mono text-xs uppercase tracking-wide text-ink-muted">Repository files</div>
            <RepoFileBrowser installationId={project.githubInstallationId} owner={owner} repo={repoName} />
          </section>
        ) : (
          <section className="rounded-lg border border-dashed border-border p-4 flex-1 min-w-0 w-full text-sm text-ink-muted">
            Link a GitHub repository to browse its files here.
          </section>
        )}
      </div>
    </div>
  );
}
