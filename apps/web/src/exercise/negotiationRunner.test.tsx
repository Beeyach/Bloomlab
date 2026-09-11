import { fakeEvaluation } from '../ai/testGateway';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getFeatureFlags } from '@bloomlab/shared';
import { App } from '../app/App';
import { content } from '../content/bundle';
import { db } from '../data/db';
import {
  loadAttempt,
  NORMAL_RUN,
  saveNegotiationDraft,
  sendNegotiationTurn,
  startAttempt,
  saveResponse,
  flushAttemptWrites,
} from './attempt';
import { finalizeAttempt } from './finalize';
import { negotiationOf } from './negotiation/context';
import { NegotiationThread } from './work/NegotiationThread';
const exercise = content.exercises.find((e) => e.id === 'EX-NEGOTIATE_IT-summit-freelancer-quote')!;
const open = async () => {
  const view = render(
    <MemoryRouter initialEntries={[`/exercise/${exercise.id}`]}>
      <App flags={getFeatureFlags('production')} />
    </MemoryRouter>,
  );
  await screen.findByTestId('negotiation');
  return view;
};
beforeEach(async () => {
  await flushAttemptWrites(exercise.id, NORMAL_RUN);
  await Promise.all(db.tables.map((t) => t.clear()));
});
const reply = (text: string) =>
  fireEvent.change(screen.getByTestId('neg-reply'), { target: { value: text } });
const choice = (id: string, value: string) =>
  fireEvent.change(screen.getByTestId(id), { target: { value } });

