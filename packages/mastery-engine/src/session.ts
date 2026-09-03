import { effectiveAssistance, isFailure, isPass } from './evidence.ts';
import { atLeast } from './mastery.ts';
import {
  MASTERY_RULES_VERSION,
  REVIEW_RULES,
  SESSION_RULES,
  assistanceRank,
  ladderRank,
} from './rules.ts';
import type {
  ExerciseSummary,
  SessionBlock,
  SessionInput,
  SessionItem,
  SessionPlan,
  SkillDefinition,
  SkillEvaluation,
} from './types.ts';

/**
 * Session Builder (spec §33, TA§70; MAS-006). Deterministic: the same inputs always give the
 * same plan, and no AI is consulted. Order of decisions:
 *   1. due retrieval (short, capped share, never blocking),
 *   2. repair — weak prerequisites of the next required work, recent failures, and assisted
 *      passes when assistance dependence is high,
 *   3. the learner's focus, if any,
 *   4. next required campaign work, then work-ahead skills,
 *   5. pending fieldwork and the active project.
 * The learner can always Continue: `exclude` the finished items and build again.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const SALES_TYPES = new Set([
  'PROSPECT_IT',
  'AUDIT_IT',
  'WRITE_IT',
  'SAY_IT',
  'PRICE_IT',
  'NEGOTIATE_IT',
  'EXPLAIN_IT',
]);

interface Context {
  input: SessionInput;
  skills: Map<string, SkillDefinition>;
  evaluations: Map<string, SkillEvaluation>;
  order: Map<string, number>;
  used: Set<string>;
  passedExercises: Set<string>;
  budget: number;
  planned: number;
}

const itemId = (kind: SessionItem['kind'], contentId: string, skillId: string) =>
  `${kind}:${contentId}:${skillId}`;

function exercisesFor(ctx: Context, skillId: string): ExerciseSummary[] {
  return (ctx.input.content.exercises_by_skill[skillId] ?? [])
    .map((id) => ctx.input.content.exercises[id])
    .filter((e): e is ExerciseSummary => Boolean(e))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function pickExercise(
  ctx: Context,
  skillId: string,
  predicate: (e: ExerciseSummary) => boolean,
): ExerciseSummary | null {
  const candidates = exercisesFor(ctx, skillId).filter(predicate);
  // Prefer something not yet passed, then the shortest, then by id.
  return (
    [...candidates].sort(
      (a, b) =>
        Number(ctx.passedExercises.has(a.id)) - Number(ctx.passedExercises.has(b.id)) ||
        a.estimated_minutes - b.estimated_minutes ||
        a.id.localeCompare(b.id),
    )[0] ?? null
  );
}

/** The next useful step for a skill given its evaluation, or null when nothing is needed. */
export function nextStepFor(ctx: Context, skillId: string): SessionItem | null {
  const skill = ctx.skills.get(skillId);
  const evaluation = ctx.evaluations.get(skillId);
  if (!skill || !evaluation) return null;
  const req = skill.mastery_requirements;
  const counts = evaluation.counts;
  const unit = (ctx.input.content.units_by_skill[skillId] ?? []).slice().sort()[0];

  if (
    counts.exposures === 0 &&
    unit &&
    ladderRank(evaluation.ladder_state) < ladderRank('PRACTICED')
  ) {
    return {
      id: itemId('unit', unit, skillId),
      kind: 'unit',
      content_id: unit,
      skill_id: skillId,
      minutes: ctx.input.content.unit_minutes[unit] ?? SESSION_RULES.default_unit_minutes,
      reason: 'first exposure: read the unit before practising',
    };
  }
  const exercise = (
    reason: string,
    predicate: (e: ExerciseSummary) => boolean,
  ): SessionItem | null => {
    const pick = pickExercise(ctx, skillId, predicate);
    return pick
      ? {
          id: itemId('exercise', pick.id, skillId),
          kind: 'exercise',
          content_id: pick.id,
          skill_id: skillId,
          minutes: pick.estimated_minutes,
          reason,
        }
      : null;
  };
  if (!atLeast(evaluation, 'GUIDED')) {
    return (
      exercise('first practice: a guided exercise', (e) => e.mode === 'guided') ??
      exercise('first practice', (e) => e.mode === 'practice')
    );
  }
  if (!atLeast(evaluation, 'PRACTICED')) {
    return (
      exercise('practise without a worked example', (e) => e.mode === 'practice') ??
      exercise('practise independently', (e) => e.mode === 'independent')
    );
  }
  const needed = Math.max(2, req.independent_evidence);
  if (!atLeast(evaluation, 'INDEPENDENT') || counts.independent_passes < needed) {
    return (
      exercise(
        `independent evidence ${counts.independent_passes}/${needed}: do it without hints`,
        (e) => e.mode === 'independent',
      ) ??
      exercise(
        `independent evidence ${counts.independent_passes}/${needed}: practise without hints`,
        (e) => e.mode === 'practice',
      )
    );
  }
  if (req.pressure_test && counts.pressure_passes === 0) {
    return exercise('pressure test required for mastery', (e) => e.mode === 'pressure');
  }
  if (req.fieldwork_required && counts.fieldwork_passes === 0) {
    return exercise(
      'real-GHL fieldwork required for mastery',
      (e) => e.type === 'FIELDWORK' || e.fieldwork_required,
    );
  }
  if (req.sales_use && counts.sales_use_passes === 0) {
    return exercise('sales use required for mastery', (e) => SALES_TYPES.has(e.type));
  }
  return null;
}

