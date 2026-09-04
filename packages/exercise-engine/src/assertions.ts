import { describeValue, resolvePath } from './path.ts';
import { SEQUENCE_RULES, TIMING_RULES } from './rules.ts';
import {
  LEARNER_STATE_ROOTS,
  type AssertionDefinition,
  type AssertionResult,
  type AssertionTier,
  type ContextSource,
  type GradingContext,
  type GradingEvent,
} from './types.ts';
import { dimensionOf } from './dimensions.ts';

/** What one assertion must be able to read before it can be judged at all. */
export function sourcesFor(assertion: AssertionDefinition): ContextSource[] {
  switch (assertion.type) {
    case 'state': {
      const root = (assertion.path ?? '').split('.')[0] ?? '';
      return [(LEARNER_STATE_ROOTS as readonly string[]).includes(root) ? 'learner' : 'state'];
    }
    case 'event':
    case 'negative':
    case 'sequence':
      return ['events'];
    case 'timing':
      return ['events', 'references'];
    case 'architecture':
      return ['architecture'];
  }
}

const MINUTE = 60_000;

const byRunOrder = (a: GradingEvent, b: GradingEvent): number =>
  a.at.localeCompare(b.at) || a.index - b.index;

/** `where` is exact equality on the event's own fields; a field the run never set never matches. */
function matchesWhere(event: GradingEvent, where: AssertionDefinition['where']): boolean {
  if (!where) return true;
  return Object.entries(where).every(([field, expected]) => event.fields[field] === expected);
}

const describeWhere = (where: AssertionDefinition['where']): string =>
  where
    ? ` where ${Object.entries(where)
        .map(([field, value]) => `${field}=${String(value)}`)
        .join(', ')}`
    : '';

const eventsOfType = (context: GradingContext, type: string | undefined): GradingEvent[] =>
  context.events.filter((event) => event.type === type).sort(byRunOrder);

const matching = (context: GradingContext, assertion: AssertionDefinition): GradingEvent[] =>
  eventsOfType(context, assertion.event).filter((event) => matchesWhere(event, assertion.where));

/** STATE: a path in the state tree compared with an authored operator. */
function evaluateState(assertion: AssertionDefinition, context: GradingContext) {
  const path = assertion.path ?? '';
  const { found, value } = resolvePath(context.state, path);
  const target = assertion.value;
  const observed = found ? `${path} = ${describeValue(value)}` : `${path} is not in the state`;

  switch (assertion.operator) {
    case 'exists':
      return { passed: found && value !== null, expected: `${path} exists`, observed };
    case 'absent':
      return {
        passed: !found || value === null,
        expected: `${path} is absent`,
        observed,
      };
    case 'equals':
      return {
        passed: found && value === target,
        expected: `${path} = ${describeValue(target)}`,
        observed,
      };
    case 'contains':
    case 'not_contains': {
      const wants = assertion.operator === 'contains';
      let contains = false;
      if (Array.isArray(value)) contains = value.some((item) => item === target);
      else if (typeof value === 'string' && typeof target === 'string')
        contains = value.includes(target);
      return {
        passed: wants ? found && contains : !contains,
        expected: `${path} ${wants ? 'contains' : 'does not contain'} ${describeValue(target)}`,
        observed,
      };
    }
    case 'gte':
    case 'lte': {
      const numeric = typeof value === 'number' ? value : Number.NaN;
      const limit = typeof target === 'number' ? target : Number.NaN;
      const comparable = Number.isFinite(numeric) && Number.isFinite(limit);
      const passed =
        comparable && (assertion.operator === 'gte' ? numeric >= limit : numeric <= limit);
      return {
        passed,
        expected: `${path} ${assertion.operator === 'gte' ? '≥' : '≤'} ${describeValue(target)}`,
        observed: comparable ? observed : `${observed} (not a number to compare)`,
      };
    }
    default:
      return { passed: false, expected: path, observed: `unknown operator` };
  }
}

