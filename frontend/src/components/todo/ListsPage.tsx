import { TodosBoard } from "@/components/todo/TodosBoard";
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";

export function ListsPage() {
  return (
    <div className="p-2">
      <div className="flex items-center gap-1 mb-6">
        <h1 className="font-display text-2xl font-bold">Lists</h1>
        <CopyLinkButton />
      </div>
      <TodosBoard />
    </div>
  );
}
