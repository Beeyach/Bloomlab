import { fail } from '../errors.ts';
import { requireNumber, requireString, type SimulatorEvent } from '../events.ts';
import type { AccountState, Opportunity } from '../state.ts';
import { bumpAnalytics, count, entity, put, result, type ReducerResult } from './shared.ts';

/** Opportunities and pipelines (CRM-003). A stage must exist on the pipeline that owns it. */

const STATUSES = ['open', 'won', 'lost', 'abandoned'] as const;

function requireStage(account: AccountState, pipelineId: string, stage: string, type: string) {
  const pipeline = entity(account.pipelines, pipelineId, 'pipeline', type);
  if (!pipeline.stages.includes(stage)) {
    fail('INVALID_PAYLOAD', `Pipeline ${pipelineId} has no stage "${stage}"`, {
      pipeline_id: pipelineId,
      stage,
      stages: pipeline.stages,
    });
  }
  return pipeline;
}

export function opportunityCreated(account: AccountState, event: SimulatorEvent): ReducerResult {
  const id = requireString(event.payload, 'opportunity_id', event.type);
  if (account.opportunities[id]) {
    fail('DUPLICATE_ENTITY', `An opportunity ${id} already exists`, { opportunity_id: id });
  }
  const contactId = requireString(event.payload, 'contact_id', event.type);
  entity(account.contacts, contactId, 'contact', event.type);
  const pipelineId = requireString(event.payload, 'pipeline_id', event.type);
  const stage = requireString(event.payload, 'stage', event.type);
  requireStage(account, pipelineId, stage, event.type);
  const value =
    event.payload.value === undefined ? 0 : requireNumber(event.payload, 'value', event.type);

  const opportunity: Opportunity = {
    id,
    contact_id: contactId,
    pipeline_id: pipelineId,
    stage,
    value,
    status: 'open',
    created_at: event.at,
    updated_at: event.at,
  };
  const next = bumpAnalytics(
    { ...account, opportunities: put(account.opportunities, id, opportunity) },
    count(account.analytics, 'opportunities_created'),
  );
  return result(next, [
    {
      kind: 'input',
      at: event.at,
      contact_id: contactId,
      event_id: event.id,
      data: { opportunity_id: id, pipeline_id: pipelineId, stage, value },
    },
  ]);
}

export function opportunityUpdated(account: AccountState, event: SimulatorEvent): ReducerResult {
  const id = requireString(event.payload, 'opportunity_id', event.type);
  const existing = entity(account.opportunities, id, 'opportunity', event.type);
  const updated: Opportunity = { ...existing, updated_at: event.at };
  const changed: Record<string, unknown> = {};

  if (event.payload.value !== undefined) {
    updated.value = requireNumber(event.payload, 'value', event.type);
    changed.value = updated.value;
  }
  if (event.payload.status !== undefined) {
    const status = event.payload.status;
    if (typeof status !== 'string' || !STATUSES.includes(status as (typeof STATUSES)[number])) {
      fail('INVALID_PAYLOAD', `${event.type} needs one of ${STATUSES.join(', ')}`, { status });
    }
    updated.status = status as Opportunity['status'];
    changed.status = status;
  }
  if (event.payload.stage !== undefined) {
    const stage = requireString(event.payload, 'stage', event.type);
    requireStage(account, existing.pipeline_id, stage, event.type);
    updated.stage = stage;
    changed.stage = stage;
  }

  return result({ ...account, opportunities: put(account.opportunities, id, updated) }, [
    {
      kind: 'step_completed',
      at: event.at,
      contact_id: existing.contact_id,
      event_id: event.id,
      data: { opportunity_id: id, changed },
    },
  ]);
}

export function pipelineStageChanged(account: AccountState, event: SimulatorEvent): ReducerResult {
  const id = requireString(event.payload, 'opportunity_id', event.type);
  const existing = entity(account.opportunities, id, 'opportunity', event.type);
  const stage = requireString(event.payload, 'stage', event.type);
  // A move may cross pipelines; the stage is checked against whichever pipeline ends up owning it.
  const pipelineId =
    typeof event.payload.pipeline_id === 'string' && event.payload.pipeline_id.length > 0
      ? event.payload.pipeline_id
      : existing.pipeline_id;
  requireStage(account, pipelineId, stage, event.type);

  const updated: Opportunity = {
    ...existing,
    pipeline_id: pipelineId,
    stage,
    updated_at: event.at,
  };
  return result({ ...account, opportunities: put(account.opportunities, id, updated) }, [
    {
      kind: 'step_completed',
      at: event.at,
      contact_id: existing.contact_id,
      event_id: event.id,
      data: {
        opportunity_id: id,
        from_stage: existing.stage,
        to_stage: stage,
        pipeline_id: pipelineId,
      },
    },
  ]);
}
