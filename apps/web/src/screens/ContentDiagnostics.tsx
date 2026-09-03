import { Surface } from '@bloomlab/design-system';
import { CONTENT_TYPES, TERRITORIES } from '@bloomlab/content-schema';

import { CONTENT_HASH, CONTENT_VERSION, content } from '../content/bundle';
import styles from './SystemDiagnostics.module.css';

/**
 * What the build compiled from `content/` (spec §100, CNT-006): version, counts, the skill
 * graph by territory, and the generated coverage and review lists. Read from the bundle only.
 */
export function ContentDiagnostics() {
  const gaps = content.coverage.content.filter((row) => row.gaps.length > 0);
  const maxDepth = Math.max(0, ...Object.values(content.graph.depth));

  return (
    <>
      <Surface as="dl" padding="sm" className={styles.list}>
        <dt>Content version</dt>
        <dd>{CONTENT_VERSION}</dd>
        <dt>Content hash</dt>
        <dd>{CONTENT_HASH.slice(0, 12)}</dd>
        <dt>Records</dt>
        <dd>{CONTENT_TYPES.map((type) => `${type} ${content.counts[type]}`).join(' · ')}</dd>
        <dt>Skill graph</dt>
        <dd>
          {content.graph.order.length} skills · longest prerequisite chain {maxDepth} ·{' '}
          {TERRITORIES.map(
            (territory) => `${territory} ${content.graph.territories[territory].length}`,
          ).join(' · ')}
        </dd>
        <dt>Campaign paths</dt>
        <dd>
          {content.campaign_paths
            .map(
              (path) =>
                `${path.campaign}: ${path.ordered_skills.length} skills in ${path.gates.length} gates`,
            )
            .join(' · ')}
        </dd>
        <dt>Coverage gaps</dt>
        <dd>
          {gaps.length === 0
            ? 'none'
            : gaps.map((row) => `${row.skill} (${row.gaps.join(', ')})`).join(' · ')}
        </dd>
        <dt>Registry review list</dt>
        <dd>
          {content.freshness.length === 0
            ? 'nothing to review'
            : content.freshness.map((row) => `${row.feature} — ${row.reason}`).join(' · ')}
        </dd>
        <dt>Compiler warnings</dt>
        <dd>{content.warnings.length}</dd>
      </Surface>
    </>
  );
}
