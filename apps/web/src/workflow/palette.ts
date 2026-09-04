import type { GhlFeature } from '@bloomlab/content-schema';
import {
  capabilityFor,
  type AccountState,
  type TriggerFilterField,
  type WorkflowNode,
} from '@bloomlab/simulator-core';

import { content } from '../content/bundle';

/**
 * The palette is the registry (WFL-011, D-105).
 *
 * Every trigger and action the Lab offers is a `content/ghl-features` record whose area is
 * Workflows, joined to the engine's capability adapter for that id. A record with an adapter is
 * runnable; a record without one is still shown — it is a real GoHighLevel feature the learner
 * should know exists — but it is marked "practised in GHL", cannot be placed as a runnable step,
 * and is never drawn as if a test contact could pass through it. Adding a registry record adds a
 * palette entry; nothing in this file lists a feature by name.
 */

export interface PaletteEntry {
  id: string;
  /** The registry's exact current name for the feature (GHL-010). */
  name: string;
  kind: 'trigger' | 'action';
  /** Which node type a runnable action becomes. */
  nodeType: WorkflowNode['type'] | null;
  fidelity: GhlFeature['simulation_fidelity'];
  approximation: string | null;
  runnable: boolean;
  /** Why it is not runnable, in the registry's own words, when it is not. */
  practised: string | null;
  feature: GhlFeature;
}

function entryFor(feature: GhlFeature): PaletteEntry {
  const capability = capabilityFor(feature.id);
  const runnable = capability !== null && feature.simulation_fidelity !== 'REAL_GHL';
  return {
    id: feature.id,
    name: feature.official_name,
    kind: feature.feature_type as 'trigger' | 'action',
    nodeType: capability && capability.kind === 'action' ? capability.nodeType : null,
    fidelity: feature.simulation_fidelity,
    approximation:
      feature.simulation_fidelity === 'B' || feature.simulation_fidelity === 'C'
        ? (feature.approximation_note ?? 'Training approximation')
        : null,
    runnable,
    practised: runnable
      ? null
      : (feature.approximation_note ??
        feature.known_limitations[0] ??
        'Practised in GoHighLevel, not simulated.'),
    feature,
  };
}

/**
 * The palette for a set of registry records: every workflow trigger and action, runnable first,
 * then by name. Exported so a test can hand it a record the registry does not hold yet and see it
 * appear — the proof that adding a registry record adds a palette entry (WFL-011).
 */
export const paletteFrom = (features: readonly GhlFeature[]): PaletteEntry[] =>
  features
    .filter(
      (feature) =>
        feature.area === 'Workflows' &&
        (feature.feature_type === 'trigger' || feature.feature_type === 'action') &&
        feature.status !== 'removed',
    )
    .map(entryFor)
    .sort((a, b) => Number(b.runnable) - Number(a.runnable) || a.name.localeCompare(b.name));

/** Every workflow trigger and action in the registry, runnable first, then by name. */
export const PALETTE: readonly PaletteEntry[] = paletteFrom(content.ghl_features);

export const paletteEntry = (id: string | null | undefined): PaletteEntry | null =>
  (id && PALETTE.find((entry) => entry.id === id)) || null;

export const triggers = (): PaletteEntry[] => PALETTE.filter((entry) => entry.kind === 'trigger');
export const actions = (): PaletteEntry[] => PALETTE.filter((entry) => entry.kind === 'action');

/** The registry's name for a feature, or the id when the registry does not know it. */
export const featureName = (id: string | null | undefined): string =>
  paletteEntry(id)?.name ?? id ?? 'Not chosen';

/** A runnable action's config fields, as the registry describes them. */
export const configFields = (id: string | null | undefined) =>
  paletteEntry(id)?.feature.supported_configs.config_fields ?? [];

/** The engine's filter fields for a trigger, for the inspector. */
export function triggerFilters(id: string | null | undefined): readonly TriggerFilterField[] {
  const capability = capabilityFor(id);
  return capability && capability.kind === 'trigger' ? capability.filters : [];
}

/**
 * Options for a reference-typed field, read out of the account rather than authored: tags, users,
 * pipelines, stages, calendars, workflows, contact fields. Nothing here invents a value the
 * account does not hold.
 */
export function referenceOptions(
  reference: string,
  account: AccountState,
  context: { pipeline?: string | null } = {},
): { value: string; label: string }[] {
  const named = (rows: { id: string; name: string }[]) =>
    rows
      .map((row) => ({ value: row.id, label: row.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  switch (reference) {
    case 'tags':
      return account.tags.map((tag) => ({ value: tag, label: tag }));
    case 'users':
      return named(Object.values(account.users));
    case 'pipelines':
      return named(Object.values(account.pipelines));
    case 'stages': {
      const pipeline = context.pipeline ? account.pipelines[context.pipeline] : null;
      const stages = pipeline
        ? pipeline.stages
        : [...new Set(Object.values(account.pipelines).flatMap((row) => row.stages))];
      return stages.map((stage) => ({ value: stage, label: stage }));
    }
    case 'calendars':
      return named(Object.values(account.calendars));
    case 'forms':
      return named(Object.values(account.forms));
    case 'surveys':
      return named(Object.values(account.surveys));
    case 'workflows':
      return [
        { value: 'this', label: 'This workflow' },
        { value: 'all', label: 'All workflows' },
        ...named(Object.values(account.workflows)),
      ];
    case 'fields':
      return [
        ...['first_name', 'last_name', 'email', 'phone', 'source', 'timezone'].map((key) => ({
          value: key,
          label: key.replace('_', ' '),
        })),
        ...Object.values(account.custom_fields)
          .filter((field) => field.object === 'contact')
          .map((field) => ({ value: field.key, label: field.label })),
      ];
    case 'statuses':
      return ['new', 'confirmed', 'cancelled', 'showed', 'no_show', 'invalid'].map((status) => ({
        value: status,
        label: status.replace('_', '-'),
      }));
    default:
      return [];
  }
}

/** Which reference list a registry config field draws from, by the field's name. */
export function referenceFor(fieldName: string): string | null {
  switch (fieldName) {
    case 'tag':
      return 'tags';
    case 'users':
    case 'recipient':
      return 'users';
    case 'pipeline':
      return 'pipelines';
    case 'stage':
      return 'stages';
    case 'workflow':
      return 'workflows';
    case 'field':
      return 'fields';
    default:
      return null;
  }
}
