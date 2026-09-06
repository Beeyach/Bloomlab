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
import { emptyPricingResponse } from './pricing';
import { canGradeNow, missingSources } from './runtime';

/**
 * The deal desk in the runner (EXR-016, PRI-001, PRI-002).
 *
 * The two things this file exists to hold: a learner can actually price a deal on this screen and
 * come back to it, and none of the hidden economics reach the page before they submit. The second
 * is the one worth a test, because it is the requirement that is easiest to break by accident and
 * impossible to notice by reading the code.
 */

const flags = getFeatureFlags('production');
const GLOWHAUS = 'EX-PRICE_IT-glowhaus-two-locations';
const SUMMIT = 'EX-PRICE_IT-summit-application-funnel';

const byId = (id: string): Exercise =>
  content.exercises.find((candidate) => candidate.id === id) as Exercise;

const openRunner = async (id: string) => {
  const view = render(
    <MemoryRouter initialEntries={[`/exercise/${id}`]}>
      <App flags={flags} />
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { level: 1, name: byId(id).title });
  return view;
};

/** Waits until the draft has reached the workspace, so no write lands in the next test. */
const pricingSettled = (exerciseId: string, check: (project: number | null) => boolean) =>
  waitFor(async () => {
    const attempt = await loadAttempt(exerciseId, NORMAL_RUN);
    expect(check(attempt?.response.pricing?.project ?? null)).toBe(true);
  });

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('PRICE IT is runnable from what the learner supplies (EXR-024)', () => {
  it.each([GLOWHAUS, SUMMIT])('%s needs no Lab account to grade', (id) => {
    expect(missingSources(byId(id))).toEqual([]);
    expect(canGradeNow(byId(id))).toBe(true);
  });

  it('counts as having sold something', () => {
    expect(evidenceKindFor(byId(GLOWHAUS), 'normal')).toBe('sales_use');
  });
});

describe('the desk is one object with seven areas (PRI-001)', () => {
  it('shows the requirements, the scope, the price, the payment, the timeline, the recurring fee and the exclusions', async () => {
    await openRunner(GLOWHAUS);
    const desk = await screen.findByTestId('deal-desk');
    for (const heading of [
      'What they asked for',
      'What is in the deal',
      'The price',
      'How it is paid',
      'How long it takes',
      'What recurs',
      'What is not included',
    ]) {
      expect(within(desk).getByRole('heading', { name: heading })).toBeInTheDocument();
    }
  });

  it('collects all eight of the answers PRICE IT asks for (EXR-016)', async () => {
    await openRunner(GLOWHAUS);
    await screen.findByTestId('deal-desk');
    for (const field of [
      'deal-project',
      'deal-rush-fee',
      'deal-recurring',
      'deposit-value',
      'deal-timeline',
      'deal-revisions',
    ]) {
      expect(screen.getByTestId(field)).toBeInTheDocument();
    }
    // The seventh and eighth: what is in, and what is explicitly out.
    expect(within(screen.getByTestId('deal-desk')).getAllByRole('checkbox').length).toBeGreaterThan(
      0,
    );
    expect(screen.getByTestId('exclusion-add')).toBeInTheDocument();
  });

  it('adds the learner’s own numbers up in front of them', async () => {
    await openRunner(GLOWHAUS);
    await screen.findByTestId('deal-desk');
    fireEvent.change(screen.getByTestId('deal-project'), { target: { value: '3200' } });
    fireEvent.change(screen.getByTestId('deal-rush-fee'), { target: { value: '600' } });
    fireEvent.click(screen.getByTestId('deposit-kind-percent'));
    fireEvent.change(screen.getByTestId('deposit-value'), { target: { value: '40' } });

    await waitFor(() => expect(screen.getByTestId('deal-total')).toHaveTextContent('$3,800'));
    expect(screen.getByTestId('deal-due-now')).toHaveTextContent('$1,520');
    expect(screen.getByTestId('deal-on-delivery')).toHaveTextContent('$2,280');
    await pricingSettled(GLOWHAUS, (project) => project === 3200);
  });

  it('turns a monthly fee into what it comes to over a year', async () => {
    await openRunner(GLOWHAUS);
    await screen.findByTestId('deal-desk');
    fireEvent.change(screen.getByTestId('deal-recurring'), { target: { value: '250' } });
    await waitFor(() =>
      expect(screen.getByTestId('deal-recurring-annual')).toHaveTextContent('$3,000'),
    );
  });
});

