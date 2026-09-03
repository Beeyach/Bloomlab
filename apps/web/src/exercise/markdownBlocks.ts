/**
 * Grouping authored Markdown into paragraphs and lists. Pure and testable; the elements
 * themselves are rendered by `Markdown` (D-071).
 *
 * A blank line ends a block. A line that carries no list marker continues whatever is open —
 * the paragraph, or the list item above it — so an authored item wrapped across two lines stays
 * one item instead of splitting the list.
 */
export interface Block {
  kind: 'p' | 'ul' | 'ol';
  lines: string[];
}

const ORDERED = /^\d+\.\s+(.*)$/;
const BULLET = /^[-*]\s+(.*)$/;

export function blocksOf(markdown: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const raw of markdown.split('\n')) {
    const line = raw.trim();
    if (line.length === 0) {
      current = null;
      continue;
    }
    const ordered = ORDERED.exec(line);
    const bullet = BULLET.exec(line);
    const marked = ordered ?? bullet;
    const kind: Block['kind'] | null = ordered ? 'ol' : bullet ? 'ul' : null;
    const text = marked?.[1] ?? line;

    if (kind === null) {
      if (current) {
        // Continue the open paragraph, or the list item this line wrapped from.
        current.lines[current.lines.length - 1] = `${current.lines.at(-1)} ${text}`;
        continue;
      }
      current = { kind: 'p', lines: [text] };
      blocks.push(current);
      continue;
    }
    if (current?.kind === kind) {
      current.lines.push(text);
      continue;
    }
    current = { kind, lines: [text] };
    blocks.push(current);
  }
  return blocks;
}
