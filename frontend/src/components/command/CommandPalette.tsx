import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { Task } from "@/types";

export type PaletteActions = {
  newTask: () => void;
  board: () => void;
  list: () => void;
  groupStatus: () => void;
  groupPriority: () => void;
  toggleTheme: () => void;
};

export function CommandPalette({ open, onOpenChange, actions, tasks, onOpenTask }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  actions: PaletteActions; tasks: Task[]; onOpenTask: (t: Task) => void;
}) {
  const run = (fn: () => void) => { fn(); onOpenChange(false); };
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search tasks…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(actions.newTask)}>New task</CommandItem>
          <CommandItem onSelect={() => run(actions.board)}>Go to Board</CommandItem>
          <CommandItem onSelect={() => run(actions.list)}>Go to List</CommandItem>
          <CommandItem onSelect={() => run(actions.groupStatus)}>Group by status</CommandItem>
          <CommandItem onSelect={() => run(actions.groupPriority)}>Group by priority</CommandItem>
          <CommandItem onSelect={() => run(actions.toggleTheme)}>Toggle theme</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Tasks">
          {tasks.map((t) => (
            <CommandItem key={t.id} value={`${t.identifier} ${t.title}`} onSelect={() => run(() => onOpenTask(t))}>
              <span className="font-mono text-[11px] text-ink-muted mr-2">{t.identifier}</span>
              {t.title}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
