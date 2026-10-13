import { Surface, Meta } from '@bloomlab/design-system';
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
        <dd>
          <Meta
            items={CONTENT_TYPES.map((type) => ({
              kind: 'text',
              label: `${type} ${content.counts[type]}`,
            }))}
          />
        </dd>
        <dt>Skill graph</dt>
        <dd>
          <Meta
            items={[
              { kind: 'text', label: `${content.graph.order.length} skills` },
              { kind: 'text', label: `longest prerequisite chain ${maxDepth}` },
              ...TERRITORIES.map((territory) => ({
                kind: 'text' as const,
                label: `${territory} ${content.graph.territories[territory].length}`,
              })),
            ]}
          />
        </dd>
        <dt>Campaign paths</dt>
        <dd>
          <Meta
            items={content.campaign_paths.map((path) => ({
              kind: 'text',
              label: `${path.campaign}: ${path.ordered_skills.length} skills in ${path.gates.length} gates`,
            }))}
          />
        </dd>
        <dt>Coverage gaps</dt>
        <dd>
          {gaps.length === 0 ? (
            'none'
          ) : (
            <Meta
              items={gaps.map((row) => ({
                kind: 'text',
                label: `${row.skill} (${row.gaps.join(', ')})`,
              }))}
            />
          )}
        </dd>
        <dt>Registry review list</dt>
        <dd>
          {content.freshness.length === 0 ? (
            'nothing to review'
          ) : (
            <Meta
              items={content.freshness.map((row) => ({
                kind: 'text',
                label: `${row.feature} — ${row.reason}`,
              }))}
            />
          )}
        </dd>
        <dt>Compiler warnings</dt>
        <dd>{content.warnings.length}</dd>
      </Surface>
    </>
  );
}
