import {
  MASTERY_RULES_VERSION,
  assistanceFromHints,
  type EvidenceKind,
  type EvidenceResult,
  type HintLevel,
} from '../src/index.ts';
import type { CampaignDefinition, SkillDefinition, SkillEvidence } from '../src/index.ts';

/** September 2026, UTC. `day` 1–30, optional hour. */
export const at = (day: number, hour = 10, month = 8, year = 2026): string =>
  new Date(Date.UTC(year, month, day, hour)).toISOString();

export const NOW = new Date('2026-09-15T12:00:00Z');

export const VERSIONS = {
  app: '0.1.0',
  content: '2026.09.02',
  content_hash: 'e15441abc7fc',
  simulator: '0.0.0',
  rules: MASTERY_RULES_VERSION,
};

/** Needs two independent demonstrations and a pressure test. */
export const ALPHA: SkillDefinition = {
  id: 'SK-AUTOMATE-alpha',
  territory: 'AUTOMATE',
  prerequisites: [],
  mastery_requirements: {
    independent_evidence: 2,
    pressure_test: true,
    fieldwork_required: false,
    sales_use: false,
  },
};

/** Requires alpha; the lightest possible mastery rule (one declared demonstration). */
export const BETA: SkillDefinition = {
  id: 'SK-AUTOMATE-beta',
  territory: 'AUTOMATE',
  prerequisites: ['SK-AUTOMATE-alpha'],
  mastery_requirements: {
    independent_evidence: 1,
    pressure_test: false,
    fieldwork_required: false,
    sales_use: false,
  },
};

/** Requires beta; needs real-GHL fieldwork and sales use. */
export const GAMMA: SkillDefinition = {
  id: 'SK-SELL-gamma',
  territory: 'SELL',
  prerequisites: ['SK-AUTOMATE-beta'],
  mastery_requirements: {
    independent_evidence: 2,
    pressure_test: false,
    fieldwork_required: true,
    sales_use: true,
  },
};

export const SKILLS = [ALPHA, BETA, GAMMA];

export const CAMPAIGN: CampaignDefinition = {
  id: 'CAMP-TEST',
  requires_campaigns: [],
  gates: [
    {
      id: 'GATE-0',
      number: 0,
      name: 'Placement',
      placement: true,
      skills: [],
      assesses: ['SK-AUTOMATE-alpha'],
      pass_criteria: {
        independent_evidence_per_skill: 1,
        pressure_test_required: false,
        fieldwork_required: false,
      },
      projects: [],
    },
    {
      id: 'GATE-1',
      number: 1,
      name: 'Foundations',
      placement: false,
      skills: ['SK-AUTOMATE-alpha'],
      assesses: [],
      pass_criteria: {
        independent_evidence_per_skill: 2,
        pressure_test_required: true,
        fieldwork_required: false,
      },
      projects: [],
    },
    {
      id: 'GATE-2',
      number: 2,
      name: 'Building',
      placement: false,
      skills: ['SK-AUTOMATE-beta'],
      assesses: [],
      pass_criteria: {
        independent_evidence_per_skill: 1,
        pressure_test_required: false,
        fieldwork_required: false,
      },
      projects: [],
    },
    {
      id: 'GATE-3',
      number: 3,
      name: 'Selling',
      placement: false,
      skills: ['SK-SELL-gamma'],
      assesses: [],
      pass_criteria: {
        independent_evidence_per_skill: 2,
        pressure_test_required: false,
        fieldwork_required: true,
      },
      projects: [],
    },
  ],
};

let counter = 0;

const modeFor = (kind: EvidenceKind): SkillEvidence['mode'] => {
  switch (kind) {
    case 'guided_practice':
      return 'guided';
    case 'independent_exercise':
      return 'independent';
    case 'pressure_test':
      return 'pressure';
    case 'exposure':
    case 'quiz':
      return null;
    default:
      return 'practice';
  }
};

export interface EvidenceOptions {
  skill?: string;
  kind: EvidenceKind;
  result?: EvidenceResult;
  at?: string;
  hints?: HintLevel[];
  exercise?: string | null;
  critical?: string[];
  score?: number | null;
  realGhl?: boolean;
  id?: string;
}

/** A complete, valid evidence record with sensible defaults; every field of spec §30 present. */
export function evidence(options: EvidenceOptions): SkillEvidence {
  const kind = options.kind;
  const hints = options.hints ?? [];
  const exposure = kind === 'exposure' || kind === 'quiz';
  const exerciseId =
    options.exercise === undefined ? (exposure ? null : 'EX-BUILD_IT-one') : options.exercise;
  counter += 1;
  return {
    id: options.id ?? `ev-${String(counter).padStart(3, '0')}`,
    learner_id: 'learner-1',
    skill_id: options.skill ?? ALPHA.id,
    kind,
    source: exposure
      ? { type: kind === 'quiz' ? 'learning_unit' : 'learning_unit', id: 'LU-one' }
      : {
          type:
            kind === 'retrieval' ? 'retrieval' : kind === 'fieldwork' ? 'fieldwork' : 'exercise',
          id: exerciseId,
        },
    exercise_id: exerciseId,
    exercise_type: exposure ? null : 'BUILD_IT',
    attempt_id: exposure ? null : `att-${counter}`,
    result: options.result ?? (exposure ? 'exposed' : 'passed'),
    score: options.score === undefined ? (exposure ? null : 90) : options.score,
    assistance: assistanceFromHints(hints),
    hints_used: hints,
    difficulty: 3,
    critical_failures: options.critical ?? [],
    occurred_at: options.at ?? at(1),
    versions: VERSIONS,
    real_ghl:
      options.realGhl === undefined
        ? null
        : {
            required: true,
            provided: options.realGhl,
            evidence: options.realGhl ? ['screenshot'] : [],
          },
    mode: modeFor(kind),
  };
}

export function resetCounter(): void {
  counter = 0;
}
