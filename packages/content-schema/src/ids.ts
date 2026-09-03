/**
 * Content types, folders and ID conventions (spec §98, CONTENT_ARCHITECTURE.md §7).
 *
 * Every content record lives in `content/<folder>/<id>.<ext>`; the file name must equal the
 * record's `id` so a reference can always be found by hand as well as by the compiler.
 */

export const CONTENT_TYPES = [
  'skills',
  'ghl-features',
  'campaigns',
  'learning-units',
  'exercises',
  'scenarios',
  'clients',
  'rubrics',
  'projects',
  'portfolio',
  'glossary',
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

/** Skill territories (spec §12, CUR-016): nine territories plus JUDGMENT, measured centrally. */
export const TERRITORIES = [
  'STRATEGIZE',
  'BUILD',
  'AUTOMATE',
  'ARCHITECT',
  'DIAGNOSE',
  'CONNECT',
  'SELL',
  'DELIVER',
  'SCALE',
  'JUDGMENT',
] as const;

export type Territory = (typeof TERRITORIES)[number];

/** Exercise families (spec §27, EXR-004 … EXR-021). */
export const EXERCISE_TYPES = [
  'BUILD_IT',
  'FIX_IT',
  'RUN_THE_LEAD',
  'EDGE_CASE',
  'WHAT_WOULD_YOU_BUILD',
  'ARCHITECTURE_DECISION',
  'FUNNEL_AUTOPSY',
  'FUNNEL_ASSEMBLY',
  'PROSPECT_IT',
  'AUDIT_IT',
  'WRITE_IT',
  'SAY_IT',
  'PRICE_IT',
  'NEGOTIATE_IT',
  'EXPLAIN_IT',
  'REBUILD_BLIND',
  'FIELDWORK',
  'BOSS_CLIENT',
] as const;

export type ExerciseType = (typeof EXERCISE_TYPES)[number];

const slug = '[a-z0-9]+(?:-[a-z0-9]+)*';
const upperSlug = '[A-Z0-9]+(?:-[A-Z0-9]+)*';

/** One pattern per content type; the compiler rejects any ID that does not match. */
export const ID_PATTERNS: Readonly<Record<ContentType, RegExp>> = {
  skills: new RegExp(`^SK-(?:${TERRITORIES.join('|')})-${slug}$`),
  'ghl-features': new RegExp(`^GHL-[A-Z]{2,6}-${upperSlug}$`),
  campaigns: /^CAMP-[A-Z][A-Z0-9_]*$/,
  'learning-units': new RegExp(`^LU-${slug}$`),
  exercises: new RegExp(`^EX-(?:${EXERCISE_TYPES.join('|')})-${slug}$`),
  scenarios: new RegExp(`^SC-${slug}$`),
  clients: new RegExp(`^CL-${slug}$`),
  rubrics: /^[A-Z][A-Z0-9_]*_RUBRIC_V[1-9][0-9]*$/,
  projects: new RegExp(`^PRJ-${slug}$`),
  portfolio: new RegExp(`^PF-${slug}$`),
  glossary: new RegExp(`^GL-${slug}$`),
};

export function isValidId(type: ContentType, id: string): boolean {
  return ID_PATTERNS[type].test(id);
}

/** The territory encoded in a skill ID (`SK-AUTOMATE-…` → `AUTOMATE`), or null. */
export function territoryOfSkillId(id: string): Territory | null {
  const match = /^SK-([A-Z]+)-/.exec(id);
  const territory = match?.[1];
  return territory && (TERRITORIES as readonly string[]).includes(territory)
    ? (territory as Territory)
    : null;
}

/** The exercise family encoded in an exercise ID (`EX-FIX_IT-…` → `FIX_IT`), or null. */
export function typeOfExerciseId(id: string): ExerciseType | null {
  const match = /^EX-([A-Z_]+)-/.exec(id);
  const type = match?.[1];
  return type && (EXERCISE_TYPES as readonly string[]).includes(type)
    ? (type as ExerciseType)
    : null;
}