/** EVENT: how many events of a type, narrowed by `where`, the run emitted. */
function evaluateEvent(assertion: AssertionDefinition, context: GradingContext) {
  const found = matching(context, assertion);
  const count = assertion.count ?? {};
  const bounds: string[] = [];
  let passed = true;
  if (count.exactly !== undefined) {
    bounds.push(`exactly ${count.exactly}`);
    passed = passed && found.length === count.exactly;
  }
  if (count.min !== undefined) {
    bounds.push(`at least ${count.min}`);
    passed = passed && found.length >= count.min;
  }
  if (count.max !== undefined) {
    bounds.push(`at most ${count.max}`);
    passed = passed && found.length <= count.max;
  }
  if (bounds.length === 0) {
    bounds.push('at least 1');
    passed = found.length >= 1;
  }
  return {
    passed,
    expected: `${bounds.join(' and ')} ${assertion.event}${describeWhere(assertion.where)}`,
    observed: `${found.length} matching ${found.length === 1 ? 'event' : 'events'}`,
    detail: { matched: found.map((event) => ({ at: event.at, index: event.index })) },
  };
}

/** TIMING: an event at a named instant plus an offset, within tolerance. Never the wall clock. */
function evaluateTiming(assertion: AssertionDefinition, context: GradingContext) {
  const reference = context.references[assertion.relative_to ?? ''];
  const offset = assertion.offset_minutes ?? 0;
  const tolerance = assertion.tolerance_minutes ?? 0;
  const expected = `${assertion.event} ${offset === 0 ? 'at' : `${Math.abs(offset)} min ${offset < 0 ? 'before' : 'after'}`} ${assertion.relative_to} (±${tolerance} min)`;
  if (reference === undefined) {
    return {
      passed: false,
      expected,
      observed: `no reference instant named ${assertion.relative_to}`,
    };
  }
  const target = Date.parse(reference) + offset * MINUTE;
  const candidates = matching(context, assertion);
  if (candidates.length === 0) {
    return { passed: false, expected, observed: `no ${assertion.event} event was emitted` };
  }
  // Judge the event closest to the target; ties break on run order (TIMING_RULES).
  const closest = [...candidates].sort((a, b) => {
    const delta = Math.abs(Date.parse(a.at) - target) - Math.abs(Date.parse(b.at) - target);
    return delta !== 0 ? delta : byRunOrder(a, b);
  })[0]!;
  const driftMinutes = (Date.parse(closest.at) - target) / MINUTE;
  const passed = Math.abs(driftMinutes) <= tolerance;
  const rounded = Math.round(driftMinutes * 100) / 100;
  return {
    passed,
    expected,
    observed:
      rounded === 0
        ? `${assertion.event} at exactly that moment`
        : `${assertion.event} ${Math.abs(rounded)} min ${rounded < 0 ? 'early' : 'late'}`,
    detail: {
      chosen: { at: closest.at, index: closest.index },
      drift_minutes: rounded,
      candidates: candidates.length,
      rule: TIMING_RULES.choose,
    },
  };
}

/** ARCHITECTURE: the normalized workflow structure. Node positions are not part of the input. */
function evaluateArchitecture(assertion: AssertionDefinition, context: GradingContext) {
  const workflows = context.architecture?.workflows ?? [];
  const nodes = workflows.flatMap((workflow) => workflow.nodes);
  const feature = assertion.ghl_feature;
  const usesFeature = (id: string | undefined) =>
    Boolean(id) &&
    (workflows.some((workflow) => workflow.trigger?.ghl_feature_id === id) ||
      nodes.some((node) => node.ghl_feature_id === id));

  switch (assertion.requirement) {
    case 'trigger_exists':
      return {
        passed: workflows.some((workflow) => workflow.trigger?.ghl_feature_id === feature),
        expected: `a workflow triggered by ${feature}`,
        observed:
          workflows.length === 0
            ? 'no workflow in the solution'
            : `triggers: ${workflows.map((w) => w.trigger?.ghl_feature_id ?? 'none').join(', ')}`,
      };
    case 'action_exists':
      return {
        passed: nodes.some((node) => node.type === 'action' && node.ghl_feature_id === feature),
        expected: `an action using ${feature}`,
        observed: `${nodes.filter((node) => node.type === 'action').length} action nodes`,
      };
    case 'branch_exists':
      return {
        passed: nodes.some(
          (node) => node.type === 'branch' && (!feature || node.ghl_feature_id === feature),
        ),
        expected: feature ? `a branch using ${feature}` : 'a branch',
        observed: `${nodes.filter((node) => node.type === 'branch').length} branch nodes`,
      };
    case 'feature_used':
      return {
        passed: usesFeature(feature),
        expected: `${feature} is used`,
        observed: usesFeature(feature) ? `${feature} is used` : `${feature} is not used`,
      };
    case 'feature_not_used':
      return {
        passed: !usesFeature(feature),
        expected: `${feature} is not used`,
        observed: usesFeature(feature) ? `${feature} is used` : `${feature} is not used`,
      };
    case 'node_count_max': {
      const limit = typeof assertion.value === 'number' ? assertion.value : Number.NaN;
      return {
        passed: Number.isFinite(limit) && nodes.length <= limit,
        expected: `at most ${assertion.value} nodes`,
        observed: `${nodes.length} nodes`,
      };
    }
    case 'reentry_disabled': {
      const reentrant = workflows.filter((workflow) => workflow.settings?.allow_reentry === true);
      return {
        passed: workflows.length > 0 && reentrant.length === 0,
        expected: 'no workflow allows re-entry',
        observed:
          workflows.length === 0
            ? 'no workflow in the solution'
            : reentrant.length === 0
              ? 're-entry is off everywhere'
              : `re-entry is on for ${reentrant.map((w) => w.id).join(', ')}`,
      };
    }
    default:
      return { passed: false, expected: 'a known architecture requirement', observed: 'unknown' };
  }
}

