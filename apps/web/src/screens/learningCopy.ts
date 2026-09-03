import type { ContentBundle } from '@bloomlab/content-schema';
import {
  EXERCISE_LABELS,
  MASTERY_LABELS,
  type ExerciseType,
  type MasteryState,
  type Territory,
} from '@bloomlab/design-system';
import {
  effectiveAssistance,
  isFailure,
  isPass,
  ladderRank,
  type EvidenceKind,
  type MissingRequirement,
  type ExerciseMode,
  type SessionItem,
  type SessionLength,
  type SkillEvaluation,
  type SkillEvidence,
} from '@bloomlab/mastery-engine';

import { content } from '../content/bundle';

/**
 * Copy helpers shared by the Command Center, Campaign and Skill Map screens (spec §158–§159):
 * short, direct, capability language — never points, levels or stars.
 */

/** One line of what each territory covers (CURRICULUM_MASTER_MAP.md §1). */
export const TERRITORY_SCOPE: Record<Territory, string> = {
  STRATEGIZE: 'Funnels, offers, conversion, funnel economics.',
  BUILD: 'Pages, funnels, forms, surveys, calendars, payments.',
  AUTOMATE: 'Workflows, communication, timing, logic, lifecycle.',
  ARCHITECT: 'CRM, fields, custom values, pipelines, objects.',
  DIAGNOSE: 'QA, troubleshooting, metrics, deliverability.',
  CONNECT: 'DNS, HTTP, JSON, webhooks, APIs, Cloudflare.',
  SELL: 'Prospecting, audits, discovery, pricing, closing.',
  DELIVER: 'Proposals, onboarding, handoff, retention.',
  SCALE: 'Snapshots, vertical systems, agency architecture.',
  JUDGMENT: 'Knowing what to build, what not to, and what could break.',
};

export const SESSION_LENGTH_LABELS: Record<SessionLength, string> = {
  '30m': '30 min',
  '1h': '1 hour',
  '2h': '2 hours',
  deep: 'Deep Session',
};

export const skillTitle = (id: string, bundle: ContentBundle = content): string =>
  bundle.skills.find((s) => s.id === id)?.title ?? id;

export const unitTitle = (id: string, bundle: ContentBundle = content): string =>
  bundle.learning_units.find((u) => u.id === id)?.title ?? id;

export const exerciseOf = (id: string, bundle: ContentBundle = content) =>
  bundle.exercises.find((e) => e.id === id) ?? null;

/** "Read · Funnel math, in the owner's numbers" / "Build It · Build Glowhaus's no-show recovery". */
export function describeStep(
  step: SessionItem,
  bundle: ContentBundle = content,
): {
  verb: string;
  title: string;
  detail: string | null;
} {
  if (step.kind === 'unit') {
    return { verb: 'Read', title: unitTitle(step.content_id, bundle), detail: null };
  }
  if (step.kind === 'retrieval') {
    const exercise = exerciseOf(step.content_id, bundle);
    return {
      verb: 'Retrieval',
      title: exercise ? exercise.title : skillTitle(step.skill_id, bundle),
      detail: 'A short challenge to keep the capability current.',
    };
  }
  const exercise = exerciseOf(step.content_id, bundle);
  return {
    verb: exercise ? EXERCISE_LABELS[exercise.type as ExerciseType] : 'Practise',
    title: exercise?.title ?? step.content_id,
    detail: exercise ? modeWord(exercise.mode) : null,
  };
}

export function modeWord(mode: ExerciseMode): string {
  switch (mode) {
    case 'guided':
      return 'Guided';
    case 'practice':
      return 'Practice';
    case 'independent':
      return 'No hints';
    case 'pressure':
      return 'Pressure test';
  }
}

/** Evidence in the §159 words: Demonstrated, Passed with help, Needs another run, Read. */
export function evidenceWord(evidence: SkillEvidence): string {
  if (evidence.kind === 'exposure') return 'Read';
  if (evidence.kind === 'quiz') return evidence.result === 'passed' ? 'Quiz passed' : 'Quiz';
  if (isFailure(evidence)) return 'Needs another run';
  if (evidence.result === 'partial') return 'Partly there';
  if (isPass(evidence)) {
    const assistance = effectiveAssistance(evidence);
    if (assistance === 'independent') return 'Demonstrated';
    if (assistance === 'light') return 'Demonstrated, one nudge';
    return 'Passed with help';
  }
  return evidence.result;
}

export const KIND_WORDS: Record<EvidenceKind, string> = {
  exposure: 'unit',
  quiz: 'quiz',
  guided_practice: 'guided practice',
  deterministic_exercise: 'exercise',
  independent_exercise: 'exercise, no hints',
  pressure_test: 'pressure test',
  explanation: 'explanation',
  sales_use: 'sales use',
  fieldwork: 'fieldwork',
  real_ghl: 'real GHL',
  retrieval: 'retrieval',
};

/** "today", "yesterday", "3 days ago", "in 12 days" — never a lock, only orientation. */
export function relativeDay(iso: string, now: Date = new Date()): string {
  const days = Math.round((Date.parse(iso) - now.getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === -1) return 'yesterday';
  if (days === 1) return 'tomorrow';
  if (days < 0) return `${-days} days ago`;
  return `in ${days} days`;
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export const MISSING_WORDS: Record<MissingRequirement, string> = {
  practice: 'a guided practice',
  independent_evidence: 'an independent demonstration',
  pressure_test: 'a pressure test',
  real_ghl_fieldwork: 'real GHL fieldwork',
  sales_use: 'using it in a sales conversation',
  refresh: 'a passed retrieval',
};

export function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/** Demonstrated means at least INDEPENDENT on the ladder (spec §75 territory counts). */
export const isDemonstrated = (evaluation: SkillEvaluation | undefined): boolean =>
  evaluation !== undefined && ladderRank(evaluation.ladder_state) >= ladderRank('INDEPENDENT');

/** One sentence on where a capability stands and what it still needs — no score, no level. */
export function stateSentence(evaluation: SkillEvaluation): string {
  const counts = evaluation.counts;
  if (evaluation.state === 'NEEDS_REFRESH') {
    const was = MASTERY_LABELS[evaluation.refresh_from ?? 'INDEPENDENT'];
    const why =
      evaluation.refresh_reason === 'failed_retrieval'
        ? 'a retrieval was missed'
        : 'it has not been demonstrated for a while';
    return `Was ${was}; ${why}. A passed retrieval brings it back.`;
  }
  if (evaluation.state === 'MASTERED') return 'Demonstrated repeatedly without help.';
  const lead: Record<Exclude<MasteryState, 'NEEDS_REFRESH' | 'MASTERED'>, string> = {
    UNSEEN: 'Not started.',
    LEARNING: 'Started, nothing passed yet.',
    GUIDED: 'Passed with help.',
    PRACTICED: 'Passed with light hints.',
    INDEPENDENT: `Demonstrated independently ${plural(counts.independent_passes, 'time')}.`,
    PRESSURE_TESTED: 'Held up under pressure.',
  };
  const needed = evaluation.missing_requirements.map((m) => MISSING_WORDS[m]);
  const opening = lead[evaluation.state];
  return needed.length > 0 ? `${opening} Still needed: ${joinWords(needed)}.` : opening;
}
