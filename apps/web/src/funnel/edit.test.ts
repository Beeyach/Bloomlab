import { beforeEach, describe, expect, it } from 'vitest';

import { initialAccount, type Funnel, type SimulatorScenario } from '@bloomlab/simulator-core';

import { content } from '../content/bundle';
import { BloomlabDatabase } from '../data/db';
import { blankFunnel } from './commands';
import * as edit from './edit';
import {
  canRedo,
  canUndo,
  edit as pushEdit,
  isDirty,
  markSaved,
  redo,
  startHistory,
  undo,
} from './history';
import { DEFAULT_DEVICE, DEFAULT_MODE, PREVIEW_WIDTHS, rememberView, savedView } from './view';

/**
 * BUILD-mode editing and the Lab's view preferences (FUN-001, FUN-002).
 *
 * Every editing action is a pure function over a definition, so it is tested here rather than
 * through a screen: add, remove, reorder, configure and connect. The screen test then proves the
 * controls reach these.
 */

const scenario = (): SimulatorScenario =>
  (content.scenarios as unknown as SimulatorScenario[]).find(
    (row) => row.id === 'SC-glowhaus-funnel',
  ) as SimulatorScenario;

const roles = (funnel: Funnel, stepId: string) =>
  edit.findStep(funnel, stepId)?.blocks.map((block) => block.role) ?? [];

describe('steps', () => {
  it('adds a step at the end and points the previous one at it', () => {
    let funnel = blankFunnel('fn-1', 'Consultation');
    funnel = edit.addStep(funnel, 'Offer', 'capture', 'st-1');
    funnel = edit.addStep(funnel, 'Book', 'booking', 'st-2');
    expect(funnel.steps.map((step) => step.id)).toEqual(['st-1', 'st-2']);
    expect(funnel.steps[0]?.next_step_id).toBe('st-2');
    expect(funnel.steps[1]?.next_step_id).toBeNull();
  });

  it('renames a step and changes what it is for', () => {
    let funnel = edit.addStep(blankFunnel('fn-1'), 'Offer', 'capture', 'st-1');
    funnel = edit.renameStep(funnel, 'st-1', 'Consultation offer');
    funnel = edit.setStepPurpose(funnel, 'st-1', 'offer');
    expect(funnel.steps[0]?.name).toBe('Consultation offer');
    expect(funnel.steps[0]?.purpose).toBe('offer');
  });

  it('reorders steps and clamps a move past either end', () => {
    let funnel = blankFunnel('fn-1');
    funnel = edit.addStep(funnel, 'One', 'capture', 'st-1');
    funnel = edit.addStep(funnel, 'Two', 'booking', 'st-2');
    funnel = edit.addStep(funnel, 'Three', 'confirmation', 'st-3');
    expect(edit.moveStep(funnel, 'st-3', 0).steps.map((s) => s.id)).toEqual([
      'st-3',
      'st-1',
      'st-2',
    ]);
    expect(edit.moveStep(funnel, 'st-1', -5).steps.map((s) => s.id)).toEqual([
      'st-1',
      'st-2',
      'st-3',
    ]);
    expect(edit.moveStep(funnel, 'st-1', 99).steps.map((s) => s.id)).toEqual([
      'st-2',
      'st-3',
      'st-1',
    ]);
  });

  it('joins the funnel back up when a middle step is removed', () => {
    let funnel = blankFunnel('fn-1');
    funnel = edit.addStep(funnel, 'One', 'capture', 'st-1');
    funnel = edit.addStep(funnel, 'Two', 'booking', 'st-2');
    funnel = edit.addStep(funnel, 'Three', 'confirmation', 'st-3');
    funnel = edit.addBlock(funnel, 'st-1', 'cta', 'b1');
    funnel = edit.editBlock(funnel, 'b1', { target_step_id: 'st-2' });
    const after = edit.removeStep(funnel, 'st-2');
    expect(after.steps.map((step) => step.id)).toEqual(['st-1', 'st-3']);
    // The step that pointed at the removed one now points where it pointed.
    expect(after.steps[0]?.next_step_id).toBe('st-3');
    expect(edit.findBlock(after, 'b1')?.target_step_id).toBe('st-3');
  });
});

