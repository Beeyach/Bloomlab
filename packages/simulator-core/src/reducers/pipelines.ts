import { fail } from '../errors.ts';
import { optionalStringList, requireString, type SimulatorEvent } from '../events.ts';
import type { AccountState, Opportunity, Pipeline } from '../state.ts';
import { entity, put, result, type ReducerResult } from './shared.ts';

/**
 * Pipelines and their stages (CRM-001, D-093).
 *
 * A stage is identified by its name, which is how the authored scenarios and the existing
 * opportunity reducers already address it. That makes reordering free — the same names in a new
 * order — and makes dropping or renaming a stage the interesting case, because every opportunity
 * sitting in it would be left pointing at a stage that no longer exists.
 *
 * Bloomlab does not repair that quietly. An update that would strand opportunities is refused
 * unless the same event says where they go: `migrate: { "Old stage": "New stage" }`, naming a
 * destination that exists in the new list. The move then happens as part of the same event, is
 * counted in the execution record, and shows up in the run's history like any other change. A
 * rename is exactly this case — the old name leaves the list, the new one joins it, and the
 * migration says they are the same stage — so renaming is deliberate rather than inferred from
 * two lists that happen to be the same length.
 *
 * Stages holding nothing may be dropped without a migration: there is nothing to strand.
 */

/** The ordered stage list an event proposes, checked for the things a stage list must be. */
function readStages(event: SimulatorEvent, required: boolean): string[] | null {
  const stages = optionalStringList(event.payload, 'stages', event.type);
  if (!stages) {
    if (required) fail('INVALID_PAYLOAD', `${event.type} needs the pipeline's stages`, {});
    return null;
  }
  if (stages.length === 0) {
    fail('INVALID_PAYLOAD', 'A pipeline needs at least one stage', {});
  }
  if (new Set(stages).size !== stages.length) {
    fail('INVALID_PAYLOAD', 'A pipeline cannot have two stages with the same name', { stages });
  }
  return stages;
}

export function pipelineCreated(account: AccountState, event: SimulatorEvent): ReducerResult {
  const id = requireString(event.payload, 'pipeline_id', event.type);
  if (account.pipelines[id]) {
    fail('DUPLICATE_ENTITY', `A pipeline ${id} already exists`, { pipeline_id: id });
  }
  const pipeline: Pipeline = {
    id,
    name: requireString(event.payload, 'name', event.type),
    stages: readStages(event, true) as string[],
  };
  return result({ ...account, pipelines: put(account.pipelines, id, pipeline) }, [
    {
      kind: 'input',
      at: event.at,
      event_id: event.id,
      data: { pipeline_id: id, name: pipeline.name, stages: pipeline.stages },
    },
  ]);
}

export function pipelineUpdated(account: AccountState, event: SimulatorEvent): ReducerResult {
  const id = requireString(event.payload, 'pipeline_id', event.type);
  const existing = entity(account.pipelines, id, 'pipeline', event.type);
  const stages = readStages(event, false);
  const changed: Record<string, unknown> = {};
  const updated: Pipeline = { ...existing };

  if (event.payload.name !== undefined) {
    updated.name = requireString(event.payload, 'name', event.type);
    changed.name = updated.name;
  }

  let moved: { opportunity_id: string; from: string; to: string }[] = [];
  let opportunities = account.opportunities;

  if (stages) {
    const migrate = readMigration(event, stages);
    const kept = new Set(stages);
    const held = new Map<string, Opportunity[]>();
    for (const opportunity of Object.values(account.opportunities)) {
      if (opportunity.pipeline_id !== id) continue;
      const list = held.get(opportunity.stage) ?? [];
      list.push(opportunity);
      held.set(opportunity.stage, list);
    }

    for (const [stage, list] of held) {
      if (kept.has(stage)) continue;
      const destination = migrate.get(stage);
      if (!destination) {
        fail(
          'INVALID_PAYLOAD',
          `Stage "${stage}" holds ${list.length} ${list.length === 1 ? 'opportunity' : 'opportunities'}. Say where they go with migrate, or keep the stage.`,
          { pipeline_id: id, stage, opportunities: list.map((row) => row.id), stages },
        );
      }
      for (const opportunity of list) {
        opportunities = put(opportunities, opportunity.id, {
          ...opportunity,
          stage: destination,
          updated_at: event.at,
        });
        moved.push({ opportunity_id: opportunity.id, from: stage, to: destination });
      }
    }

    updated.stages = stages;
    changed.stages = stages;
  }

  moved = moved.sort((a, b) => a.opportunity_id.localeCompare(b.opportunity_id));
  const records = [
    {
      kind: 'step_completed' as const,
      at: event.at,
      event_id: event.id,
      data: { pipeline_id: id, changed, moved: moved.length },
    },
    ...moved.map((move) => ({
      kind: 'step_completed' as const,
      at: event.at,
      event_id: event.id,
      data: { pipeline_id: id, ...move },
      reason: 'stage_migrated',
    })),
  ];
  return result(
    { ...account, pipelines: put(account.pipelines, id, updated), opportunities },
    records,
  );
}

/** `migrate` maps a stage that is leaving onto one that is staying. Both halves are checked. */
function readMigration(event: SimulatorEvent, stages: string[]): Map<string, string> {
  const raw = event.payload.migrate;
  const migration = new Map<string, string>();
  if (raw === undefined || raw === null) return migration;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    fail('INVALID_PAYLOAD', `${event.type} migrate must map a leaving stage to a staying one`, {
      migrate: raw,
    });
  }
  const kept = new Set(stages);
  for (const [from, to] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof to !== 'string' || to.length === 0) {
      fail('INVALID_PAYLOAD', `migrate needs a destination stage for "${from}"`, { from, to });
    }
    if (!kept.has(to)) {
      fail('INVALID_PAYLOAD', `migrate sends "${from}" to "${to}", which is not a stage`, {
        from,
        to,
        stages,
      });
    }
    if (kept.has(from)) {
      fail('INVALID_PAYLOAD', `"${from}" is staying, so nothing needs migrating out of it`, {
        from,
      });
    }
    migration.set(from, to);
  }
  return migration;
}
