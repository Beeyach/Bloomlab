import { Meta } from './Meta';

/** Authored title facts stay separate at display time; content and saved identities stay intact. */
export function ContentTitle({ title }: { title: string }) {
  const parts = title.split(/\s+[·|•]\s+/);
  if (parts.length === 1) return title;
  return (
    <Meta
      style={{ display: 'inline-flex', fontSize: 'inherit', color: 'inherit' }}
      items={parts.map((label, index) => ({
        kind: index === 0 ? 'chip' : 'text',
        label,
      }))}
    />
  );
}
