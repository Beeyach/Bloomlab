import { fail } from '../errors.ts';
import { requireString, type SimulatorEvent } from '../events.ts';
import {
  FUNNEL_BLOCK_REFERENCES,
  FUNNEL_BLOCK_ROLES,
  FUNNEL_STEP_PURPOSES,
  isReferencingRole,
  type AccountState,
  type Funnel,
  type FunnelBlock,
  type FunnelBlockRole,
  type FunnelStep,
  type FunnelStepPurpose,
} from '../state.ts';
import { entity, put, result, type ReducerResult } from './shared.ts';

/**
 * Funnel definitions as account events (FUN-001, D-119).
 *
 * A learner's conversion architecture becomes part of the shared account the same way a workflow
 * definition does (D-107): through an event the engine validates, applies, logs and can replay.
 * `FUNNEL_CREATED` adds one; `FUNNEL_UPDATED` replaces one and bumps its version (D-104). The
 * Funnel Lab therefore keeps no store of its own, persists through the run every other Lab
 * persists through, and a funnel the learner built is readable by anything that can read the
 * account — including the exercise grader.
 *
 * What a save checks is **shape and references**: ids, known roles and purposes, a `next_step_id`
 * that names a step of this funnel, and a capture block whose `reference_id` names an entity the
 * account actually holds. A dangling reference is refused here rather than reported later,
 * because the editor picks references from the account's own lists — there is no half-built state
 * that legitimately names a form that does not exist. What a save does **not** check is whether
 * the architecture is finished: a block with no reference yet, a step with no blocks, a funnel
 * with one step and no destination all save happily, and `validateFunnel` is what reports them
 * before a visitor is allowed to walk it.
 */

const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/** Turns the payload's `funnel` into a definition, refusing anything malformed. */
export function readFunnel(
  raw: unknown,
  eventType: string,
  version: number,
  account: AccountState,
): Funnel {
  if (!isRecord(raw)) fail('INVALID_PAYLOAD', `${eventType} needs a funnel object`, { raw });
  const candidate = raw;
  const id = typeof candidate.id === 'string' && ID.test(candidate.id) ? candidate.id : null;
  if (!id) fail('INVALID_PAYLOAD', `${eventType} needs a funnel id`, { id: candidate.id });
  const name = text(candidate.name);
  if (!name) fail('INVALID_PAYLOAD', `Funnel ${id} needs a name`, { id });

  if (!Array.isArray(candidate.steps)) {
    fail('INVALID_PAYLOAD', `Funnel ${id} needs a list of steps`, { id });
  }

  const steps: FunnelStep[] = (candidate.steps as unknown[]).map((step, index) =>
    readStep(step, index, id, eventType, account),
  );

  const stepIds = new Set<string>();
  for (const step of steps) {
    if (stepIds.has(step.id)) {
      fail('DUPLICATE_ENTITY', `Funnel ${id} has two steps called ${step.id}`, {
        funnel_id: id,
        step_id: step.id,
      });
    }
    stepIds.add(step.id);
  }

  // Destinations are structural: a step or a CTA that points at a step this funnel does not have
  // is a broken graph, and the visitor would have nowhere to go. Refused at the save.
  for (const step of steps) {
    if (step.next_step_id !== null && !stepIds.has(step.next_step_id)) {
      fail('UNKNOWN_ENTITY', `Funnel ${id}: step ${step.id} continues to a step that is not here`, {
        funnel_id: id,
        step_id: step.id,
        next_step_id: step.next_step_id,
      });
    }
    for (const block of step.blocks) {
      if (block.target_step_id !== null && !stepIds.has(block.target_step_id)) {
        fail('UNKNOWN_ENTITY', `Funnel ${id}: a call to action points at a step that is not here`, {
          funnel_id: id,
          step_id: step.id,
          block_id: block.id,
          target_step_id: block.target_step_id,
        });
      }
    }
  }

  return { id, name, steps, version };
}

