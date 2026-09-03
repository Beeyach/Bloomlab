import { MASTERY_RULES_VERSION, type EvidenceVersions } from '@bloomlab/mastery-engine';
import { APP_VERSION } from '@bloomlab/shared';
import { SIMULATOR_VERSION } from '@bloomlab/simulator-core';

import { CONTENT_HASH, CONTENT_VERSION } from '../../content/bundle';

/**
 * The version stamp written on every attempt and evidence record (spec §101, INF-013,
 * CNT-007, DATA-011): app, content (version and exact hash), simulator, and the mastery rules
 * that were in force. Records keep what they were written with; nothing rewrites them later.
 */
export function currentVersions(): EvidenceVersions {
  return {
    app: APP_VERSION,
    content: CONTENT_VERSION,
    content_hash: CONTENT_HASH,
    simulator: SIMULATOR_VERSION,
    rules: MASTERY_RULES_VERSION,
  };
}
