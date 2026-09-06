import { describe, expect, it } from 'vitest';

import {
  CLOSING_SITUATIONS,
  DISCOVERY_TOPICS,
  MESSAGE_TYPES,
  type Exercise,
  type MessageType,
} from '@bloomlab/content-schema';

import { content } from '../content/bundle';
import { FINDING_CLASSIFICATIONS } from './sales';

/**
 * What Phase 16 actually authored (EXR-014, SAL-003, SAL-004, SAL-008, SAL-013).
 *
 * Every requirement that says "trains X" is checked here against the compiled curriculum rather
 * than against a list in a document. If a communication type is dropped, or a rubric loses the
 * concept it exists for, this fails.
 */

const exercises = content.exercises as Exercise[];
const salesExercises = exercises.filter(
  (exercise) => exercise.written_fields.length > 0 || exercise.conversation !== null,
);
const rubric = (id: string) => content.rubrics.find((candidate) => candidate.id === id);

describe('every written piece Phase 16 names is authored (EXR-014, SAL-013)', () => {
  const authored = new Set<MessageType>(
    exercises.flatMap((exercise) =>
      exercise.written_fields
        .map((field) => field.message_type)
        .filter((type): type is MessageType => type !== undefined),
    ),
  );

  it.each(MESSAGE_TYPES)('%s is something the learner is asked to write', (type) => {
    expect(authored.has(type)).toBe(true);
  });

  it('reaches each of them through a real exercise with a brief and a cap', () => {
    for (const type of MESSAGE_TYPES) {
      const owner = exercises.find((exercise) =>
        exercise.written_fields.some((field) => field.message_type === type),
      );
      const field = owner?.written_fields.find((candidate) => candidate.message_type === type);
      expect(owner?.instructions.length ?? 0).toBeGreaterThan(80);
      expect(field?.max_words).toBeGreaterThan(0);
    }
  });
});

describe('the cold-email rubric carries its six concepts (SAL-003)', () => {
  it('names opener, evidence, relevance, problem, CTA and follow-up', () => {
    const written = rubric('WRITTEN_COMMUNICATION_RUBRIC_V2');
    expect(written).toBeDefined();
    const concepts = new Set(written?.items.flatMap((item) => item.concepts));
    for (const concept of ['opener', 'evidence', 'relevance', 'problem', 'cta', 'follow_up']) {
      expect([...concepts]).toContain(concept);
    }
  });

  it('also carries the audience rule and the frame (SAL-006, SAL-007)', () => {
    const concepts = new Set(
      rubric('WRITTEN_COMMUNICATION_RUBRIC_V2')?.items.flatMap((item) => item.concepts),
    );
    expect([...concepts]).toContain('audience_fit');
    expect([...concepts]).toContain('jargon');
    expect([...concepts]).toContain('frame');
  });

  it('leaves V1 exactly as it was, for the attempts it judged', () => {
    const v1 = rubric('WRITTEN_COMMUNICATION_RUBRIC_V1');
    expect(v1?.version).toBe(1);
    expect(v1?.items).toHaveLength(5);
  });
});

describe('the discovery rubric carries all fifteen topics (SAL-004)', () => {
  it.each(DISCOVERY_TOPICS)('%s is one of the things it judges', (topic) => {
    const topics = new Set(
      rubric('SALES_DISCOVERY_RUBRIC_V2')?.items.flatMap((item) => item.topics),
    );
    expect([...topics]).toContain(topic);
  });

  it('judges listening and the early pitch as well (SAL-005)', () => {
    const items = rubric('SALES_DISCOVERY_RUBRIC_V2')?.items ?? [];
    expect(
      items.some((item) => item.tier === 'critical' && /diagnosis/i.test(item.criterion)),
    ).toBe(true);
    expect(items.some((item) => /listened/i.test(item.criterion))).toBe(true);
  });

  it('leaves V1 alone', () => {
    expect(rubric('SALES_DISCOVERY_RUBRIC_V1')?.version).toBe(1);
    expect(rubric('SALES_DISCOVERY_RUBRIC_V1')?.items).toHaveLength(6);
  });
});

