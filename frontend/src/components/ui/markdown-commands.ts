// Pure text transforms for the markdown toolbar. Each takes the current textarea
// state (value + selection) and returns the new value plus where the selection
// should land, so the editor can restore focus naturally after applying.
//
// All commands toggle: applying one to already-formatted text removes the
// formatting instead of stacking it.

export interface TextState {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export type EditResult = TextState;

const URL_RE = /^https?:\/\/\S+$/;

export function isUrl(text: string): boolean {
  return URL_RE.test(text.trim());
}

/** Wrap the selection with `before`/`after`, or unwrap if it's already wrapped
 *  (markers inside or immediately surrounding the selection). With no selection,
 *  insert a placeholder and select it so the user can type over it. */
export function wrapInline(s: TextState, before: string, after: string, placeholder: string): EditResult {
  const { value, selectionStart, selectionEnd } = s;
  const selected = value.slice(selectionStart, selectionEnd);

  // Unwrap: markers are part of the selection.
  if (
    selected.length >= before.length + after.length &&
    selected.startsWith(before) &&
    selected.endsWith(after)
  ) {
    const inner = selected.slice(before.length, selected.length - after.length);
    const next = value.slice(0, selectionStart) + inner + value.slice(selectionEnd);
    return { value: next, selectionStart, selectionEnd: selectionStart + inner.length };
  }

  // Unwrap: markers sit just outside the selection.
  const outerBefore = value.slice(Math.max(0, selectionStart - before.length), selectionStart);
  const outerAfter = value.slice(selectionEnd, selectionEnd + after.length);
  if (selected.length > 0 && outerBefore === before && outerAfter === after) {
    const next = value.slice(0, selectionStart - before.length) + selected + value.slice(selectionEnd + after.length);
    const start = selectionStart - before.length;
    return { value: next, selectionStart: start, selectionEnd: start + selected.length };
  }

  // Wrap.
  const inner = selected || placeholder;
  const next = value.slice(0, selectionStart) + before + inner + after + value.slice(selectionEnd);
  const start = selectionStart + before.length;
  return { value: next, selectionStart: start, selectionEnd: start + inner.length };
}

/** Inline code for single-line selections, a fenced block for multi-line. */
export function toggleCode(s: TextState): EditResult {
  const { value, selectionStart, selectionEnd } = s;
  const selected = value.slice(selectionStart, selectionEnd);
  if (selected.includes("\n")) {
    return wrapInline(s, "```\n", "\n```", "code");
  }
  return wrapInline(s, "`", "`", "code");
}

/** `[text](url)` — selection becomes the link text; the url is selected so the
 *  user can paste/type it immediately. Toggling an existing `[text](url)` (when
 *  the selection covers it) unwraps it back to plain `text`. */
export function insertLink(s: TextState): EditResult {
  const { value, selectionStart, selectionEnd } = s;
  const selected = value.slice(selectionStart, selectionEnd);

  // Unwrap a fully-selected markdown link back to its text.
  const linkMatch = /^\[([^\]]*)\]\([^)]*\)$/.exec(selected);
  if (linkMatch) {
    const text = linkMatch[1];
    const next = value.slice(0, selectionStart) + text + value.slice(selectionEnd);
    return { value: next, selectionStart, selectionEnd: selectionStart + text.length };
  }

  const text = selected || "text";
  const urlPlaceholder = "url";
  const snippet = `[${text}](${urlPlaceholder})`;
  const next = value.slice(0, selectionStart) + snippet + value.slice(selectionEnd);
  const urlStart = selectionStart + text.length + 3; // "[" + text + "](" => +1 +len +2
  return { value: next, selectionStart: urlStart, selectionEnd: urlStart + urlPlaceholder.length };
}

/** Expand the selection to whole lines, returning their bounds in `value`. */
function lineRange(value: string, start: number, end: number): { from: number; to: number } {
  const from = value.lastIndexOf("\n", start - 1) + 1;
  let to = value.indexOf("\n", end);
  if (to === -1) to = value.length;
  return { from, to };
}

/** Toggle a line prefix across every selected line. When all lines already
 *  match `pattern`, the prefix is stripped; otherwise it's added. `prefix` may
 *  be a function so ordered lists can number each line. */
function toggleLines(
  s: TextState,
  prefix: string | ((index: number) => string),
  pattern: RegExp,
): EditResult {
  const { value, selectionStart, selectionEnd } = s;
  const { from, to } = lineRange(value, selectionStart, selectionEnd);
  const block = value.slice(from, to);
  const lines = block.split("\n");
  const allMatch = lines.every((line) => pattern.test(line));
  const nextLines = allMatch
    ? lines.map((line) => line.replace(pattern, ""))
    : lines.map((line, i) => (typeof prefix === "function" ? prefix(i) : prefix) + line);
  const nextBlock = nextLines.join("\n");
  const next = value.slice(0, from) + nextBlock + value.slice(to);
  return { value: next, selectionStart: from, selectionEnd: from + nextBlock.length };
}

export const heading = (s: TextState): EditResult => toggleLines(s, "### ", /^#{1,6} /);
export const quote = (s: TextState): EditResult => toggleLines(s, "> ", /^> ?/);
export const unorderedList = (s: TextState): EditResult => toggleLines(s, "- ", /^[-*] /);
export const taskList = (s: TextState): EditResult => toggleLines(s, "- [ ] ", /^[-*] \[[ xX]\] /);
export const orderedList = (s: TextState): EditResult => toggleLines(s, (i) => `${i + 1}. `, /^\d+\. /);

/** When a URL is pasted over a non-empty selection, turn it into a link.
 *  Returns null when it shouldn't apply (no selection, or not a URL). */
export function linkOnPaste(s: TextState, pasted: string): EditResult | null {
  const { value, selectionStart, selectionEnd } = s;
  if (selectionStart === selectionEnd) return null;
  if (!isUrl(pasted)) return null;
  const text = value.slice(selectionStart, selectionEnd);
  const snippet = `[${text}](${pasted.trim()})`;
  const next = value.slice(0, selectionStart) + snippet + value.slice(selectionEnd);
  const caret = selectionStart + snippet.length;
  return { value: next, selectionStart: caret, selectionEnd: caret };
}
