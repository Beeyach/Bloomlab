#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  DEVELOPER_ROUTES,
  REQUIRED_WIDTHS,
  ROUTER_INVENTORY,
  SCREEN_INVENTORY,
} from './screen-matrix.mjs';

const out = resolve(process.env.REVIEW_OUT ?? '.review/field-ready-screen-inventory');
mkdirSync(out, { recursive: true });
const report = {
  schema_version: 1,
  generated_from: [
    'apps/web/src/app/routes.tsx#APP_ROUTES',
    '.content/bundle.json#skills,learning_units,exercises,scenarios,clients,projects,portfolio',
  ],
  required_widths: REQUIRED_WIDTHS,
  router_entries: ROUTER_INVENTORY.length,
  learner_screens: SCREEN_INVENTORY.length,
  exercise_families: SCREEN_INVENTORY.filter((screen) => screen.exercise_type).length,
  screens: SCREEN_INVENTORY,
  developer_routes: DEVELOPER_ROUTES.map(({ id, path, flag }) => ({ id, path, flag })),
};
writeFileSync(resolve(out, 'screen-inventory.json'), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(
  resolve(out, 'screen-inventory.md'),
  [
    '# Field-Ready screen inventory',
    '',
    `Derived learner screens: ${report.learner_screens}`,
    `Router entries: ${report.router_entries}`,
    `Exercise families: ${report.exercise_families}`,
    `Required widths: ${REQUIRED_WIDTHS.join(' / ')}`,
    '',
    '| Screen | Route | Family | Derivation |',
    '| --- | --- | --- | --- |',
    ...SCREEN_INVENTORY.map(
      (screen) =>
        `| ${screen.name} | \`${screen.path}\` | ${screen.family} | ${screen.exercise_type ?? screen.content_id ?? screen.route_id} |`,
    ),
    '',
    'Developer-only routes are recorded separately and do not substitute for learner coverage:',
    '',
    ...report.developer_routes.map((route) => `- ${route.id}: \`${route.path}\` (${route.flag})`),
    '',
  ].join('\n'),
);
console.log(
  `Screen inventory: ${report.learner_screens} router/content-derived learner states; ${report.exercise_families} exercise families; ${report.developer_routes.length} developer routes separate.`,
);