describe('the closing situations are staged, not listed (SAL-008)', () => {
  const staged = new Set(
    exercises.flatMap((exercise) =>
      (exercise.conversation?.nodes ?? [])
        .map((node) => node.situation)
        .filter((situation) => situation !== undefined),
    ),
  );

  it.each(CLOSING_SITUATIONS)('%s happens in an authored thread', (situation) => {
    expect(staged.has(situation)).toBe(true);
  });
});

describe('the shape of the selling families', () => {
  it('offers three classifications and no fourth (EXR-013)', () => {
    expect([...FINDING_CLASSIFICATIONS]).toEqual(['verified', 'likely', 'unknown']);
  });

  it('has a business worth skipping (SAL-002)', () => {
    const briefs = exercises.flatMap((exercise) => exercise.sales.prospect_briefs);
    expect(briefs.length).toBeGreaterThan(0);
    expect(briefs.some((brief) => brief.strongest_decision === 'skip')).toBe(true);
    expect(briefs.some((brief) => brief.acceptable_decisions.includes('maybe'))).toBe(true);
  });

  it('never asks a learner to cite something the exercise did not show them', () => {
    for (const exercise of exercises) {
      const ids = new Set(exercise.sales.evidence.map((item) => item.id));
      for (const brief of exercise.sales.prospect_briefs) {
        for (const axis of brief.axes) {
          for (const id of axis.evidence) expect(ids.has(id)).toBe(true);
        }
      }
    }
  });

  it('keeps the writing rubric-graded, and says so rather than faking a verdict (AI-006)', () => {
    for (const exercise of salesExercises) {
      if (exercise.grading.mode === 'deterministic') continue;
      expect(exercise.grading.rubric).toBeTruthy();
      expect(exercise.grading.mode).toBe('mixed');
    }
  });

  it('credits skills that actually ask for sales use', () => {
    const selling = exercises.filter((exercise) =>
      ['PROSPECT_IT', 'AUDIT_IT', 'WRITE_IT', 'EXPLAIN_IT'].includes(exercise.type),
    );
    expect(selling.length).toBeGreaterThanOrEqual(10);
    for (const exercise of selling) {
      for (const skillId of exercise.skills) {
        const skill = content.skills.find((candidate) => candidate.id === skillId);
        expect(skill?.mastery_requirements.sales_use, `${exercise.id} → ${skillId}`).toBe(true);
      }
    }
  });
});

describe('the learner is never shown what they could not have seen (§23, §35)', () => {
  it('keeps hidden facts out of every evidence pack and every client message', () => {
    for (const exercise of exercises) {
      const clients = [exercise.client, exercise.conversation?.client, ...exercise.prospects]
        .filter((id) => id !== undefined)
        .map((id) => content.clients.find((candidate) => candidate.id === id))
        .filter((client) => client !== undefined);
      const scenario = content.scenarios.find((candidate) => candidate.id === exercise.scenario);
      const secrets = [
        ...clients.flatMap((client) => Object.values(client.hidden_facts)),
        ...Object.values(scenario?.hidden_facts ?? {}),
      ].filter((value): value is string => typeof value === 'string' && value.length >= 8);
      const visible = [
        exercise.instructions,
        ...exercise.sales.evidence.map((item) => item.observation),
        ...(exercise.conversation?.nodes ?? []).map((node) => node.client_message),
        ...exercise.hints.map((hint) => hint.text),
      ]
        .join('\n')
        .toLowerCase();
      for (const secret of secrets) {
        expect(visible, `${exercise.id} leaks "${secret}"`).not.toContain(secret.toLowerCase());
      }
    }
  });

  it('never renders a hidden roleplay number as content', () => {
    for (const exercise of exercises) {
      const visible = [
        exercise.instructions,
        ...exercise.sales.evidence.map((item) => item.observation),
        ...(exercise.conversation?.nodes ?? []).map((node) => node.client_message),
      ].join('\n');
      expect(visible).not.toMatch(/trust: ?\d|price_sensitivity|actual_budget|hidden_state/);
    }
  });
});
