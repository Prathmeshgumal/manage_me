import { useTheme } from "@/components/theme/ThemeProvider";

export default function App() {
  const { theme, toggle } = useTheme();
  return (
    <div className="min-h-screen p-8">
      <h1 className="font-display text-3xl font-bold">MySchedule</h1>
      <button
        className="font-mono text-sm mt-4 border border-border rounded-md px-3 py-1 hover:bg-surface"
        onClick={toggle}
      >
        theme: {theme}
      </button>
    </div>
  );
}