function add(ctx: Context, block: SessionBlock, item: SessionItem | null): boolean {
  if (!item || ctx.used.has(item.id) || ctx.input.exclude?.includes(item.id)) return false;
  if (ctx.planned + item.minutes > ctx.budget && block.items.length + ctx.used.size > 0)
    return false;
  ctx.used.add(item.id);
  ctx.planned += item.minutes;
  block.items.push(item);
  return true;
}

function retrievalItem(ctx: Context, skillId: string, reason: string): SessionItem {
  const vehicle = pickExercise(
    ctx,
    skillId,
    (e) => e.mode === 'independent' || e.mode === 'practice',
  );
  return {
    id: itemId('retrieval', vehicle?.id ?? skillId, skillId),
    kind: 'retrieval',
    content_id: vehicle?.id ?? skillId,
    skill_id: skillId,
    minutes: REVIEW_RULES.retrieval_minutes,
    reason,
  };
}

/** Share of recent passes that needed guided or heavy help (spec §34 "assistance dependence"). */
export function assistanceDependence(recent: SessionInput['recent_evidence']): number {
  const passes = recent.filter(isPass);
  if (passes.length === 0) return 0;
  const assisted = passes.filter(
    (e) => assistanceRank(effectiveAssistance(e)) >= assistanceRank('guided'),
  ).length;
  return Math.round((assisted / passes.length) * 100) / 100;
}

