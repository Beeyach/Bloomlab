import type { ElementType, ReactNode } from 'react';

import styles from './prose.module.css';
import { slugify, textOf } from './slug';

interface HeadingProps {
  children?: ReactNode;
}

const heading =
  (Tag: 'h2' | 'h3' | 'h4') =>
  ({ children }: HeadingProps) => {
    const text = textOf(children);
    return (
      <Tag id={slugify(text)} className={styles[Tag]}>
        {children}
      </Tag>
    );
  };

const H2 = heading('h2');
const H3 = heading('h3');
const H4 = heading('h4');

/**
 * The reading surface (spec §76, DES-020): body prose sits directly in the flow — no card per
 * paragraph — with an editorial measure, Inter for reading, Bricolage Grotesque for section
 * titles, IBM Plex Mono for inline technical terms.
 */
export const PROSE_COMPONENTS: Record<string, ElementType> = {
  h1: H2,
  h2: H2,
  h3: H3,
  h4: H4,
  p: (props: { children?: ReactNode }) => <p className={styles.p} {...props} />,
  ul: (props: { children?: ReactNode }) => <ul className={styles.ul} {...props} />,
  ol: (props: { children?: ReactNode }) => <ol className={styles.ol} {...props} />,
  li: (props: { children?: ReactNode }) => <li className={styles.li} {...props} />,
  strong: (props: { children?: ReactNode }) => <strong className={styles.strong} {...props} />,
  em: (props: { children?: ReactNode }) => <em {...props} />,
  code: (props: { children?: ReactNode }) => <code className={styles.code} {...props} />,
  pre: (props: { children?: ReactNode }) => <pre className={styles.pre} {...props} />,
  a: (props: { href?: string; children?: ReactNode }) => {
    const external = props.href?.startsWith('http');
    return (
      <a
        className={styles.a}
        {...props}
        {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      />
    );
  },
  blockquote: (props: { children?: ReactNode }) => (
    <blockquote className={styles.blockquote} {...props} />
  ),
  hr: () => <hr className={styles.hr} />,
  table: (props: { children?: ReactNode }) => (
    <div className={styles.tableWrap}>
      <table className={styles.table} {...props} />
    </div>
  ),
  th: (props: { children?: ReactNode }) => <th className={styles.th} scope="col" {...props} />,
  td: (props: { children?: ReactNode }) => <td className={styles.td} {...props} />,
};
