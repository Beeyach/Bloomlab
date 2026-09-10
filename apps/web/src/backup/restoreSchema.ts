import { z } from 'zod';
import { SkillEvidenceSchema, MASTERY_LADDER, MASTERY_STATES } from '@bloomlab/mastery-engine';
import {
  ClientProgressRecordSchema,
  PortfolioAssetRecordSchema,
  PortfolioCaptureSchema,
  PortfolioProjectRecordSchema,
} from '@bloomlab/content-schema';
import { BACKUP_COLUMNS, BACKUP_ENVELOPE, BackupSchema, safeBackupValue } from './export';

const id = z.string().min(1).max(500);
const strings = z.array(z.string());
const count = z.number().int().nonnegative();
const iso = z.iso.datetime({ offset: true });
const object = z.record(z.string(), z.unknown());
export const restoreEnvelope = z.strictObject({
  id,
  learner_id: id,
  device_id: id,
  created_at: iso,
  updated_at: iso,
  revision: count.min(1),
  deleted_at: iso.nullable(),
});
const evidence = SkillEvidenceSchema.extend(restoreEnvelope.shape);
const assertion = z.strictObject({
  id,
  description: z.string(),
  type: z.enum(['state', 'event', 'timing', 'architecture', 'negative', 'sequence']),
  tier: z.enum(['critical', 'required', 'quality', 'bonus']),
  dimension: z.string(),
  passed: z.boolean(),
  expected: z.string(),
  observed: z.string(),
  detail: object.optional(),
  unevaluated: z.boolean().optional(),
  missing_source: z.string().optional(),
});
const grade = z.strictObject({
  exercise_id: id,
  grader_version: id,
  outcome: z.enum(['passed', 'failed', 'partial']),
  reason: z.enum([
    'critical_failure',
    'required_failure',
    'below_threshold',
    'threshold_met',
    'rubric_pending',
    'unevaluated_assertions',
    'nothing_to_grade',
  ]),
  score: z.number().min(0).max(100).nullable(),
  dimensions: z
    .record(
      z.string(),
      z.strictObject({
        weight: z.number(),
        total: count,
        passed: count,
        ratio: z.number().min(0).max(1).nullable(),
      }),
    )
    .nullable(),
  pass_threshold: z.number().min(0).max(100),
  assistance: evidence.shape.assistance,
  hints_used: evidence.shape.hints_used,
  failed_critical: strings,
  tiers: z.strictObject({
    critical: z.array(assertion),
    required: z.array(assertion),
    quality: z.array(assertion),
    bonus: z.array(assertion),
  }),
  counts: z.strictObject({
    scored_total: count,
    scored_passed: count,
    critical_total: count,
    critical_passed: count,
    unevaluated: count,
  }),
  rubric_pending: id.nullable(),
  rubric_evaluation: z
    .strictObject({
      run_id: id,
      rubric_id: id,
      rubric_version: count.min(1),
      result: z.strictObject({
        score: z.number(),
        rubric_results: z.array(z.strictObject({ id, passed: z.boolean(), reason: z.string() })),
        critical_issue: z.string().nullable(),
        strengths: strings,
        improvements: strings,
        next_probe: z.string(),
        confidence: z.number().min(0).max(1),
      }),
    })
    .optional(),
});
const response = z.strictObject({
  text: z.string(),
  choice: z.string().nullable(),
  prediction: z.record(z.string(), z.string()),
  written: z.record(z.string(), z.string()).optional(),
  sequence: strings.optional(),
  review: object.optional(),
  fieldwork: object.optional(),
  call: object.optional(),
  sales: object.optional(),
  pricing: object.optional(),
  negotiation: object.optional(),
});
const attempt = z.strictObject({
  ...restoreEnvelope.shape,
  exercise_id: id.nullable(),
  exercise_type: id.nullable(),
  skill_ids: strings,
  source: evidence.shape.source,
  started_at: iso,
  completed_at: iso,
  result: evidence.shape.result,
  score: evidence.shape.score,
  assistance: evidence.shape.assistance,
  hints_used: evidence.shape.hints_used,
  difficulty: evidence.shape.difficulty,
  critical_failures: strings,
  mode: evidence.shape.mode,
  versions: evidence.shape.versions,
  portfolio_capture: PortfolioCaptureSchema.nullable().optional(),
  response: response.nullable().optional(),
  grade: grade.nullable().optional(),
});