/** NEGATIVE: the forbidden thing must not have happened. */
function evaluateNegative(assertion: AssertionDefinition, context: GradingContext) {
  const found = matching(context, assertion);
  return {
    passed: found.length === 0,
    expected: `no ${assertion.event}${describeWhere(assertion.where)}`,
    observed:
      found.length === 0
        ? 'none occurred'
        : `${found.length} occurred (first at ${found[0]?.at ?? 'unknown'})`,
    detail: { matched: found.map((event) => ({ at: event.at, index: event.index })) },
  };
}

/** SEQUENCE: the earliest `before` precedes the earliest `after` (SEQUENCE_RULES). */
function evaluateSequence(assertion: AssertionDefinition, context: GradingContext) {
  const before = eventsOfType(context, assertion.before)[0];
  const after = eventsOfType(context, assertion.after)[0];
  const expected = `${assertion.before} before ${assertion.after}`;
  if (!before || !after) {
    const missing = [!before ? assertion.before : null, !after ? assertion.after : null]
      .filter(Boolean)
      .join(' and ');
    return { passed: false, expected, observed: `${missing} never happened` };
  }
  const passed = byRunOrder(before, after) < 0;
  return {
    passed,
    expected,
    observed: passed
      ? `${assertion.before} at ${before.at} then ${assertion.after} at ${after.at}`
      : `${assertion.after} at ${after.at} came first`,
    detail: {
      before: { at: before.at, index: before.index },
      after: { at: after.at, index: after.index },
      rule: SEQUENCE_RULES.compare,
    },
  };
}

/**
 * Judges one authored assertion against a context. An assertion whose source the context does
 * not provide comes back `unevaluated`: neither a pass nor a fail, and enough to stop the report
 * from ever claiming a pass it cannot justify (EXR-024).
 */
export function evaluateAssertion(
  assertion: AssertionDefinition,
  tier: AssertionTier,
  context: GradingContext,
): AssertionResult {
  const base = {
    id: assertion.id,
    description: assertion.description,
    type: assertion.type,
    tier,
    dimension: dimensionOf(assertion),
  };
  const missing = sourcesFor(assertion).find((source) => !context.provides.includes(source));
  if (missing) {
    return {
      ...base,
      passed: false,
      unevaluated: true,
      missing_source: missing,
      expected: assertion.description,
      observed: `not evaluated: this run provides no ${missing}`,
    };
  }
  const outcome = (() => {
    switch (assertion.type) {
      case 'state':
        return evaluateState(assertion, context);
      case 'event':
        return evaluateEvent(assertion, context);
      case 'timing':
        return evaluateTiming(assertion, context);
      case 'architecture':
        return evaluateArchitecture(assertion, context);
      case 'negative':
        return evaluateNegative(assertion, context);
      case 'sequence':
        return evaluateSequence(assertion, context);
    }
  })();
  return { ...base, ...outcome };
}
