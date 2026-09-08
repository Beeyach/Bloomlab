import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { FIELD_READY_AREAS } from '../../mastery-engine/src/fieldReady.ts';
import { compileContentDir } from '../src/node.ts';
import { FIELD_READY_EVIDENCE_AREAS, FIELD_READY_TOPIC_IDS } from '../src/schemas/fieldReady.ts';
import { fieldReadyCoverage, validateFieldReady } from '../src/compile/fieldReady.ts';
import { IssueList, type ParsedContent } from '../src/compile/validate.ts';
let content: ParsedContent;
beforeAll(async () => {
  content = {
    ...(await compileContentDir(fileURLToPath(new URL('../../../content', import.meta.url)))),
    paths: {},
  };
});
describe('Phase 24 compiler contracts', () => {
  it('pins evaluator and authoring to the same ten domains', () => {
    expect(FIELD_READY_EVIDENCE_AREAS).toEqual(FIELD_READY_AREAS);
    expect(new Set(FIELD_READY_TOPIC_IDS).size).toBe(FIELD_READY_TOPIC_IDS.length);
  });
  it('cites actual unit/exercise IDs and counts each authored duration once', () => {
    const report = fieldReadyCoverage(content);
    for (const topic of report.topics) {
      for (const id of topic.units)
        expect(content.learning_units.find((unit) => unit.id === id)?.topics).toContain(
          topic.topic,
        );
      for (const id of topic.exercises)
        expect(content.exercises.find((exercise) => exercise.id === id)?.topics).toContain(
          topic.topic,
        );
    }
    const duplicate = structuredClone(content);
    duplicate.campaigns
      .find((campaign) => campaign.id === 'CAMP-FIELD_READY')!
      .gates[1]!.skills.push(...duplicate.campaigns[0]!.gates[0]!.skills);
    expect(fieldReadyCoverage(duplicate).minutes).toEqual(report.minutes);
  });
  it('reports missing curriculum as a fatal error when enforcement is enabled', () => {
    const broken = structuredClone(content);
    broken.campaigns.find((campaign) => campaign.id === 'CAMP-FIELD_READY')!.coverage_enforced =
      true;
    broken.learning_units = [];
    broken.skills.forEach((skill) => {
      skill.identities = [];
    });
    const issues = new IssueList();
    validateFieldReady(broken, issues);
    expect(issues.errors.some((issue) => issue.message.startsWith('Missing identities:'))).toBe(
      true,
    );
    expect(issues.errors.some((issue) => issue.message.startsWith('Missing learn/practical'))).toBe(
      true,
    );
    expect(fieldReadyCoverage(broken).ratio_passes).toBe(false);
  });
  it('calculates Bloomwired bias from the referenced client industry', () => {
    const different = structuredClone(content);
    different.clients.forEach((client) => {
      client.industry = 'b2b_service';
    });
    expect(fieldReadyCoverage(different).bloomwired_percent).toBe(0);
    expect(fieldReadyCoverage(different).bloomwired_passes).toBe(false);
  });
  it('rejects a stale Funnel Builder feature rather than merely warning', () => {
    const stale = structuredClone(content);
    stale.learning_units[0]!.topics = ['conversion.funnel_builder'];
    stale.learning_units[0]!.ghl_features = [stale.ghl_features[0]!.id];
    stale.ghl_features[0]!.status = 'needs_review';
    const issues = new IssueList();
    validateFieldReady(stale, issues);
    expect(issues.errors.some((issue) => issue.code === 'FIELD_READY_GHL_CURRENT')).toBe(true);
  });
});
