import { cn } from "@/lib/utils";

// Shared palette, consistent with project colors.
const DEFAULT_SWATCHES = [
  "#4FA3D1", "#E0B341", "#F5872B", "#F4404A",
  "#EC4899", "#7C5CFC", "#3FB68B", "#8A8A86",
];
const RAINBOW = "conic-gradient(from 90deg, #ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #6366f1, #ec4899, #ef4444)";

/** Swatch palette + a custom-color picker. Returns a hex string via onChange. */
export function ColorPicker({ value, onChange, swatches = DEFAULT_SWATCHES, className }: {
  value: string;
  onChange: (hex: string) => void;
  swatches?: string[];
  className?: string;
}) {
  const norm = value.toLowerCase();
  const isCustom = !swatches.some((c) => c.toLowerCase() === norm);
  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {swatches.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Color ${c}`}
          onClick={() => onChange(c)}
          className={cn(
            "size-7 rounded-full border-2 transition-transform hover:scale-110",
            norm === c.toLowerCase() ? "border-ink scale-110" : "border-transparent",
          )}
          style={{ background: c }}
        />
      ))}
      {/* Custom color: rainbow hint until a non-preset color is chosen, then shows it. */}
      <label
        title="Custom color"
        className={cn(
          "relative size-7 rounded-full border-2 cursor-pointer transition-transform hover:scale-110",
          isCustom ? "border-ink scale-110" : "border-transparent",
        )}
        style={{ background: isCustom ? value : RAINBOW }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 size-full opacity-0 cursor-pointer"
          aria-label="Pick a custom color"
        />
      </label>
    </div>
  );
}
