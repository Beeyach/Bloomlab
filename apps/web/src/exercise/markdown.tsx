import { Fragment, type ReactNode } from 'react';

import styles from './markdown.module.css';
import { blocksOf } from './markdownBlocks';

/**
 * Renders the small Markdown subset the authored exercise prose uses: paragraphs, ordered and
 * unordered lists, **bold**, *italic* and `code`. The prose itself stays in `content/` (spec
 * §98); this only turns it into elements, and it never interprets HTML — nothing is inserted as
 * raw markup, so authored text can never become markup (D-071).
 */

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

function inline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={key} className={styles.code}>
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {blocksOf(text).map((block, index) => {
        if (block.kind === 'p') {
          return (
            <p key={index} className={styles.p}>
              {inline(block.lines.join(' '), `p${index}`)}
            </p>
          );
        }
        const List = block.kind === 'ol' ? 'ol' : 'ul';
        return (
          <List key={index} className={styles.list}>
            {block.lines.map((line, item) => (
              <li key={item}>{inline(line, `l${index}-${item}`)}</li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