describe('real negotiation runner and the shared persistence door', () => {
  it('shows all six actions with AI off and sends the latest text and action immediately', async () => {
    await open();
    expect(screen.getAllByRole('radio')).toHaveLength(6);
    reply('The booking connection leaves qualification and follow-up out.');
    fireEvent.click(screen.getByTestId('neg-action-clarify'));
    choice('neg-diagnosis', 'constraint');
    fireEvent.click(screen.getByTestId('neg-send'));
    await waitFor(async () => {
      const a = await loadAttempt(exercise.id);
      expect(a?.response.negotiation?.turns[0]?.action).toMatchObject({
        action: 'clarify',
        text: 'The booking connection leaves qualification and follow-up out.',
        diagnosis: 'constraint',
      });
    });
    await waitFor(() => expect(screen.getByTestId('neg-dialogue')).toHaveTextContent('outside it'));
  });
  it('queued text and selected action are read by the turn before immediate finalization', async () => {
    const started = await startAttempt(exercise);
    void saveNegotiationDraft(exercise, NORMAL_RUN, {
      text: 'I cannot responsibly promise that full build for the requested fee.',
    });
    void saveNegotiationDraft(exercise, NORMAL_RUN, { action: 'walk_away' });
    void sendNegotiationTurn(exercise, NORMAL_RUN);
    const finished = await finalizeAttempt(exercise, started);
    expect(finished.attempt.response?.negotiation?.turns[0]?.action).toMatchObject({
      text: 'I cannot responsibly promise that full build for the requested fee.',
      action: 'walk_away',
    });
  });
  it('reload resumes draft, hidden state, current node and dialogue', async () => {
    const view = await open();
    reply('Compare qualification before comparing the fee.');
    fireEvent.click(screen.getByTestId('neg-action-clarify'));
    choice('neg-diagnosis', 'constraint');
    fireEvent.click(screen.getByTestId('neg-send'));
    await screen.findByText(/I was thinking closer to fifteen hundred/);
    reply('I want to separate the total from the deposit.');
    fireEvent.click(screen.getByTestId('neg-action-hold_price'));
    await flushAttemptWrites(exercise.id);
    const saved = (await loadAttempt(exercise.id))!.response.negotiation;
    view.unmount();
    await open();
    expect(screen.getByTestId('neg-reply')).toHaveValue(
      'I want to separate the total from the deposit.',
    );
    expect(screen.getByTestId('neg-action-hold_price')).toBeChecked();
    expect((await loadAttempt(exercise.id))!.response.negotiation).toEqual(saved);
    expect(saved?.hidden.trust).toBe(65);
  });
  it('completed negotiation survives reload and fresh retry resets state', async () => {
    const started = await startAttempt(exercise);
    await saveNegotiationDraft(exercise, NORMAL_RUN, {
      action: 'clarify',
      diagnosis: 'constraint',
      text: 'Compare the work each quote includes.',
    });
    await sendNegotiationTurn(exercise, NORMAL_RUN);
    await saveNegotiationDraft(exercise, NORMAL_RUN, {
      action: 'walk_away',
      text: 'The full scope cannot be offered on those terms. We can revisit a smaller brief.',
    });
    await sendNegotiationTurn(exercise, NORMAL_RUN);
    await finalizeAttempt(exercise, started);
    const view = await open();
    expect(screen.getByTestId('neg-terminal')).toHaveTextContent('walked away');
    expect(screen.getByTestId('neg-dialogue')).toHaveTextContent('smaller brief');
    view.unmount();
    await open();
    expect(screen.getByTestId('neg-terminal')).toHaveTextContent('walked away');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByTestId('neg-reply');
    const fresh = await loadAttempt(exercise.id);
    expect(fresh?.attempt_id).not.toBe(started.attempt_id);
    expect(negotiationOf(exercise, fresh?.response.negotiation)).toMatchObject({
      hidden: { trust: 55, frustration: 30 },
      turns: [],
      node: 'competitor_price',
    });
  });
  it('an old saved attempt without negotiation fields opens the authored state', async () => {
    const started = await startAttempt(exercise);
    await saveResponse(exercise.id, NORMAL_RUN, { text: 'Legacy writing', negotiation: undefined });
    await open();
    expect(screen.getByTestId('neg-dialogue')).toHaveTextContent('Calendly');
    expect((await loadAttempt(exercise.id))?.attempt_id).toBe(started.attempt_id);
  });
  it('an unselected move takes authored clarification instead of guessing from prose', async () => {
    await open();
    reply('I could discount or phase it, or perhaps neither.');
    fireEvent.click(screen.getByTestId('neg-send'));
    await screen.findByTestId('neg-fallback');
    expect(screen.getByTestId('neg-agreement')).toHaveTextContent('$2400');
  });
  it('scope, phase and concession controls show actual consequences', async () => {
    await open();
    fireEvent.click(screen.getByTestId('neg-action-reduce_scope'));
    fireEvent.click(screen.getByTestId('neg-remove-typeform_migration'));
    expect(screen.getByText(/Marcus retypes his questions/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('neg-action-phase'));
    choice('neg-phase', 'applications_first');
    expect(screen.getByText(/Between deliveries/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('neg-action-concession'));
    choice('neg-concession', 'balance_later');
    expect(screen.getByText(/finances the remaining balance/)).toBeInTheDocument();
    await flushAttemptWrites(exercise.id);
  });
  it('never renders hidden numeric state, including attributes, before or after completion', () => {
    for (const status of ['open', 'walked_away'] as const) {
      const state = negotiationOf(exercise)!;
      state.status = status;
      if (status !== 'open') state.node = null;
      let i = 0;
      for (const key of Object.keys(state.hidden)) {
        if (key !== 'decision_authority')
          Object.assign(state.hidden, { [key]: 54321.123 + i++ / 1000 });
      }
      const view = render(
        <NegotiationThread
          exercise={exercise}
          saved={state}
          context={NORMAL_RUN}
          readOnly={status !== 'open'}
        />,
      );
      const html = view.container.innerHTML;
      for (const [key, value] of Object.entries(state.hidden)) {
        if (typeof value === 'number') expect(html).not.toContain(String(value));
        expect(html).not.toMatch(new RegExp(`${key}[=:]`));
      }
      expect(html).not.toMatch(/trust meter|budget gauge|type="hidden"|<progress/i);
      view.unmount();
    }
  });
});

it('does not send a stale draft when the latest write failed', async () => {
  await startAttempt(exercise);
  const spy = vi.spyOn(db.workspace, 'put').mockRejectedValueOnce(new Error('quota'));
  await expect(
    saveNegotiationDraft(exercise, NORMAL_RUN, { action: 'walk_away', text: 'The newest text' }),
  ).rejects.toThrow('quota');
  await expect(sendNegotiationTurn(exercise, NORMAL_RUN)).rejects.toThrow('quota');
  spy.mockRestore();
  // A real retry edit recovers the queue, and only then may a turn be sent.
  await saveNegotiationDraft(exercise, NORMAL_RUN, {
    action: 'walk_away',
    text: 'The retried text',
  });
  const result = await sendNegotiationTurn(exercise, NORMAL_RUN);
  expect(result?.response.negotiation?.turns).toHaveLength(1);
  expect(result?.response.negotiation?.turns[0]?.action.text).toBe('The retried text');
});
it('refuses finalization of an open conversation while preserving its attempt', async () => {
  const started = await startAttempt(exercise);
  await expect(finalizeAttempt(exercise, started)).rejects.toThrow('Finish the negotiation');
  expect((await loadAttempt(exercise.id))?.attempt_id).toBe(started.attempt_id);
});

vi.mock('../ai/client', () => ({
  evaluateSubmission: (...args: Parameters<typeof fakeEvaluation>) => fakeEvaluation(...args),
  classifyLanguage: vi.fn().mockResolvedValue(null),
}));
