import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Exercise } from '@bloomlab/content-schema';
import { getFeatureFlags } from '@bloomlab/shared';

import { App } from '../app/App';
import { content } from '../content/bundle';
import { db } from '../data/db';
import { NORMAL_RUN, loadAttempt, saveResponse, startAttempt } from './attempt';
import { evidenceKindFor, finalizeAttempt } from './finalize';
import { emptySalesResponse } from './sales';
import { canGradeNow, missingSources, runtimeFor } from './runtime';

/**
 * The selling families in the runner (EXR-012 … EXR-018, CONV-002).
 *
 * What a learner can actually do: judge three businesses, write their own findings and be held to
 * three labels, write to a cap, explain the same thing twice, and hold a thread with a client that
 * answers them. Nothing here is a screenshot of a feature; every check drives the real screen.
 */

const flags = getFeatureFlags('production');
const PROSPECT = 'EX-PROSPECT_IT-three-businesses';
const AUDIT = 'EX-AUDIT_IT-northwind-outside-in';
const COLD_EMAIL = 'EX-WRITE_IT-northwind-cold-email';
const EXPLAIN = 'EX-EXPLAIN_IT-no-show-system';
const DISCOVERY = 'EX-WRITE_IT-summit-written-discovery';

const byId = (id: string): Exercise =>
  content.exercises.find((candidate) => candidate.id === id) as Exercise;

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App flags={flags} />
    </MemoryRouter>,
  );

const openRunner = async (id: string) => {
  const view = renderAt(`/exercise/${id}`);
  await screen.findByRole('heading', { level: 1, name: byId(id).title });
  return view;
};

const testid = (id: string) => document.querySelector(`[data-testid="${id}"]`);

/**
 * Waits until the draft has actually reached the workspace. Every keystroke saves through Dexie,
 * so a test that ends while a write is in flight would leave it to land in the next one.
 */
const settled = (exerciseId: string, turns: number) =>
  waitFor(async () => {
    const attempt = await loadAttempt(exerciseId, NORMAL_RUN);
    expect(attempt?.response.sales?.turns ?? []).toHaveLength(turns);
  });

/** The same, for a work area whose edits are findings. */
const findingsSettled = (exerciseId: string, count: number) =>
  waitFor(async () => {
    const attempt = await loadAttempt(exerciseId, NORMAL_RUN);
    expect(attempt?.response.sales?.findings ?? []).toHaveLength(count);
  });

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('the selling families are runnable at all (EXR-024)', () => {
  it.each([PROSPECT, AUDIT, COLD_EMAIL, EXPLAIN, DISCOVERY])(
    '%s is graded from what the learner supplied, with no Lab claiming it',
    (id) => {
      const exercise = byId(id);
      expect(missingSources(exercise)).toEqual([]);
      expect(canGradeNow(exercise)).toBe(true);
      expect(runtimeFor(exercise)).toBeNull();
    },
  );

  it('produces sales evidence for the selling families and explanation evidence for EXPLAIN IT', () => {
    expect(evidenceKindFor(byId(PROSPECT), 'normal')).toBe('sales_use');
    expect(evidenceKindFor(byId(AUDIT), 'normal')).toBe('sales_use');
    expect(evidenceKindFor(byId(COLD_EMAIL), 'normal')).toBe('sales_use');
    expect(evidenceKindFor(byId(EXPLAIN), 'normal')).toBe('explanation');
    // A review of one of them is still review, whatever the family is (D-052).
    expect(evidenceKindFor(byId(PROSPECT), 'retrieval')).toBe('retrieval');
  });
});

