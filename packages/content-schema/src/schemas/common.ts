import { z } from 'zod';

import { ID_PATTERNS, type ContentType } from '../ids.ts';

/** A reference to a record of another (or the same) content type; existence is checked later. */
export const ref = (type: ContentType) =>
  z.string().regex(ID_PATTERNS[type], `Not a valid ${type} ID`);

export const skillRef = ref('skills');
export const featureRef = ref('ghl-features');
export const campaignRef = ref('campaigns');
export const unitRef = ref('learning-units');
export const exerciseRef = ref('exercises');
export const scenarioRef = ref('scenarios');
export const clientRef = ref('clients');
export const rubricRef = ref('rubrics');
export const projectRef = ref('projects');
export const portfolioRef = ref('portfolio');

/** A short human label. */
export const title = z.string().trim().min(3).max(120);

/** Prose in Markdown; never empty. */
export const markdown = z.string().trim().min(1);

/** `YYYY-MM-DD`, checked to be a real calendar date. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine((value) => {
    const [y, m, d] = value.split('-').map(Number) as [number, number, number];
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }, 'Not a real calendar date');

/** ISO 8601 date-time with an explicit offset or `Z`, so simulation clocks are unambiguous. */
export const isoDateTime = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/,
    'Expected an ISO date-time with offset',
  )
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Not a parseable date-time');

const knownTimeZones: ReadonlySet<string> | null =
  typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl
    ? new Set(Intl.supportedValuesOf('timeZone'))
    : null;

/** An IANA time zone such as `America/New_York`. */
export const timeZone = z
  .string()
  .regex(/^[A-Za-z_]+(?:\/[A-Za-z_+-]+)+$|^UTC$/, 'Expected an IANA time zone')
  .refine(
    (value) => !knownTimeZones || value === 'UTC' || knownTimeZones.has(value),
    'Unknown time zone',
  );

/** Learner tiers (spec §14–§24 curriculum tiers). */
export const TIERS = ['field_ready', 'practitioner', 'advanced', 'specialist'] as const;
export const tier = z.enum(TIERS);
export type Tier = (typeof TIERS)[number];

/** The fourteen judgment decisions (spec §13, CUR-017). */
export const JUDGMENT_COMPETENCIES = [
  'funnel_needed',
  'automation_appropriate',
  'ghl_appropriate',
  'tag_or_field',
  'custom_code_warranted',
  'contact_prospect',
  'evidence_supports_claim',
  'accept_project',
  'scope_realistic',
  'price_realistic',
  'complexity_justified',
  'admit_not_knowing',
  'what_could_break',
  'what_is_missing',
] as const;
export const judgmentCompetency = z.enum(JUDGMENT_COMPETENCIES);
export type JudgmentCompetency = (typeof JUDGMENT_COMPETENCIES)[number];

/** Free-form typed facts hidden from the learner until the exercise reveals them. */
export const factRecord = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));

/** A non-empty list of unique strings. */
export const stringList = z.array(z.string().trim().min(1));

export function uniqueBy<T>(items: readonly T[], key: (item: T) => string): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) duplicates.push(k);
    seen.add(k);
  }
  return duplicates;
}

/** Adds an issue for every duplicate value in `items`. */
export function requireUnique(
  ctx: z.RefinementCtx,
  items: readonly string[],
  path: (string | number)[],
  what: string,
): void {
  for (const duplicate of uniqueBy(items, (s) => s)) {
    ctx.addIssue({ code: 'custom', path, message: `Duplicate ${what}: ${duplicate}` });
  }
}
