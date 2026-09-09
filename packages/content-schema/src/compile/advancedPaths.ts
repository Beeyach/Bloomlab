import type { IssueList, ParsedContent } from './validate.ts';

export const POST_FIELD_READY_PATHS = [
  'Automation Specialist',
  'Funnel & Conversion Specialist',
  'Sales Operator',
  'Technical GHL Specialist',
  'Agency Systems',
  'GHL AI Specialist',
  'Bloomwired Operator Path',
] as const;

/** Seven curated references, never seven copies of the underlying capabilities. */
export function validateAdvancedPaths(content: ParsedContent, issues: IssueList) {
  const paths = content.campaigns.filter((path) => path.post_field_ready);
  const fail = (message: string) => issues.error('ADVANCED_PATHS', null, message);
  if (
    paths.length !== POST_FIELD_READY_PATHS.length ||
    POST_FIELD_READY_PATHS.some(
      (title) => paths.filter((path) => path.title === title).length !== 1,
    )
  )
    fail('All seven distinct post-Field-Ready paths must be authored');
  const recommended = paths.filter((path) => path.recommended);
  if (recommended.length !== 1 || recommended[0]?.title !== 'Bloomwired Operator Path')
    fail('Only Bloomwired Operator Path is the recommended post-Field-Ready path');
  for (const path of paths) {
    if (!path.requires_campaigns.includes('CAMP-FIELD_READY'))
      fail(`${path.id} must retain the Field Ready foundation`);
    for (const gate of path.gates) {
      if (!gate.skills.length) fail(`${path.id}/${gate.id} needs actual graph skills`);
      for (const id of gate.skills) {
        if (
          !content.learning_units.some((unit) => unit.skills.includes(id)) ||
          !content.exercises.some((exercise) => exercise.skills.includes(id))
        )
          fail(`${path.id}: ${id} needs authored learning and practical coverage`);
      }
    }
  }
}