describe('PROSPECT IT (EXR-012, SAL-002)', () => {
  it('puts three real businesses in front of the learner', async () => {
    await openRunner(PROSPECT);
    const desk = await screen.findByTestId('prospect-desk');
    const names = within(desk)
      .getAllByRole('button')
      .map((button) => button.textContent ?? '');
    expect(names).toHaveLength(3);
    expect(names.join(' ')).toContain('Northwind Heating & Air');
    expect(names.join(' ')).toContain('Ridgeline Roofing');
    expect(names.join(' ')).toContain('Halcyon Yoga');
  });

  it('offers Contact, Maybe and Skip and nothing else', async () => {
    await openRunner(PROSPECT);
    const desk = await screen.findByTestId('prospect-desk');
    const decisions = within(desk).getByRole('group', { name: 'Your call' });
    const radios = within(decisions).getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(within(decisions).getByLabelText(/Contact/)).toBeInTheDocument();
    expect(within(decisions).getByLabelText(/Maybe/)).toBeInTheDocument();
    expect(within(decisions).getByLabelText(/Skip/)).toBeInTheDocument();
  });

  it('asks for the reason and the dimensions behind every decision', async () => {
    await openRunner(PROSPECT);
    expect(await screen.findByTestId('reason-CL-northwind-hvac')).toBeInTheDocument();
    const axes = screen.getByRole('group', { name: 'What drove it' });
    expect(within(axes).getAllByRole('checkbox')).toHaveLength(5);
  });

  it('moves between businesses without losing the one behind it', async () => {
    await openRunner(PROSPECT);
    fireEvent.click(await screen.findByTestId('decision-CL-northwind-hvac-contact'));
    fireEvent.change(screen.getByTestId('reason-CL-northwind-hvac'), {
      target: { value: 'Big ticket and he answers his own reviews.' },
    });
    fireEvent.click(screen.getByTestId('prospect-tab-CL-halcyon-yoga'));
    expect(await screen.findByTestId('prospect-CL-halcyon-yoga')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('prospect-tab-CL-northwind-hvac'));
    await waitFor(() =>
      expect(screen.getByTestId('reason-CL-northwind-hvac')).toHaveValue(
        'Big ticket and he answers his own reviews.',
      ),
    );
  });

  it('resumes the half-finished list after a reload', async () => {
    const { unmount } = await openRunner(PROSPECT);
    fireEvent.click(await screen.findByTestId('prospect-tab-CL-halcyon-yoga'));
    fireEvent.click(await screen.findByTestId('decision-CL-halcyon-yoga-skip'));
    await waitFor(async () => {
      const attempt = await loadAttempt(PROSPECT, NORMAL_RUN);
      expect(attempt?.response.sales?.prospects['CL-halcyon-yoga']?.decision).toBe('skip');
    });
    unmount();

    await openRunner(PROSPECT);
    fireEvent.click(await screen.findByTestId('prospect-tab-CL-halcyon-yoga'));
    await waitFor(() => expect(screen.getByTestId('decision-CL-halcyon-yoga-skip')).toBeChecked());
  });

  it('keeps the authored evaluation off the screen (§53)', async () => {
    await openRunner(PROSPECT);
    await screen.findByTestId('prospect-desk');
    const brief = byId(PROSPECT).sales.prospect_briefs.find(
      (candidate) => candidate.unresolved !== undefined,
    );
    expect(brief?.unresolved).toBeTruthy();
    expect(document.body.textContent).not.toContain(brief?.unresolved);
    expect(document.body.innerHTML).not.toContain('acceptable_decisions');
    expect(document.body.innerHTML).not.toContain('strongest_decision');
  });
});

