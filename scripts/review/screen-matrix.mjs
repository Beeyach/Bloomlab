// Authoritative learner screen inventory. Router entries come from the actual APP_ROUTES AST;
// detail and runner instances come from the compiled content bundle. Browser probes import the
// resulting tuples, so a new learner route or exercise family cannot silently miss review.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

export const REQUIRED_WIDTHS = [1440, 1024, 768, 390, 320];

const routePath = resolve('apps/web/src/app/routes.tsx');
const routeSource = ts.createSourceFile(
  routePath,
  readFileSync(routePath, 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

function propertyString(object, name) {
  const property = object.properties.find(
    (candidate) =>
      ts.isPropertyAssignment(candidate) &&
      ((ts.isIdentifier(candidate.name) && candidate.name.text === name) ||
        (ts.isStringLiteral(candidate.name) && candidate.name.text === name)),
  );
  return property && ts.isPropertyAssignment(property) && ts.isStringLiteral(property.initializer)
    ? property.initializer.text
    : null;
}

function readRouter() {
  let routes = null;
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'APP_ROUTES'
    ) {
      let initializer = node.initializer;
      if (initializer && ts.isAsExpression(initializer)) initializer = initializer.expression;
      if (initializer && ts.isArrayLiteralExpression(initializer)) {
        routes = initializer.elements.filter(ts.isObjectLiteralExpression).map((entry) => ({
          id: propertyString(entry, 'id'),
          path: propertyString(entry, 'path'),
          flag: propertyString(entry, 'flag'),
        }));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(routeSource);
  assert(routes, 'APP_ROUTES array not found');
  assert(
    routes.every((route) => route.id && route.path),
    'Every route must have literal id/path',
  );
  return routes;
}

export const ROUTER_INVENTORY = readRouter();
export const DEVELOPER_ROUTES = ROUTER_INVENTORY.filter((route) => route.flag);
const learnerRoutes = ROUTER_INVENTORY.filter((route) => !route.flag);
const bundle = JSON.parse(readFileSync(resolve('.content/bundle.json'), 'utf8'));

const prefer = (rows, id) => rows.find((row) => row.id === id) ?? rows[0];
const slug = (value) => value.toLowerCase().replaceAll('_', '-');

function academyRepresentatives() {
  const components = new Set(
    bundle.learning_units.flatMap((unit) => unit.embeds.map((embed) => embed.component)),
  );
  const remaining = new Set(components);
  const selected = [];
  while (remaining.size) {
    const candidate = [...bundle.learning_units]
      .map((unit) => ({
        unit,
        coverage: new Set(
          unit.embeds.map((embed) => embed.component).filter((kind) => remaining.has(kind)),
        ),
      }))
      .sort((a, b) => b.coverage.size - a.coverage.size || a.unit.id.localeCompare(b.unit.id))[0];
    assert(candidate.coverage.size > 0, `No Academy unit covers ${[...remaining].join(', ')}`);
    selected.push({ ...candidate.unit, embed_components: [...candidate.coverage].sort() });
    candidate.coverage.forEach((kind) => remaining.delete(kind));
  }
  return selected;
}

function exerciseFamily(type) {
  if (type === 'PRICE_IT') return 'pricing';
  if (type === 'NEGOTIATE_IT') return 'negotiation';
  if (type === 'SAY_IT') return 'call-room';
  if (type === 'FIELDWORK') return 'fieldwork';
  if (['PROSPECT_IT', 'AUDIT_IT', 'WRITE_IT'].includes(type)) return 'sales-delivery';
  return 'exercise-runner';
}

function instantiate(route) {
  if (!route.path.includes(':'))
    return [{ name: route.id, path: route.path, route_id: route.id, family: route.id }];
  switch (route.id) {
    case 'skill': {
      const skill = prefer(bundle.skills, 'SK-STRATEGIZE-funnel-math');
      return [
        {
          name: 'skill-detail',
          path: `/skills/${skill.id}`,
          route_id: route.id,
          family: 'skills',
          content_id: skill.id,
        },
      ];
    }
    case 'academy-unit':
      return academyRepresentatives().map((unit) => ({
        name: `academy-${unit.id.replace(/^LU-/, '').toLowerCase()}`,
        path: `/academy/${unit.id}`,
        route_id: route.id,
        family: 'academy',
        content_id: unit.id,
        derived_coverage: unit.embed_components,
      }));
    case 'exercise': {
      const byType = new Map();
      for (const exercise of [...bundle.exercises].sort((a, b) => a.id.localeCompare(b.id)))
        if (!byType.has(exercise.type)) byType.set(exercise.type, exercise);
      return [...byType]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([type, exercise]) => ({
          name: `exercise-${slug(type)}`,
          path: `/exercise/${exercise.id}`,
          route_id: route.id,
          family: exerciseFamily(type),
          content_id: exercise.id,
          exercise_type: type,
        }));
    }
    case 'incident-case': {
      const scenario = prefer(
        bundle.scenarios.filter((row) => row.incident),
        'SC-glowhaus-incident-missing-phone',
      );
      return [
        {
          name: 'incident-case',
          path: `/incident/${scenario.id}`,
          route_id: route.id,
          family: 'incident',
          content_id: scenario.id,
        },
      ];
    }
    case 'client': {
      const client = prefer(bundle.clients, 'CL-glowhaus-medspa');
      return [
        {
          name: 'client-detail',
          path: `/clients/${client.id}`,
          route_id: route.id,
          family: 'clients',
          content_id: client.id,
        },
      ];
    }
    case 'project': {
      const project = prefer(bundle.projects, 'PRJ-consultation-booking-system');
      return [
        {
          name: 'project-detail',
          path: `/projects/${project.id}`,
          route_id: route.id,
          family: 'clients',
          content_id: project.id,
        },
      ];
    }
    case 'portfolio-item': {
      const item = prefer(bundle.portfolio, 'PF-consultation-booking-system');
      return [
        {
          name: 'portfolio-item',
          path: `/portfolio/${item.id}`,
          route_id: route.id,
          family: 'portfolio',
          content_id: item.id,
        },
      ];
    }
    default:
      assert.fail(`No content-derived representative for dynamic route ${route.id}`);
  }
}

export const SCREEN_INVENTORY = [
  ...learnerRoutes.flatMap(instantiate),
  {
    name: 'not-found',
    path: '/field-ready-review-not-a-route',
    route_id: 'not-found',
    family: 'not-found',
  },
];

assert.equal(
  new Set(SCREEN_INVENTORY.map((screen) => screen.name)).size,
  SCREEN_INVENTORY.length,
  'Screen names must be unique',
);
assert.equal(
  new Set(SCREEN_INVENTORY.map((screen) => screen.path)).size,
  SCREEN_INVENTORY.length,
  'Screen paths must be unique',
);
assert.deepEqual(
  [
    ...new Set(
      SCREEN_INVENTORY.map((screen) => screen.route_id).filter((id) => id !== 'not-found'),
    ),
  ].sort(),
  learnerRoutes.map((route) => route.id).sort(),
  'Every learner router entry needs a review screen',
);
assert.deepEqual(
  SCREEN_INVENTORY.filter((screen) => screen.exercise_type)
    .map((screen) => screen.exercise_type)
    .sort(),
  [...new Set(bundle.exercises.map((exercise) => exercise.type))].sort(),
  'Every authored exercise family needs a runner screen',
);

export const SCREEN_MATRIX = SCREEN_INVENTORY.map(({ name, path }) => [name, path]);