describe('blocks', () => {
  const base = (): Funnel => {
    let funnel = edit.addStep(blankFunnel('fn-1'), 'Offer', 'capture', 'st-1');
    funnel = edit.addBlock(funnel, 'st-1', 'headline', 'b1');
    funnel = edit.addBlock(funnel, 'st-1', 'outcome', 'b2');
    funnel = edit.addBlock(funnel, 'st-1', 'form', 'b3');
    return funnel;
  };

  it('adds blocks in order and can insert at a position', () => {
    expect(roles(base(), 'st-1')).toEqual(['headline', 'outcome', 'form']);
    const inserted = edit.addBlock(base(), 'st-1', 'proof', 'b4', 1);
    expect(roles(inserted, 'st-1')).toEqual(['headline', 'proof', 'outcome', 'form']);
  });

  it('moves a block within its step', () => {
    expect(roles(edit.moveBlock(base(), 'b3', 0), 'st-1')).toEqual(['form', 'headline', 'outcome']);
    expect(roles(edit.moveBlock(base(), 'b1', 2), 'st-1')).toEqual(['outcome', 'form', 'headline']);
  });

  it('removes a block', () => {
    expect(roles(edit.removeBlock(base(), 'b2'), 'st-1')).toEqual(['headline', 'form']);
  });

  it('writes and clears a block’s words', () => {
    let funnel = edit.editBlock(base(), 'b1', { headline: '  A free consultation  ' });
    expect(edit.findBlock(funnel, 'b1')?.headline).toBe('A free consultation');
    funnel = edit.editBlock(funnel, 'b1', { headline: '   ' });
    expect(edit.findBlock(funnel, 'b1')?.headline).toBeNull();
  });

  it('connects a capture block to an account entity and disconnects it again', () => {
    let funnel = edit.editBlock(base(), 'b3', { reference_id: 'consult-request' });
    expect(edit.findBlock(funnel, 'b3')?.reference_id).toBe('consult-request');
    funnel = edit.editBlock(funnel, 'b3', { reference_id: null });
    expect(edit.findBlock(funnel, 'b3')?.reference_id).toBeNull();
  });

  it('leaves everything else alone when one block changes', () => {
    const before = base();
    const after = edit.editBlock(before, 'b1', { headline: 'Hello' });
    expect(after.steps[0]?.blocks[1]).toEqual(before.steps[0]?.blocks[1]);
    expect(before.steps[0]?.blocks[0]?.headline).toBeNull();
  });
});

describe('what a block can be connected to comes from the account', () => {
  const account = () => initialAccount(scenario());

  it('offers the account’s own forms, surveys, calendars and products', () => {
    expect(edit.referenceChoices(account(), 'form').map((row) => row.id)).toEqual([
      'consult-request',
    ]);
    expect(edit.referenceChoices(account(), 'survey').map((row) => row.id)).toEqual(['fit-check']);
    expect(edit.referenceChoices(account(), 'calendar').map((row) => row.id)).toEqual([
      'consultation',
    ]);
    expect(edit.referenceChoices(account(), 'checkout').map((row) => row.id)).toEqual([
      'glow-membership',
    ]);
  });

  it('says what each one is, so the choice is by meaning and not by id', () => {
    expect(edit.referenceChoices(account(), 'form')[0]?.detail).toContain('first_name');
    expect(edit.referenceChoices(account(), 'calendar')[0]?.detail).toContain('30 minutes');
    expect(edit.referenceChoices(account(), 'checkout')[0]?.detail).toContain('recurring');
  });

  it('offers nothing for a role that connects to nothing', () => {
    expect(edit.referenceChoices(account(), 'proof')).toEqual([]);
    expect(edit.referenceChoices(account(), 'headline')).toEqual([]);
  });
});