describe('AUDIT IT (EXR-013, SAL-001)', () => {
  it('shows the evidence and lets the learner write their own findings', async () => {
    await openRunner(AUDIT);
    const desk = await screen.findByTestId('audit-desk');
    expect(within(desk).getByText(/22 hours/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('finding-add'));
    expect(await screen.findByTestId('finding-claim-0')).toBeInTheDocument();
    await findingsSettled(AUDIT, 1);
  });

  it('offers exactly three classifications', async () => {
    await openRunner(AUDIT);
    fireEvent.click(await screen.findByTestId('finding-add'));
    const group = await screen.findByRole('group', { name: 'How sure are you' });
    const labels = within(group)
      .getAllByRole('radio')
      .map((radio) => radio.closest('label')?.textContent ?? '');
    expect(labels).toHaveLength(3);
    expect(labels.join(' ')).toContain('Verified');
    expect(labels.join(' ')).toContain('Likely');
    expect(labels.join(' ')).toContain('Unknown');
    expect(document.body.textContent).not.toMatch(
      /\bConfirmed\b|\bAssumed\b|\bProbable\b|\bGuess\b/,
    );
    await findingsSettled(AUDIT, 1);
  });

  it('says so, on the spot, when a Verified claim has nothing behind it', async () => {
    await openRunner(AUDIT);
    fireEvent.click(await screen.findByTestId('finding-add'));
    fireEvent.change(await screen.findByTestId('finding-claim-0'), {
      target: { value: 'They never follow up an unsold quote.' },
    });
    fireEvent.click(screen.getByTestId('finding-0-verified'));
    expect(await screen.findByTestId('finding-note-0')).toHaveTextContent(
      /nothing you saw yourself/i,
    );

    fireEvent.click(screen.getByTestId('cite-finding-0-ev-nw-reply-22h'));
    await waitFor(() => expect(testid('finding-note-0')).toBeNull());
    await findingsSettled(AUDIT, 1);
  });

  it('asks an Unknown what would settle it', async () => {
    await openRunner(AUDIT);
    fireEvent.click(await screen.findByTestId('finding-add'));
    expect(testid('finding-plan-0')).toBeNull();
    fireEvent.click(screen.getByTestId('finding-0-unknown'));
    expect(await screen.findByTestId('finding-plan-0')).toBeInTheDocument();
    await findingsSettled(AUDIT, 1);
  });

  it('keeps findings across a reload and lets one be removed', async () => {
    const { unmount } = await openRunner(AUDIT);
    fireEvent.click(await screen.findByTestId('finding-add'));
    fireEvent.change(await screen.findByTestId('finding-claim-0'), {
      target: { value: 'The reply took 22 hours.' },
    });
    await waitFor(async () => {
      const attempt = await loadAttempt(AUDIT, NORMAL_RUN);
      expect(attempt?.response.sales?.findings[0]?.claim).toBe('The reply took 22 hours.');
    });
    unmount();

    await openRunner(AUDIT);
    expect(await screen.findByTestId('finding-claim-0')).toHaveValue('The reply took 22 hours.');
    fireEvent.click(screen.getByTestId('finding-remove-0'));
    await waitFor(() => expect(testid('finding-claim-0')).toBeNull());
    await findingsSettled(AUDIT, 0);
  });
});

describe('WRITE IT and EXPLAIN IT (EXR-014, EXR-018)', () => {
  it('counts the words against the cap the brief stated', async () => {
    await openRunner(COLD_EMAIL);
    const box = await screen.findByTestId('write-initial_email');
    fireEvent.change(box, { target: { value: 'word '.repeat(130) } });
    await waitFor(() =>
      expect(screen.getByTestId('count-initial_email')).toHaveTextContent(
        'Over the cap: 130 words, and the brief allows 120.',
      ),
    );
    fireEvent.change(box, { target: { value: 'Three short words' } });
    await waitFor(() =>
      expect(screen.getByTestId('count-initial_email')).toHaveTextContent('3 of 120 words.'),
    );
  });

  it('asks for the one next step and the evidence the message rests on', async () => {
    await openRunner(COLD_EMAIL);
    expect(await screen.findByTestId('next-step-initial_email')).toBeInTheDocument();
    expect(screen.getByTestId('cite-cite-initial_email-ev-nw-reply-22h')).toBeInTheDocument();
    // The follow-up asks for a next step but cites nothing: it is a chase, not an audit.
    expect(screen.getByTestId('next-step-follow_up')).toBeInTheDocument();
    expect(testid('cite-cite-follow_up-ev-nw-reply-22h')).toBeNull();
  });

  it('keeps a draft message across a reload', async () => {
    const { unmount } = await openRunner(COLD_EMAIL);
    fireEvent.change(await screen.findByTestId('write-follow_up'), {
      target: { value: 'One thing I did not send last week.' },
    });
    await waitFor(async () => {
      const attempt = await loadAttempt(COLD_EMAIL, NORMAL_RUN);
      expect(attempt?.response.written?.follow_up).toBe('One thing I did not send last week.');
    });
    unmount();
    await openRunner(COLD_EMAIL);
    expect(await screen.findByTestId('write-follow_up')).toHaveValue(
      'One thing I did not send last week.',
    );
  });

  it('asks for the owner version and the builder version separately', async () => {
    await openRunner(EXPLAIN);
    expect(await screen.findByTestId('write-owner')).toBeInTheDocument();
    expect(screen.getByTestId('write-builder')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('write-owner'), { target: { value: 'For Priya.' } });
    await waitFor(() => expect(screen.getByTestId('write-builder')).toHaveValue(''));
  });

  it('never offers to write it for them (§42)', async () => {
    await openRunner(COLD_EMAIL);
    await screen.findByTestId('write-initial_email');
    expect(document.body.textContent).not.toMatch(
      /generate|improve with ai|rewrite this|suggest a|write it for/i,
    );
  });
});

describe('two edits at once (found by review:sales)', () => {
  it('keeps both when a second field is edited before the first has saved', async () => {
    const exercise = byId(COLD_EMAIL);
    await startAttempt(exercise, NORMAL_RUN);
    // Fired together, exactly as typing in the message and then ticking the evidence does. Before
    // the writes were queued, the second read the row before the first had written it and put
    // back a copy with no message in it.
    await Promise.all([
      saveResponse(COLD_EMAIL, NORMAL_RUN, { written: { follow_up: 'One thing I did not send.' } }),
      saveResponse(COLD_EMAIL, NORMAL_RUN, {
        sales: { ...emptySalesResponse(), next_steps: { follow_up: 'Reply yes or no' } },
      }),
    ]);
    const attempt = await loadAttempt(COLD_EMAIL, NORMAL_RUN);
    expect(attempt?.response.written?.follow_up).toBe('One thing I did not send.');
    expect(attempt?.response.sales?.next_steps.follow_up).toBe('Reply yes or no');
  });

  it('survives a failed write in the middle of the queue', async () => {
    const exercise = byId(AUDIT);
    await startAttempt(exercise, NORMAL_RUN);
    const broken = { workspace: { get: () => Promise.reject(new Error('device is full')) } };
    await Promise.allSettled([
      saveResponse(AUDIT, NORMAL_RUN, { text: 'first' }, broken as never),
      saveResponse(AUDIT, NORMAL_RUN, { text: 'second' }),
    ]);
    const attempt = await loadAttempt(AUDIT, NORMAL_RUN);
    expect(attempt?.response.text).toBe('second');
  });
});

describe('the client thread (CONV-002)', () => {
  it('opens on the client and keeps the conversation going', async () => {
    await openRunner(DISCOVERY);
    const thread = await screen.findByTestId('client-thread');
    expect(within(thread).getByText(/between client blocks/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('move-ask_process'));
    fireEvent.change(screen.getByTestId('thread-composer'), {
      target: { value: 'What happens today when someone applies?' },
    });
    fireEvent.click(screen.getByTestId('thread-send'));

    expect(await screen.findByText(/lands in my inbox/)).toBeInTheDocument();
    expect(screen.getByText('What happens today when someone applies?')).toBeInTheDocument();
    await settled(DISCOVERY, 1);
  });

  it('answers differently when the learner does something different', async () => {
    await openRunner(DISCOVERY);
    fireEvent.click(await screen.findByTestId('move-pitch_first'));
    fireEvent.change(screen.getByTestId('thread-composer'), {
      target: { value: 'I would build you an application funnel.' },
    });
    fireEvent.click(screen.getByTestId('thread-send'));
    // The pitch gets pushed back on; the process answer is what the other branch would have got.
    expect(await screen.findByText(/You have not asked me a single thing/)).toBeInTheDocument();
    expect(screen.queryByText(/lands in my inbox/)).not.toBeInTheDocument();
    await settled(DISCOVERY, 1);
  });

  it('asks what was meant when the learner sends without saying what they are doing', async () => {
    await openRunner(DISCOVERY);
    fireEvent.change(await screen.findByTestId('thread-composer'), {
      target: { value: 'Hi Marcus.' },
    });
    fireEvent.click(screen.getByTestId('thread-send'));
    expect(await screen.findByText(/not sure what you are asking me/i)).toBeInTheDocument();
    expect(screen.getByText('Sent without saying what you were doing.')).toBeInTheDocument();
    await settled(DISCOVERY, 1);
  });

  it('never tells the learner they were correct', async () => {
    await openRunner(DISCOVERY);
    fireEvent.click(await screen.findByTestId('move-ask_process'));
    fireEvent.change(screen.getByTestId('thread-composer'), {
      target: { value: 'How does it work today?' },
    });
    fireEvent.click(screen.getByTestId('thread-send'));
    await screen.findByText(/lands in my inbox/);
    expect(document.body.textContent).not.toMatch(/\bcorrect\b/i);
    expect(document.body.textContent).not.toMatch(/well done|good job|nice work|great answer/i);
    await settled(DISCOVERY, 1);
  });

  it('is still there after a reload, with every message in it', async () => {
    const { unmount } = await openRunner(DISCOVERY);
    fireEvent.click(await screen.findByTestId('move-ask_process'));
    fireEvent.change(screen.getByTestId('thread-composer'), {
      target: { value: 'How does it work today?' },
    });
    fireEvent.click(screen.getByTestId('thread-send'));
    await screen.findByText(/lands in my inbox/);
    await waitFor(async () => {
      const attempt = await loadAttempt(DISCOVERY, NORMAL_RUN);
      expect(attempt?.response.sales?.turns).toHaveLength(1);
    });
    unmount();

    await openRunner(DISCOVERY);
    expect(await screen.findByText('How does it work today?')).toBeInTheDocument();
    expect(screen.getByText(/lands in my inbox/)).toBeInTheDocument();
    expect(screen.getByTestId('thread-composer')).toHaveValue('');
  });

  it('keeps the finished thread with the attempt, and a new attempt starts empty', async () => {
    const exercise = byId(DISCOVERY);
    await startAttempt(exercise, NORMAL_RUN);
    await saveResponse(DISCOVERY, NORMAL_RUN, {
      sales: {
        ...emptySalesResponse(),
        turns: [{ node: 'n1', move: 'ask_process', text: 'How does it work today?' }],
      },
    });
    const attempt = (await loadAttempt(DISCOVERY, NORMAL_RUN))!;
    const finished = await finalizeAttempt(exercise, attempt, db);
    expect(finished.attempt.response?.sales?.turns).toHaveLength(1);

    // The draft is gone; the record is not. A second attempt inherits none of it (§52).
    expect(await loadAttempt(DISCOVERY, NORMAL_RUN)).toBeUndefined();
    const next = await startAttempt(exercise, NORMAL_RUN);
    expect(next.response.sales?.turns ?? []).toHaveLength(0);
  });
});