export function buildSession(input: SessionInput): SessionPlan {
  const ctx: Context = {
    input,
    skills: new Map(input.skills.map((s) => [s.id, s])),
    evaluations: new Map(input.evaluations.map((e) => [e.skill_id, e])),
    order: new Map(input.path_order.map((id, index) => [id, index])),
    used: new Set(),
    passedExercises: new Set(
      input.recent_evidence
        .filter((e) => isPass(e) && e.exercise_id)
        .map((e) => e.exercise_id as string),
    ),
    budget: SESSION_RULES.budgets_minutes[input.length],
    planned: 0,
  };
  const notes: string[] = [];
  const blocks: SessionBlock[] = [];
  const byPath = (a: string, b: string) =>
    (ctx.order.get(a) ?? 1e9) - (ctx.order.get(b) ?? 1e9) || a.localeCompare(b);
  const windowStart = input.now.getTime() - SESSION_RULES.recent_window_days * DAY_MS;
  const recent = input.recent_evidence.filter((e) => Date.parse(e.occurred_at) >= windowStart);
  const dependence = assistanceDependence(recent);

  // 1. Retrieval: due reviews, highest priority first, within its share; never blocks anything.
  const retrieval: SessionBlock = { kind: 'retrieval', title: 'Retrieval', items: [] };
  const retrievalBudget = Math.floor(ctx.budget * SESSION_RULES.retrieval_share);
  for (const item of input.review.due) {
    if (
      retrieval.items.length * REVIEW_RULES.retrieval_minutes + REVIEW_RULES.retrieval_minutes >
      retrievalBudget
    )
      break;
    add(
      ctx,
      retrieval,
      retrievalItem(
        ctx,
        item.skill_id,
        `${item.reason.replace('_', ' ')} review (priority ${item.priority})`,
      ),
    );
  }
  if (retrieval.items.length) blocks.push(retrieval);
  notes.push(
    `${input.review.due.length} review due, ${retrieval.items.length} scheduled (share ${SESSION_RULES.retrieval_share})`,
  );

  // 2. Repair: weak prerequisites of what comes next, recent failures, assisted passes.
  const repair: SessionBlock = { kind: 'repair', title: 'Repair', items: [] };
  const repairBudget = Math.floor(ctx.budget * SESSION_RULES.repair_share);
  const targets = [
    ...(input.campaign?.next_required ?? []),
    ...(input.focus?.skill_id ? [input.focus.skill_id] : []),
  ];
  const weakPrerequisites = [
    ...new Set(targets.flatMap((id) => ctx.skills.get(id)?.prerequisites ?? [])),
  ]
    .filter((id) => {
      const evaluation = ctx.evaluations.get(id);
      return evaluation && !atLeast(evaluation, 'INDEPENDENT');
    })
    .sort(byPath);
  const recentFailures = [...new Set(recent.filter(isFailure).map((e) => e.skill_id))].sort(byPath);
  const assistedPasses =
    dependence >= SESSION_RULES.assistance_dependence_threshold
      ? [
          ...new Set(
            recent
              .filter(
                (e) =>
                  isPass(e) && assistanceRank(effectiveAssistance(e)) >= assistanceRank('guided'),
              )
              .map((e) => e.skill_id),
          ),
        ].sort(byPath)
      : [];
  const repairMinutes = () => repair.items.reduce((sum, item) => sum + item.minutes, 0);
  for (const [list, why] of [
    [weakPrerequisites, 'weak prerequisite of your next work'],
    [recentFailures, 'failed recently'],
    [assistedPasses, 'passed with help recently: try it without hints'],
  ] as const) {
    for (const skillId of list) {
      if (repairMinutes() >= repairBudget) break;
      const step = nextStepFor(ctx, skillId);
      if (step) add(ctx, repair, { ...step, reason: `${why} — ${step.reason}` });
    }
  }
  if (repair.items.length) blocks.push(repair);
  notes.push(
    `assistance dependence ${dependence}; ${weakPrerequisites.length} weak prerequisite(s), ${recentFailures.length} recent failure(s)`,
  );

  // 3. Focus: what the learner asked for.
  if (input.focus?.skill_id || input.focus?.territory) {
    const focus: SessionBlock = { kind: 'focus', title: 'Your focus', items: [] };
    const focusSkills = input.focus.skill_id
      ? [input.focus.skill_id]
      : input.skills
          .filter((s) => s.territory === input.focus?.territory)
          .map((s) => s.id)
          .sort(byPath);
    for (const skillId of focusSkills) add(ctx, focus, nextStepFor(ctx, skillId));
    if (focus.items.length) blocks.push(focus);
    notes.push(
      `focus on ${input.focus.skill_id ?? input.focus.territory}: ${focus.items.length} item(s)`,
    );
  }

  // 4. Campaign: next required work, then work ahead.
  const campaign: SessionBlock = { kind: 'campaign', title: 'Campaign', items: [] };
  const required = [...(input.campaign?.next_required ?? [])].sort(byPath);
  const ahead = [...(input.campaign?.work_ahead ?? [])].sort(byPath);
  for (const skillId of required) add(ctx, campaign, nextStepFor(ctx, skillId));
  for (const skillId of ahead) {
    if (ctx.planned >= ctx.budget) break;
    const step = nextStepFor(ctx, skillId);
    if (step) add(ctx, campaign, { ...step, reason: `work ahead — ${step.reason}` });
  }
  if (campaign.items.length) blocks.push(campaign);
  notes.push(
    `campaign ${input.campaign?.campaign_id ?? 'none'}: gate ${input.campaign?.current_gate ?? '—'}, ${required.length} required, ${ahead.length} available ahead`,
  );

  // 5. Fieldwork and the active project.
  const fieldwork: SessionBlock = { kind: 'fieldwork', title: 'Fieldwork', items: [] };
  for (const exerciseId of [...(input.pending_fieldwork ?? [])].sort()) {
    const exercise = input.content.exercises[exerciseId];
    if (!exercise) continue;
    add(ctx, fieldwork, {
      id: itemId('exercise', exercise.id, exercise.skills[0] ?? ''),
      kind: 'exercise',
      content_id: exercise.id,
      skill_id: exercise.skills[0] ?? '',
      minutes: exercise.estimated_minutes,
      reason: 'real-GHL fieldwork this gate requires',
    });
  }
  if (fieldwork.items.length) blocks.push(fieldwork);
  if (input.active_project) {
    const project: SessionBlock = { kind: 'project', title: 'Project', items: [] };
    for (const exerciseId of input.active_project.next_exercises) {
      const exercise = input.content.exercises[exerciseId];
      if (!exercise) continue;
      add(ctx, project, {
        id: itemId('exercise', exercise.id, exercise.skills[0] ?? ''),
        kind: 'exercise',
        content_id: exercise.id,
        skill_id: exercise.skills[0] ?? '',
        minutes: exercise.estimated_minutes,
        reason: `next stage of ${input.active_project.id}`,
      });
    }
    if (project.items.length) blocks.push(project);
  }

  return {
    length: input.length,
    budget_minutes: ctx.budget,
    planned_minutes: ctx.planned,
    blocks,
    assistance_dependence: dependence,
    continue_available: true,
    rules_version: MASTERY_RULES_VERSION,
    notes,
  };
}

export interface NextStepInput {
  skill: SkillDefinition;
  evaluation: SkillEvaluation;
  content: SessionInput['content'];
  /** Passed exercises are avoided when an alternative exists. */
  recent_evidence?: SessionInput['recent_evidence'];
}

/** The next useful step for one skill on its own (screens use it outside a full session). */
export function nextStepForSkill(input: NextStepInput): SessionItem | null {
  const recent = input.recent_evidence ?? [];
  const ctx: Context = {
    input: {
      length: '30m',
      now: new Date(0),
      skills: [input.skill],
      evaluations: [input.evaluation],
      campaign: null,
      path_order: [],
      review: { due: [], upcoming: [] },
      recent_evidence: recent,
      content: input.content,
    },
    skills: new Map([[input.skill.id, input.skill]]),
    evaluations: new Map([[input.skill.id, input.evaluation]]),
    order: new Map(),
    used: new Set(),
    passedExercises: new Set(
      recent.filter((e) => isPass(e) && e.exercise_id).map((e) => e.exercise_id as string),
    ),
    budget: 0,
    planned: 0,
  };
  return nextStepFor(ctx, input.skill.id);
}