describe('undo and redo over the draft (D-110 applied to funnels)', () => {
  it('walks back an edit and forward again', () => {
    const start = edit.addStep(blankFunnel('fn-1'), 'Offer', 'capture', 'st-1');
    let history = startHistory(start);
    expect(canUndo(history)).toBe(false);
    history = pushEdit(history, edit.addBlock(start, 'st-1', 'headline', 'b1'));
    expect(canUndo(history)).toBe(true);
    expect(history.present.steps[0]?.blocks).toHaveLength(1);
    history = undo(history);
    expect(history.present.steps[0]?.blocks).toHaveLength(0);
    expect(canRedo(history)).toBe(true);
    history = redo(history);
    expect(history.present.steps[0]?.blocks).toHaveLength(1);
  });

  it('does not record an edit that changed nothing', () => {
    const start = edit.addStep(blankFunnel('fn-1'), 'Offer', 'capture', 'st-1');
    const history = startHistory(start);
    expect(pushEdit(history, { ...start })).toBe(history);
  });

  it('knows dirty from clean, and a version bump alone is not a change', () => {
    const start = edit.addStep(blankFunnel('fn-1'), 'Offer', 'capture', 'st-1');
    let history = startHistory(start);
    expect(isDirty(history)).toBe(false);
    history = pushEdit(history, edit.renameStep(start, 'st-1', 'Consultation offer'));
    expect(isDirty(history)).toBe(true);
    history = markSaved(history);
    expect(isDirty(history)).toBe(false);
    // The account bumps the version on save; that alone must not read as an unsaved change.
    history = markSaved(history, { ...history.present, version: history.present.version + 1 });
    expect(isDirty(history)).toBe(false);
  });
});

describe('FUN-002: the mode and the preview width are device preferences that persist', () => {
  let database: BloomlabDatabase;

  beforeEach(async () => {
    database = new BloomlabDatabase(`funnel-view-${Math.random().toString(36).slice(2)}`);
    await database.open();
    await database.device.put({
      device_id: 'device-1',
      learner_id: 'local:test',
      label: 'Test device',
      created_at: '2026-09-08T09:00:00Z',
      last_seen_at: '2026-09-08T09:00:00Z',
      storage_persisted: null,
    });
  });

  it('starts on the defaults when nothing was chosen', async () => {
    expect(await savedView(database)).toEqual({ mode: DEFAULT_MODE, device: DEFAULT_DEVICE });
  });

  it('remembers a mode and a width, and reads them back after a reload', async () => {
    await rememberView({ mode: 'simulate' }, database);
    await rememberView({ device: 'mobile' }, database);
    expect(await savedView(database)).toEqual({ mode: 'simulate', device: 'mobile' });

    // A reload is a fresh handle on the same store.
    const reopened = new BloomlabDatabase(database.name);
    await reopened.open();
    expect(await savedView(reopened)).toEqual({ mode: 'simulate', device: 'mobile' });
  });

  it('reads an unknown stored value as the default rather than trusting it', async () => {
    const device = await database.device.toCollection().first();
    await database.device.put({ ...device!, lab_views: { 'funnel:mode': 'teleport' } });
    expect((await savedView(database)).mode).toBe(DEFAULT_MODE);
  });

  it('keeps the rest of the device record intact', async () => {
    await rememberView({ mode: 'preview' }, database);
    const device = await database.device.toCollection().first();
    expect(device?.label).toBe('Test device');
    expect(device?.learner_id).toBe('local:test');
  });

  it('names three real widths, and they are different', () => {
    expect(PREVIEW_WIDTHS.desktop).toBeGreaterThan(PREVIEW_WIDTHS.tablet);
    expect(PREVIEW_WIDTHS.tablet).toBeGreaterThan(PREVIEW_WIDTHS.mobile);
    expect(PREVIEW_WIDTHS.mobile).toBe(390);
  });
});