function readStep(
  raw: unknown,
  index: number,
  funnelId: string,
  eventType: string,
  account: AccountState,
): FunnelStep {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !ID.test(raw.id)) {
    fail('INVALID_PAYLOAD', `Funnel ${funnelId} step ${index + 1} needs an id`, { step: raw });
  }
  const shaped = raw;
  const id = shaped.id as string;
  const name = text(shaped.name);
  if (!name) fail('INVALID_PAYLOAD', `Funnel ${funnelId} step ${id} needs a name`, { step_id: id });
  if (!(FUNNEL_STEP_PURPOSES as readonly string[]).includes(shaped.purpose as string)) {
    fail(
      'INVALID_PAYLOAD',
      `Funnel ${funnelId} step ${id} has an unknown purpose ${String(shaped.purpose)}`,
      { step_id: id, purpose: shaped.purpose },
    );
  }
  if (!Array.isArray(shaped.blocks)) {
    fail('INVALID_PAYLOAD', `Funnel ${funnelId} step ${id} needs a list of blocks`, {
      step_id: id,
    });
  }
  const blocks = (shaped.blocks as unknown[]).map((block, at) =>
    readBlock(block, at, funnelId, id, eventType, account),
  );
  const blockIds = new Set<string>();
  for (const block of blocks) {
    if (blockIds.has(block.id)) {
      fail('DUPLICATE_ENTITY', `Funnel ${funnelId} step ${id} has two blocks called ${block.id}`, {
        step_id: id,
        block_id: block.id,
      });
    }
    blockIds.add(block.id);
  }
  return {
    id,
    name,
    purpose: shaped.purpose as FunnelStepPurpose,
    blocks,
    next_step_id: typeof shaped.next_step_id === 'string' ? shaped.next_step_id : null,
  };
}

function readBlock(
  raw: unknown,
  index: number,
  funnelId: string,
  stepId: string,
  eventType: string,
  account: AccountState,
): FunnelBlock {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !ID.test(raw.id)) {
    fail('INVALID_PAYLOAD', `Funnel ${funnelId} step ${stepId} block ${index + 1} needs an id`, {
      block: raw,
    });
  }
  const shaped = raw;
  const id = shaped.id as string;
  if (!(FUNNEL_BLOCK_ROLES as readonly string[]).includes(shaped.role as string)) {
    fail('INVALID_PAYLOAD', `Funnel ${funnelId}: block ${id} has an unknown role`, {
      block_id: id,
      role: shaped.role,
    });
  }
  const role = shaped.role as FunnelBlockRole;
  const reference = typeof shaped.reference_id === 'string' ? shaped.reference_id : null;
  if (reference !== null) {
    if (!isReferencingRole(role)) {
      fail('INVALID_PAYLOAD', `Funnel ${funnelId}: a ${role} block uses no account entity`, {
        block_id: id,
        role,
        reference_id: reference,
      });
    }
    const collection = FUNNEL_BLOCK_REFERENCES[role];
    const held: Record<string, { id: string }> = account[collection];
    entity(held, reference, collection.slice(0, -1), eventType);
  }
  if (shaped.target_step_id !== undefined && shaped.target_step_id !== null && role !== 'cta') {
    fail('INVALID_PAYLOAD', `Funnel ${funnelId}: only a call to action names a destination`, {
      block_id: id,
      role,
    });
  }
  return {
    id,
    role,
    headline: text(shaped.headline),
    body: text(shaped.body),
    reference_id: reference,
    target_step_id: typeof shaped.target_step_id === 'string' ? shaped.target_step_id : null,
  };
}

const blockCount = (funnel: Funnel): number =>
  funnel.steps.reduce((total, step) => total + step.blocks.length, 0);

export function funnelCreated(account: AccountState, event: SimulatorEvent): ReducerResult {
  const definition = readFunnel(event.payload.funnel, event.type, 1, account);
  if (account.funnels[definition.id]) {
    fail('DUPLICATE_ENTITY', `A funnel ${definition.id} already exists`, {
      funnel_id: definition.id,
    });
  }
  return result({ ...account, funnels: put(account.funnels, definition.id, definition) }, [
    {
      kind: 'input',
      at: event.at,
      event_id: event.id,
      data: {
        funnel_id: definition.id,
        name: definition.name,
        version: 1,
        steps: definition.steps.length,
        blocks: blockCount(definition),
      },
      reason: 'funnel_created',
    },
  ]);
}

export function funnelUpdated(account: AccountState, event: SimulatorEvent): ReducerResult {
  const id = requireString(event.payload, 'funnel_id', event.type);
  const existing = entity(account.funnels, id, 'funnel', event.type);
  const definition = readFunnel(event.payload.funnel, event.type, existing.version + 1, account);
  if (definition.id !== id) {
    fail('INVALID_PAYLOAD', `${event.type} updates ${id} but the definition is ${definition.id}`, {
      funnel_id: id,
      definition_id: definition.id,
    });
  }
  return result({ ...account, funnels: put(account.funnels, id, definition) }, [
    {
      kind: 'input',
      at: event.at,
      event_id: event.id,
      data: {
        funnel_id: id,
        name: definition.name,
        version: definition.version,
        steps: definition.steps.length,
        blocks: blockCount(definition),
      },
      reason: 'funnel_updated',
    },
  ]);
}
