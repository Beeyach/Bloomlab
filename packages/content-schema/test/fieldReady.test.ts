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

it('final Field Ready coverage is enforced, complete and within the authored time/industry targets', () => {
  const report = fieldReadyCoverage(content);
  expect(content.campaigns.find((row) => row.id === 'CAMP-FIELD_READY')?.coverage_enforced).toBe(
    true,
  );
  expect(report.missing_topics).toEqual([]);
  expect(report.missing_identities).toEqual([]);
  expect(report.missing_practical).toEqual([]);
  expect(report.bloomwired_percent).toBeGreaterThanOrEqual(70);
  expect(report.ratio_passes).toBe(true);
  // The shipped mix is also inside the narrower relative ten-percent ranges.
  expect(report.ratio.instruction).toBeGreaterThanOrEqual(18);
  expect(report.ratio.instruction).toBeLessThanOrEqual(22);
  expect(report.ratio.practical).toBeGreaterThanOrEqual(54);
  expect(report.ratio.practical).toBeLessThanOrEqual(66);
  expect(report.ratio.retrieval).toBeGreaterThanOrEqual(18);
  expect(report.ratio.retrieval).toBeLessThanOrEqual(22);
  for (const family of [
    'PRICE_IT',
    'NEGOTIATE_IT',
    'SAY_IT',
    'WRITE_IT',
    'PROSPECT_IT',
    'FIELDWORK',
  ])
    expect(report.exercise_families).toContain(family);
});
it('rejects capstone hints, missing inputs/actions/reasoning and an unauthored consequence choice', () => {
  for (const mutation of ['hints', 'inputs', 'actions', 'reasoning', 'choice'] as const) {
    const broken = structuredClone(content);
    const project = broken.projects.find((row) => row.capstone)!;
    if (mutation === 'hints')
      broken.exercises
        .find((row) => row.id === project.stages[0]!.exercises[0])!
        .hints.push({ level: 'nudge', text: 'A hint that must never be available.' });
    if (mutation === 'inputs') project.inputs.pop();
    if (mutation === 'actions')
      project.stages.forEach((stage) => {
        stage.actions = [];
      });
    if (mutation === 'reasoning') project.reasoning_questions.pop();
    if (mutation === 'choice')
      project.stages.find(
        (stage) => stage.conditional_exercises.length,
      )!.conditional_exercises[0]!.choice = 'invented';
    const issues = new IssueList();
    validateFieldReady(broken, issues);
    expect(issues.errors.length, mutation).toBeGreaterThan(0);
  }
});
it('tags future STRATEGIZE and advanced automation boundaries without adding Phase 25 dependencies', () => {
  const campaign = content.campaigns.find((row) => row.id === 'CAMP-FIELD_READY')!;
  expect(
    campaign.future_boundaries
      .filter((row) => row.territory === 'STRATEGIZE')
      .map((row) => row.tier),
  ).toEqual(['practitioner', 'advanced', 'specialist']);
  expect(campaign.future_boundaries.find((row) => row.territory === 'AUTOMATE')?.topics).toContain(
    'race conditions',
  );
  const ids = campaign.gates.flatMap((gate) => gate.skills);
  expect(
    content.skills
      .filter((skill) => ids.includes(skill.id))
      .every((skill) => skill.tier === 'field_ready'),
  ).toBe(true);
});
