// A palette of vivid "book" colors; each new book gets a random one.
const BOOK_COLORS = [
  "#C0392B", "#E67E22", "#F1C40F", "#27AE60", "#16A085",
  "#2980B9", "#8E44AD", "#D35400", "#2C3E50", "#E74C3C",
  "#1ABC9C", "#9B59B6", "#F39C12", "#3498DB", "#1F8A4C",
];

export function randomBookColor(): string {
  return BOOK_COLORS[Math.floor(Math.random() * BOOK_COLORS.length)];
}
