import { TodosBoard } from "@/components/todo/TodosBoard";

export function ListsPage() {
  return (
    <div className="p-2">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Lists</h1>
      </div>
      <TodosBoard />
    </div>
  );
}
