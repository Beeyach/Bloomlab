import { fileURLToPath } from 'node:url';
import { beforeAll, expect, it } from 'vitest';
import { compileContentDir } from '../src/node.ts';
import { POST_FIELD_READY_PATHS, validateAdvancedPaths } from '../src/compile/advancedPaths.ts';
import { IssueList, type ParsedContent } from '../src/compile/validate.ts';

let content: ParsedContent;
beforeAll(async () => {
  content = {
    ...(await compileContentDir(fileURLToPath(new URL('../../../content', import.meta.url)))),
    paths: {},
  };
});

it('CUR-032 authors exactly seven distinct paths over the one fully covered graph', () => {
  const paths = content.campaigns.filter((path) => path.post_field_ready);
  expect(paths.map((path) => path.title).sort()).toEqual([...POST_FIELD_READY_PATHS].sort());
  expect(paths.filter((path) => path.recommended).map((path) => path.title)).toEqual([
    'Bloomwired Operator Path',
  ]);
  const used = new Set(paths.flatMap((path) => path.gates.flatMap((gate) => gate.skills)));
  for (const unit of content.learning_units.filter((unit) => unit.advanced_topics.length)) {
    for (const id of unit.skills) expect(used.has(id), id).toBe(true);
  }
  for (const id of used) {
    expect(content.skills.filter((skill) => skill.id === id)).toHaveLength(1);
    expect(content.learning_units.some((unit) => unit.skills.includes(id))).toBe(true);
    expect(content.exercises.some((exercise) => exercise.skills.includes(id))).toBe(true);
  }
  const issues = new IssueList();
  validateAdvancedPaths(content, issues);
  expect(issues.errors).toEqual([]);
});

it.each(['missing', 'recommendation', 'foundation', 'empty', 'learning', 'practical'])(
  'rejects a broken path contract: %s',
  (mutation) => {
    const broken = structuredClone(content);
    const path = broken.campaigns.find((path) => path.id === 'CAMP-GHL_AI_SPECIALIST')!;
    if (mutation === 'missing')
      broken.campaigns = broken.campaigns.filter((candidate) => candidate !== path);
    if (mutation === 'recommendation') path.recommended = true;
    if (mutation === 'foundation') path.requires_campaigns = [];
    if (mutation === 'empty') path.gates[0]!.skills = [];
    if (mutation === 'learning')
      broken.learning_units = broken.learning_units.filter(
        (unit) => !unit.skills.includes(path.gates[0]!.skills[0]!),
      );
    if (mutation === 'practical')
      broken.exercises = broken.exercises.filter(
        (exercise) => !exercise.skills.includes(path.gates[0]!.skills[0]!),
      );
    const issues = new IssueList();
    validateAdvancedPaths(broken, issues);
    expect(issues.errors.some((issue) => issue.code === 'ADVANCED_PATHS')).toBe(true);
  },
);