describe('taking scope out has consequences the learner can see (PRI-001)', () => {
  it('says which requirement nothing answers any more', async () => {
    await openRunner(GLOWHAUS);
    await screen.findByTestId('deal-desk');
    const requirement = screen.getByTestId('requirement-stop_retyping');
    expect(requirement).toHaveTextContent('The deal answers this.');

    const line = screen.getByText('Connecting Meta Lead Ads').closest('label');
    const checkbox = document.getElementById(line?.getAttribute('for') ?? '');
    fireEvent.click(checkbox as HTMLElement);

    await waitFor(() =>
      expect(screen.getByTestId('requirement-stop_retyping')).toHaveTextContent(
        'Nothing left in the deal answers this.',
      ),
    );
  });

  it('says what removing a line leaves the client with, in the client’s terms', async () => {
    await openRunner(GLOWHAUS);
    await screen.findByTestId('deal-desk');
    const line = screen.getByText('Booking page design').closest('label');
    fireEvent.click(document.getElementById(line?.getAttribute('for') ?? '') as HTMLElement);
    await waitFor(() =>
      expect(screen.getByTestId('deal-desk')).toHaveTextContent(
        /Priya gets the default booking page/,
      ),
    );
  });

  it('will not let the brief’s own promise be taken out', async () => {
    await openRunner(GLOWHAUS);
    await screen.findByTestId('deal-desk');
    const line = screen.getByText('Two booking calendars').closest('label');
    const checkbox = document.getElementById(line?.getAttribute('for') ?? '');
    expect(checkbox).toBeDisabled();
  });

  it('names a line left depending on something taken out', async () => {
    await openRunner(SUMMIT);
    await screen.findByTestId('deal-desk');
    expect(screen.queryByTestId('scope-dangling')).toBeNull();
    // No-show recovery needs the calendar. Taking the calendar out leaves it pointing at nothing.
    const calendar = screen.getByText('Discovery calendar').closest('label');
    fireEvent.click(document.getElementById(calendar?.getAttribute('for') ?? '') as HTMLElement);
    const dangling = await screen.findByTestId('scope-dangling');
    expect(dangling).toHaveTextContent('No-show recovery');
    await waitFor(async () => {
      const attempt = await loadAttempt(SUMMIT, NORMAL_RUN);
      expect(attempt?.response.pricing?.excluded).toEqual(['discovery_calendar']);
    });
  });
});

