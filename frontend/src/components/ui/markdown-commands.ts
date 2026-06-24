// Pure text transforms for the markdown toolbar. Each takes the current textarea
// state (value + selection) and returns the new value plus where the selection
// should land, so the editor can restore focus naturally after applying.

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

/** Wrap the selection with `before`/`after`. With no selection, insert a
 *  placeholder and select it so the user can type over it. */
export function wrapInline(s: TextState, before: string, after: string, placeholder: string): EditResult {
  const { value, selectionStart, selectionEnd } = s;
  const selected = value.slice(selectionStart, selectionEnd);
  const inner = selected || placeholder;
  const next = value.slice(0, selectionStart) + before + inner + after + value.slice(selectionEnd);
  // Select the inner text (the wrapped content), ready to overwrite or extend.
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
 *  user can paste/type it immediately. */
export function insertLink(s: TextState): EditResult {
  const { value, selectionStart, selectionEnd } = s;
  const text = value.slice(selectionStart, selectionEnd) || "text";
  const urlPlaceholder = "url";
  const snippet = `[${text}](${urlPlaceholder})`;
  const next = value.slice(0, selectionStart) + snippet + value.slice(selectionEnd);
  // Select the "url" placeholder inside the parentheses.
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

/** Prefix every selected line. `dynamic` lets ordered lists number each line. */
export function prefixLines(
  s: TextState,
  prefix: string | ((index: number) => string),
): EditResult {
  const { value, selectionStart, selectionEnd } = s;
  const { from, to } = lineRange(value, selectionStart, selectionEnd);
  const block = value.slice(from, to);
  const lines = block.split("\n");
  const prefixed = lines.map((line, i) => (typeof prefix === "function" ? prefix(i) : prefix) + line);
  const nextBlock = prefixed.join("\n");
  const next = value.slice(0, from) + nextBlock + value.slice(to);
  // Select the whole transformed block.
  return { value: next, selectionStart: from, selectionEnd: from + nextBlock.length };
}

export const heading = (s: TextState): EditResult => prefixLines(s, "### ");
export const quote = (s: TextState): EditResult => prefixLines(s, "> ");
export const unorderedList = (s: TextState): EditResult => prefixLines(s, "- ");
export const taskList = (s: TextState): EditResult => prefixLines(s, "- [ ] ");
export const orderedList = (s: TextState): EditResult => prefixLines(s, (i) => `${i + 1}. `);

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
