import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { content } from '../content/bundle';
import { db } from '../data/db';
import { ensureDevice } from '../data/device';
import { savedWork } from '../portfolio/fixtures';
import { RootLayout } from '../app/RootLayout';
import { FeatureFlagsProvider } from '../app/FeatureFlagsProvider';
import { getFeatureFlags } from '@bloomlab/shared';
import SearchScreen from './SearchScreen';
import { searchDocuments, searchLocal, SEARCH_KINDS, type SearchDocument } from './search';

beforeEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await Promise.all(db.tables.map((t) => t.clear()));
  await ensureDevice();
});
function Location() {
  const location = useLocation();
  return (
    <output aria-label="Location">
      {location.pathname}
      {location.search}
      {location.hash}
    </output>
  );
}
function mount(path = '/search') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SearchScreen />
      <Location />
    </MemoryRouter>,
  );
}

describe('INF-017 / CNT-010 one private local search', () => {
  it('uses the compiled index for all five required content types plus practice, and genuine owned attempts only', async () => {
    const { attempt } = await savedWork(db);
    const learner = (await ensureDevice()).learner_id;
    const docs = searchDocuments(
      content,
      [
        attempt!,
        { ...attempt!, id: 'foreign', learner_id: 'foreign' },
        { ...attempt!, id: 'deleted', deleted_at: attempt!.completed_at },
      ],
      learner,
    );
    for (const kind of SEARCH_KINDS) expect(docs.some((d) => d.kind === kind)).toBe(true);
    expect(docs.filter((d) => d.kind === 'attempts').map((d) => d.id)).toEqual([attempt!.id]);
    expect(docs.filter((d) => d.kind === 'glossary')).toHaveLength(content.glossary.length);
    expect(docs.filter((d) => d.kind === 'ghl-features')).toHaveLength(content.ghl_features.length);
    expect(docs.find((d) => d.id === attempt!.id)!.destination).toBe(
      `/search#attempt=${attempt!.id}`,
    );
    expect(docs.every((d) => !d.destination.includes('?'))).toBe(true);
  });
  it('ranks exact title, prefix, title words, then aliases; normalizes punctuation/diacritics and requires every query word', () => {
    const make = (id: string, title: string, keywords: string[] = []): SearchDocument => ({
      id,
      title,
      keywords,
      kind: 'glossary',
      description: '',
      destination: `/search#entry=${id}`,
    });
    const docs = [
      make('alias', 'Appointment', ['booking']),
      make('contains', 'Class booking'),
      make('prefix', 'Booking confirmation'),
      make('exact', 'Booking'),
    ];
    expect(searchLocal(docs, 'bóoking').map((d) => d.id)).toEqual([
      'exact',
      'prefix',
      'contains',
      'alias',
    ]);
    expect(searchLocal(docs, 'CLASS booking').map((d) => d.id)).toEqual(['contains']);
    expect(searchLocal(docs, 'booking absent')).toEqual([]);
    expect(searchLocal(docs, '')).toEqual([]);
    expect(searchLocal(docs, '', 'glossary')).toHaveLength(4);
    expect(searchLocal(docs, 'booking', 'clients')).toEqual([]);
  });
  it('renders clear empty/no-match states, categories and local fragment queries without requests', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    mount();
    expect(screen.getByText('Type to search, or choose a category to browse.')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'no-matches-canary' } });
    expect(screen.getByText(/No matches/)).toBeInTheDocument();
    expect(screen.getByLabelText('Location')).toHaveTextContent('/search#q=no-matches-canary');
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Look in'), { target: { value: 'glossary' } });
    await waitFor(() =>
      expect(screen.getByText(`${content.glossary.length} results`)).toBeInTheDocument(),
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it('opens the actual glossary definition and related skills/features, preserving the query and focus', async () => {
    const term = content.glossary.find((g) => g.related_skills.length && g.ghl_features.length)!;
    mount(`/search#q=${encodeURIComponent(term.term)}`);
    fireEvent.click(screen.getByRole('link', { name: term.term }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(term.term);
    expect(screen.getByText(term.definition)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
    expect(
      screen
        .getAllByRole('link')
        .some((a) => a.getAttribute('href') === `/skills/${term.related_skills[0]}`),
    ).toBe(true);
    fireEvent.click(screen.getByRole('link', { name: 'Back to search' }));
    expect(screen.getByRole('searchbox')).toHaveValue(term.term);
    expect(screen.getByRole('searchbox')).toHaveFocus();
  });
  it('shows exact current registry status, date, fidelity, source and ALL recorded limitations', () => {
    const feature = content.ghl_features.find((f) => f.id === 'GHL-API-WEBHOOKS')!;
    mount(`/search#entry=${feature.id}`);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(feature.official_name);
    expect(screen.getByText(feature.status)).toBeInTheDocument();
    expect(screen.getByText(feature.verification_note!)).toBeInTheDocument();
    for (const limit of feature.known_limitations)
      expect(screen.getByText(limit)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Official documentation/ })).toHaveAttribute(
      'href',
      feature.source_url,
    );
    expect(screen.getByText(new RegExp(`^Verified ${feature.last_verified}`))).toBeInTheDocument();
  });
  it('opens a selected immutable attempt, not the newest exercise draft or a fabricated completion', async () => {
    const { attempt } = await savedWork(db);
    await savedWork(db, { result: 'failed' });
    const before = await db.exercise_attempts.toArray();
    mount(`/search#attempt=${attempt!.id}`);
    expect(await screen.findByText(/This is historical work/)).toHaveTextContent('passed');
    expect(screen.getByText(attempt!.response!.text)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(await db.exercise_attempts.toArray()).toEqual(before);
  });
  it('has honest unknown/deleted/foreign history states', async () => {
    const { attempt } = await savedWork(db);
    await db.exercise_attempts.update(attempt!.id, { learner_id: 'foreign' });
    mount(`/search#attempt=${attempt!.id}`);
    expect(await screen.findByText(/not available for this learner/)).toBeInTheDocument();
    cleanup();
    mount('/search#entry=not-a-real-feature');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Entry unavailable');
  });
  it('keeps curriculum usable on history storage failure and retries', async () => {
    const filter = vi.spyOn(db.exercise_attempts, 'filter').mockImplementation(() => {
      throw new Error('storage denied');
    });
    mount('/search#kind=glossary');
    expect(await screen.findByRole('alert')).toHaveTextContent('Curriculum search still works');
    expect(screen.getByText(`${content.glossary.length} results`)).toBeInTheDocument();
    filter.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Retry history' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
  it('opens from the global keyboard shortcut without replacing the four primary phone destinations', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <FeatureFlagsProvider flags={getFeatureFlags('local')}>
          <Routes>
            <Route element={<RootLayout />}>
              <Route path="/" element={<h1>Controlled home</h1>} />
              <Route path="/search" element={<SearchScreen />} />
            </Route>
          </Routes>
        </FeatureFlagsProvider>
      </MemoryRouter>,
    );
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(await screen.findByRole('searchbox')).toHaveFocus();
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect([...nav.querySelectorAll('ul')][0]!.querySelectorAll('a')[3]).toHaveTextContent(
      'Workflow',
    );
    screen.getByRole('button', { name: 'Clear search' }).focus();
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(screen.getByRole('searchbox')).toHaveFocus();
  });
});