describe('the hidden economics stay hidden until it is submitted (EXR-016)', () => {
  it('shows no hours, no cost, no floor and no margin while the learner is deciding', async () => {
    await openRunner(GLOWHAUS);
    const desk = await screen.findByTestId('deal-desk');
    const pricing = byId(GLOWHAUS).pricing!;
    const text = desk.textContent ?? '';

    expect(text).not.toMatch(/margin/i);
    expect(text).not.toMatch(/\bcost\b/i);
    expect(text).not.toContain(String(pricing.cost.hourly_cost));
    // The total hours of the build, and every individual line's hours.
    const hours = pricing.scope.reduce((sum, line) => sum + line.hours, 0);
    expect(text).not.toContain(`${hours} hours`);
    expect(desk.innerHTML).not.toContain('hourly_cost');
    for (const line of pricing.scope) {
      expect(desk.innerHTML).not.toContain(`"hours":${line.hours}`);
    }
    // No scope line shows a price: every price column is the dash the component renders for null.
    expect(text).not.toMatch(/\$\d+ ?(Included|Excluded|Required)/);
  });

  it('shows what the deal cost only once the attempt is in', async () => {
    const exercise = byId(GLOWHAUS);
    await startAttempt(exercise, NORMAL_RUN);
    await saveResponse(GLOWHAUS, NORMAL_RUN, {
      pricing: {
        ...emptyPricingResponse(),
        project: 3200,
        rush_fee: 600,
        recurring: 250,
        deposit: { kind: 'percent', value: 40 },
        timeline_days: 11,
        revisions: 1,
        exclusions: ['Treatment copy', 'Paid ads', 'Square after the import date'],
      },
    });
    const attempt = await loadAttempt(GLOWHAUS, NORMAL_RUN);
    await finalizeAttempt(exercise, attempt!, db);

    await openRunner(GLOWHAUS);
    const reveal = await screen.findByTestId('deal-reveal');
    // 31 hours of scope, 2 more for the revision round, 6 for the compressed timeline, at $55.
    expect(reveal).toHaveTextContent('31 hours');
    expect(reveal).toHaveTextContent('$2,145');
    expect(screen.getByTestId('reveal-total')).toHaveTextContent('$3,800');
    expect(screen.getByTestId('reveal-margin')).toHaveTextContent('44%');
  });
});

describe('the desk survives a reload (EXR-016)', () => {
  it('comes back with the same numbers, the same scope and the same exclusions', async () => {
    const { unmount } = await openRunner(SUMMIT);
    await screen.findByTestId('deal-desk');
    fireEvent.change(screen.getByTestId('deal-project'), { target: { value: '2400' } });
    fireEvent.change(screen.getByTestId('deal-timeline'), { target: { value: '21' } });
    fireEvent.click(screen.getByTestId('exclusion-add'));
    fireEvent.change(await screen.findByTestId('exclusion-0'), {
      target: { value: 'Writing the application questions from scratch' },
    });
    await waitFor(async () => {
      const attempt = await loadAttempt(SUMMIT, NORMAL_RUN);
      expect(attempt?.response.pricing?.exclusions).toEqual([
        'Writing the application questions from scratch',
      ]);
      expect(attempt?.response.pricing?.project).toBe(2400);
      expect(attempt?.response.pricing?.timeline_days).toBe(21);
    });
    unmount();

    await openRunner(SUMMIT);
    expect(await screen.findByTestId('deal-project')).toHaveValue(2400);
    expect(screen.getByTestId('deal-timeline')).toHaveValue(21);
    expect(screen.getByTestId('exclusion-0')).toHaveValue(
      'Writing the application questions from scratch',
    );
  });

  it('keeps a scope decision and a fee typed in the same breath (D-158)', async () => {
    const { unmount } = await openRunner(SUMMIT);
    await screen.findByTestId('deal-desk');
    fireEvent.change(screen.getByTestId('deal-project'), { target: { value: '2400' } });
    const line = screen.getByText('Moving the Typeform questions').closest('label');
    fireEvent.click(document.getElementById(line?.getAttribute('for') ?? '') as HTMLElement);
    fireEvent.change(screen.getByTestId('deal-recurring'), { target: { value: '150' } });

    await waitFor(async () => {
      const attempt = await loadAttempt(SUMMIT, NORMAL_RUN);
      expect(attempt?.response.pricing?.excluded).toEqual(['typeform_migration']);
      expect(attempt?.response.pricing?.recurring).toBe(150);
      expect(attempt?.response.pricing?.project).toBe(2400);
    });
    unmount();

    await openRunner(SUMMIT);
    expect(await screen.findByTestId('deal-recurring')).toHaveValue(150);
    expect(screen.getByTestId('deal-project')).toHaveValue(2400);
  });
});
