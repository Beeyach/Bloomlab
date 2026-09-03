import { useId } from 'react';

import {
  funnelOutcome,
  money,
  parseFunnelInput,
  percent,
  whole,
  type FunnelInput,
} from '../funnelMath';
import styles from './embeds.module.css';

const RATE_WORDS: Record<'booking' | 'show' | 'close', string> = {
  booking: 'book',
  show: 'show',
  close: 'buy',
};

/**
 * The funnel as four proportional bars, drawn from the unit's own numbers (Diagram kind="funnel").
 * Semantic HTML + CSS: a list of stages whose bar widths are the counts, the rate between stages
 * written out, and a caption that states the numbers and the biggest loss in words. Nothing
 * depends on hover or colour; it reflows to a single column at any width.
 */
export function FunnelDiagram(attributes: Record<string, unknown>) {
  const input: FunnelInput = parseFunnelInput(attributes);
  const outcome = funnelOutcome(input);
  const captionId = useId();
  const max = outcome.stages[0]?.count ?? 1;
  const caption =
    typeof attributes.caption === 'string'
      ? attributes.caption
      : `${whole(input.leads)} leads become ${whole(outcome.stages[1]?.count ?? 0)} bookings, ${whole(outcome.stages[2]?.count ?? 0)} consultations and ${whole(outcome.sales)} sales worth about ${money(outcome.revenue)} a month. The biggest loss is between ${outcome.leak.label.toLowerCase()} and the next stage: ${whole(outcome.leak.lost)} people.`;

  return (
    <figure className={styles.funnel} aria-labelledby={captionId} data-embed="diagram-funnel">
      <ol className={styles.funnelStages}>
        {outcome.stages.map((stage) => (
          <li
            key={stage.key}
            className={styles.funnelStage}
            data-leak={stage.key === outcome.leak.key ? 'true' : undefined}
          >
            <span className={styles.funnelLabel}>{stage.label}</span>
            <span className={styles.funnelTrack}>
              <span
                className={styles.funnelBar}
                style={{ width: `${Math.max(4, (stage.count / max) * 100)}%` }}
              >
                <span className={styles.funnelCount}>{whole(stage.count)}</span>
              </span>
            </span>
            <span className={styles.funnelRate}>
              {stage.rate
                ? `${percent(input[stage.rate])} ${RATE_WORDS[stage.rate]} →`
                : `${money(input.ticket)} each`}
            </span>
          </li>
        ))}
      </ol>
      <figcaption id={captionId} className={styles.caption}>
        {caption}
      </figcaption>
    </figure>
  );
}