/** The v1 export permits flexible payloads, but never new columns or connection/media state. */
function exportedRow(table: keyof typeof BACKUP_COLUMNS) {
  return object.superRefine((value, ctx) => {
    const allowed = new Set<string>([...BACKUP_ENVELOPE, ...BACKUP_COLUMNS[table]]);
    for (const key of Object.keys(value))
      if (!allowed.has(key))
        ctx.addIssue({ code: 'custom', path: [key], message: 'Field is not in the export format' });
    const envelope = restoreEnvelope.safeParse(
      Object.fromEntries(BACKUP_ENVELOPE.map((k) => [k, value[k]])),
    );
    if (!envelope.success)
      ctx.addIssue({ code: 'custom', message: 'Invalid record identity or dates' });
  });
}
const progressSchemas = {
  skill_progress: z.strictObject({
    ...restoreEnvelope.shape,
    skill_id: id,
    state: z.enum(MASTERY_STATES),
    ladder_state: z.enum(MASTERY_LADDER),
    refresh_from: z.enum(MASTERY_LADDER).nullable(),
    refresh_reason: z.enum(['overdue', 'failed_retrieval']).nullable(),
    confidence: z.number(),
    missing_requirements: z.array(
      z.enum([
        'practice',
        'independent_evidence',
        'pressure_test',
        'real_ghl_fieldwork',
        'sales_use',
        'refresh',
      ]),
    ),
    review_priority: z.number(),
    review_due: z.string().nullable(),
    last_demonstrated: z.string().nullable(),
    counts: z.strictObject({
      evidence: count,
      exposures: count,
      attempts: count,
      passes: count,
      guided_passes: count,
      practiced_passes: count,
      independent_passes: count,
      independent_demonstrations: count,
      pressure_passes: count,
      fieldwork_passes: count,
      sales_use_passes: count,
      failures: count,
    }),
    rules_version: id,
    content_version: id,
    computed_at: iso,
  }),
  campaign_progress: z.strictObject({
    ...restoreEnvelope.shape,
    campaign_id: id,
    current_gate: id.nullable(),
    gates: z.array(
      z.strictObject({
        gate: id,
        status: z.enum(['locked', 'available', 'in_progress', 'passed', 'optional']),
        passed_count: count,
        total: count,
      }),
    ),
    passed_gates: strings,
    next_required: strings,
    work_ahead: strings,
    complete: z.boolean(),
    rules_version: id,
    content_version: id,
    computed_at: iso,
  }),
  review_queue: z.strictObject({
    ...restoreEnvelope.shape,
    skill_id: id,
    due_at: z.string(),
    priority: z.number(),
    reason: z.enum(['due', 'overdue', 'needs_refresh']),
    status: z.enum(['due', 'upcoming', 'none']),
    last_demonstrated: z.string().nullable(),
    state: z.enum(MASTERY_STATES),
    rules_version: id,
    computed_at: iso,
  }),
};
const savedProject = z.strictObject({
  ...restoreEnvelope.shape,
  scenario_id: id,
  run_id: id,
  generation: id.optional(),
  simulator_version: id,
  clock_now: iso,
  timezone: id,
  account: object,
  queue: z.array(object),
  random: z.strictObject({
    seed: count.max(4294967295),
    word: count.max(4294967295),
    draws: count,
  }),
  sequence: count,
  queue_sequence: count,
  log_length: count,
  execution: z.array(object),
  diagnostics: z.array(object),
});
export const RestoreSchema = BackupSchema.extend({
  progress: z.strictObject({
    skill_progress: z.array(exportedRow('skill_progress').pipe(progressSchemas.skill_progress)),
    campaign_progress: z.array(
      exportedRow('campaign_progress').pipe(progressSchemas.campaign_progress),
    ),
    review_queue: z.array(exportedRow('review_queue').pipe(progressSchemas.review_queue)),
  }),
  evidence: z.strictObject({
    skill_evidence: z.array(evidence),
    exercise_attempts: z.array(attempt),
    private_assets: z.array(
      z.strictObject({
        asset_id: id,
        attempt_id: id,
        exercise_id: id,
        item_key: id,
        status: z.enum(['local', 'uploaded', 'deleting', 'deleted']),
      }),
    ),
  }),
  projects: z.strictObject({
    sim_projects: z.array(savedProject),
    client_progress: z.array(ClientProgressRecordSchema).default([]),
  }),
  notes: z.array(
    z.strictObject({
      ...restoreEnvelope.shape,
      body: z.string(),
      target_kind: z.enum(['general', 'skill', 'topic', 'scenario', 'client']),
      target_ref: id.nullable(),
    }),
  ),
  simulator_saves: z.strictObject({
    sim_events: z.array(
      z.strictObject({
        ...restoreEnvelope.shape,
        run_id: id,
        generation: id.optional(),
        sequence: count,
        event: object,
      }),
    ),
    sim_snapshots: z.array(
      z.strictObject({
        ...restoreEnvelope.shape,
        run_id: id,
        generation: id.optional(),
        log_length: count,
        label: z.string(),
        checkpoint: object,
      }),
    ),
  }),
  portfolio_metadata: z.strictObject({
    portfolio_projects: z.array(PortfolioProjectRecordSchema),
    portfolio_assets: z.array(PortfolioAssetRecordSchema),
  }),
});

export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
/** Bounded JSON walk BEFORE recursive schemas/sanitization; poison keys are rejected, not stripped. */
export function assertSafeBackup(value: unknown) {
  const stack: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const item = stack.pop()!;
    if (++nodes > 500_000 || item.depth > 60)
      throw new Error('Backup is too large or deeply nested.');
    if (typeof item.value === 'number' && !Number.isFinite(item.value))
      throw new Error('Backup contains an invalid number.');
    if (!item.value || typeof item.value !== 'object') continue;
    for (const [key, child] of Object.entries(item.value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key))
        throw new Error('Backup contains an unsafe key.');
      stack.push({ value: child, depth: item.depth + 1 });
    }
  }
  // This also refuses unsafe named headers and credential-bearing URL/string values.
  // Top-level private_assets is reference-only metadata, not raw media.
  if (JSON.stringify(safeBackupValue(value)) !== JSON.stringify(value))
    throw new Error('Backup contains fields or private values excluded by Export Bloomlab Data.');
}
