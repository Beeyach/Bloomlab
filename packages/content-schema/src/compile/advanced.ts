import { ADVANCED_TOPICS } from '../schemas/advanced.ts';
import type { IssueList, ParsedContent } from './validate.ts';

export function advancedCoverage(content: Omit<ParsedContent, 'paths'>) {
  return ADVANCED_TOPICS.map((topic) => ({
    topic,
    units: content.learning_units
      .filter((unit) => unit.advanced_topics.includes(topic))
      .map((unit) => unit.id),
    exercises: content.exercises
      .filter((exercise) => exercise.advanced_topics.includes(topic))
      .map((exercise) => exercise.id),
  }));
}

export function validateAdvanced(
  content: ParsedContent,
  enforced: readonly string[],
  issues: IssueList,
) {
  const dependsOn = (id: string, target: string, seen = new Set<string>()): boolean => {
    if (id === target) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return (
      content.skills
        .find((skill) => skill.id === id)
        ?.prerequisites.some((parent) => dependsOn(parent, target, seen)) ?? false
    );
  };
  for (const unit of content.learning_units.filter((unit) =>
    unit.advanced_topics.some((topic) => topic.startsWith('ai.')),
  )) {
    for (const skill of unit.skills) {
      if (
        !dependsOn(skill, 'SK-AUTOMATE-workflow-foundations') ||
        !dependsOn(skill, 'SK-JUDGMENT-ai-boundaries')
      )
        issues.error(
          'ADVANCED_AI_ORDER',
          content.paths[unit.id] ?? null,
          `${unit.id}: AI instruction requires deterministic workflow and AI-boundary prerequisites`,
        );
    }
  }
  for (const row of advancedCoverage(content)) {
    if (!enforced.includes(row.topic)) continue;
    if (!row.units.length || !row.exercises.length)
      issues.error(
        'ADVANCED_COVERAGE',
        null,
        `${row.topic} requires authored learn and practical coverage`,
      );
    for (const id of row.exercises) {
      const exercise = content.exercises.find((item) => item.id === id)!;
      if (
        !exercise.expected_outcomes.length ||
        !row.units.some((unitId) =>
          content.learning_units
            .find((unit) => unit.id === unitId)
            ?.skills.some((skill) => exercise.skills.includes(skill)),
        )
      )
        issues.error(
          'ADVANCED_COVERAGE',
          content.paths[id] ?? null,
          `${id} requires graded practical work linked to its topic's learning skill`,
        );
    }
  }
  for (const item of [...content.learning_units, ...content.exercises]) {
    if (!item.advanced_topics.length) continue;
    const refs = 'ghl_features' in item ? item.ghl_features : item.allowed_features;
    for (const id of refs)
      if (content.ghl_features.find((feature) => feature.id === id)?.status !== 'current')
        issues.error(
          'ADVANCED_GHL_CURRENT',
          content.paths[item.id] ?? null,
          `${item.id}: ${id} needs current official registry evidence`,
        );
  }
}
