import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateProject } from "@/hooks/useProjects";
import { cn } from "@/lib/utils";

const SWATCHES = ["#4FA3D1", "#E0B341", "#F5872B", "#F4404A", "#8A8A86", "#7C5CFC", "#3FB68B"];

export function CreateProjectDialog({ open, onOpenChange }: {
  open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const create = useCreateProject();
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);

  function submit() {
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), color },
      { onSuccess: () => { setName(""); setColor(SWATCHES[0]); onOpenChange(false); } },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">New project</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <div>
          <div className="font-mono text-xs uppercase tracking-wide text-ink-muted mb-2">Color</div>
          <div className="flex items-center gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                onClick={() => setColor(c)}
                className={cn(
                  "size-6 rounded-full border-2 transition-transform",
                  color === c ? "border-ink scale-110" : "border-transparent",
                )}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <Button onClick={submit} disabled={!name.trim() || create.isPending}>
          Create project
        </Button>
      </DialogContent>
    </Dialog>
  );
}
