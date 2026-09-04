import type { ReactNode } from 'react';

import type { AccountState, FunnelBlock, FunnelStep } from '@bloomlab/simulator-core';

import { money } from './edit';
import { BLOCK_ROLE_LABELS, REFERENCE_NOUN, fieldLabel } from './words';
import styles from './funnel.module.css';

/**
 * One funnel step drawn as the page a visitor would meet (FUN-001).
 *
 * This is the same renderer for PREVIEW and for SIMULATE, which is what makes "the visitor uses
 * the architecture you built" true rather than claimed: there is no second, canned page anywhere
 * in the Lab. PREVIEW draws the capture blocks as the shapes they are; SIMULATE passes `controls`
 * and gets working ones in the same positions.
 *
 * What it communicates is hierarchy, function, and where the ask sits — enough to reason about
 * conversion architecture. It is not a page builder and does not pretend to be one: the type
 * scale, the rhythm and the emphasis are the product's, not the learner's, and no styling control
 * exists anywhere in this Lab.
 *
 * It reflows for real at whatever width its container gives it. The preview frame changes that
 * width; nothing is scaled.
 */

export interface FunnelPageProps {
  step: FunnelStep;
  account: AccountState;
  /** SIMULATE: the working control for a capture block, by block id. */
  controls?: Record<string, ReactNode>;
  /** BUILD/PREVIEW: which block is selected, so the preview can show the editor's selection. */
  selectedBlockId?: string | null;
  /** Marks the page as a static rendering, so a form is drawn but never focusable. */
  inert?: boolean;
}

export function FunnelPage({
  step,
  account,
  controls,
  selectedBlockId = null,
  inert = false,
}: FunnelPageProps) {
  return (
    <article className={styles.page}>
      {step.blocks.map((block) => (
        <section
          key={block.id}
          className={styles.pageBlock}
          data-role={block.role}
          data-selected={block.id === selectedBlockId ? 'true' : undefined}
          data-testid={`page-block-${block.id}`}
        >
          <BlockBody block={block} account={account} control={controls?.[block.id]} inert={inert} />
        </section>
      ))}
    </article>
  );
}

function BlockBody({
  block,
  account,
  control,
  inert,
}: {
  block: FunnelBlock;
  account: AccountState;
  control: ReactNode | undefined;
  inert: boolean;
}) {
  const words = (
    <>
      {block.headline && <p className={styles.pageHeadline}>{block.headline}</p>}
      {block.body && <p className={styles.pageBody}>{block.body}</p>}
    </>
  );

  switch (block.role) {
    case 'headline':
      return (
        <>
          <h3 className={styles.pageTitle}>{block.headline ?? 'Your headline goes here'}</h3>
          {block.body && <p className={styles.pageLead}>{block.body}</p>}
        </>
      );
    case 'cta':
      return (
        <>
          {words}
          {control ?? (
            <span className={styles.pageButton} aria-hidden={inert || undefined}>
              {block.headline ?? 'Continue'}
            </span>
          )}
        </>
      );
    case 'form':
    case 'survey': {
      const entity =
        block.role === 'form'
          ? block.reference_id
            ? account.forms[block.reference_id]
            : undefined
          : block.reference_id
            ? account.surveys[block.reference_id]
            : undefined;
      return (
        <>
          {words}
          {control ??
            (entity ? (
              <div className={styles.pageForm}>
                <p className={styles.pageFormName}>{entity.name}</p>
                <ul className={styles.pageFields}>
                  {entity.fields.map((field) => (
                    <li key={field}>{fieldLabel(field)}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className={styles.pageUnset}>
                No {REFERENCE_NOUN[block.role]} connected yet — connect one in Build.
              </p>
            ))}
        </>
      );
    }
    case 'calendar': {
      const calendar = block.reference_id ? account.calendars[block.reference_id] : undefined;
      return (
        <>
          {words}
          {control ??
            (calendar ? (
              <div className={styles.pageForm}>
                <p className={styles.pageFormName}>{calendar.name}</p>
                <p className={styles.pageBody}>{calendar.duration_minutes} minutes</p>
              </div>
            ) : (
              <p className={styles.pageUnset}>No calendar connected yet — connect one in Build.</p>
            ))}
        </>
      );
    }
    case 'checkout': {
      const product = block.reference_id ? account.products[block.reference_id] : undefined;
      return (
        <>
          {words}
          {control ??
            (product ? (
              <div className={styles.pageForm}>
                <p className={styles.pageFormName}>{product.name}</p>
                <p className={styles.pagePrice}>
                  {money(product.price)}
                  {product.recurring ? ' each month' : ''}
                </p>
              </div>
            ) : (
              <p className={styles.pageUnset}>No product connected yet — connect one in Build.</p>
            ))}
        </>
      );
    }
    default:
      return (
        <>
          {block.headline ? (
            <h4 className={styles.pageSubtitle}>{block.headline}</h4>
          ) : (
            <h4 className={styles.pageSubtitle}>{BLOCK_ROLE_LABELS[block.role]}</h4>
          )}
          {block.body ? (
            <p className={styles.pageBody}>{block.body}</p>
          ) : (
            <p className={styles.pageUnset}>Nothing written for this section yet.</p>
          )}
        </>
      );
  }
}
