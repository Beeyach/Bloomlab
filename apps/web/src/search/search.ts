import type { ContentBundle } from '@bloomlab/content-schema';
import type { ExerciseAttemptRecord } from '../data/types';

export const SEARCH_KINDS = [
  'skills',
  'ghl-features',
  'learning-units',
  'glossary',
  'clients',
  'exercises',
  'attempts',
] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];
export const SEARCH_LABELS: Record<SearchKind, string> = {
  skills: 'Skills',
  'ghl-features': 'GHL features',
  'learning-units': 'Academy lessons',
  glossary: 'Glossary',
  clients: 'Clients',
  exercises: 'Practice exercises',
  attempts: 'Saved attempts',
};
export interface SearchDocument {
  id: string;
  kind: SearchKind;
  title: string;
  description: string;
  keywords: string[];
  destination: string;
}
const normal = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
const path = (kind: SearchKind, id: string) => {
  const routes: Partial<Record<SearchKind, string>> = {
    skills: '/skills/',
    'learning-units': '/academy/',
    clients: '/clients/',
    exercises: '/exercise/',
  };
  return routes[kind]
    ? `${routes[kind]}${encodeURIComponent(id)}`
    : `/search#${kind === 'attempts' ? 'attempt' : 'entry'}=${encodeURIComponent(id)}`;
};
/** One local projection over the compiled index and this learner's actual immutable history. */
export function searchDocuments(
  bundle: ContentBundle,
  attempts: readonly ExerciseAttemptRecord[],
  learner: string,
): SearchDocument[] {
  const result: SearchDocument[] = bundle.search
    .filter((entry) => (SEARCH_KINDS as readonly string[]).includes(entry.type))
    .map((entry) => {
      const glossary =
        entry.type === 'glossary' ? bundle.glossary.find((g) => g.id === entry.id) : null;
      const feature =
        entry.type === 'ghl-features' ? bundle.ghl_features.find((f) => f.id === entry.id) : null;
      const skill = entry.type === 'skills' ? bundle.skills.find((s) => s.id === entry.id) : null;
      const kind = entry.type as SearchKind;
      return {
        id: entry.id,
        kind,
        title: entry.title,
        keywords: [...entry.keywords, glossary?.definition ?? ''],
        description:
          glossary?.definition ??
          (feature
            ? `${feature.status.replaceAll('_', ' ')} · Fidelity ${feature.simulation_fidelity} · verified ${feature.last_verified}`
            : (skill?.description ?? '')),
        destination: path(kind, entry.id),
      };
    });
  for (const attempt of attempts) {
    if (attempt.learner_id !== learner || attempt.deleted_at !== null) continue;
    const exercise = bundle.exercises.find((e) => e.id === attempt.exercise_id);
    result.push({
      id: attempt.id,
      kind: 'attempts',
      title: exercise?.title ?? 'Saved exercise',
      description: `${attempt.result} · ${attempt.completed_at.slice(0, 10)} · ${attempt.assistance.replaceAll('_', ' ')} assistance`,
      keywords: [
        attempt.exercise_id ?? '',
        attempt.exercise_type ?? '',
        attempt.result,
        ...attempt.skill_ids,
      ],
      destination: path('attempts', attempt.id),
    });
  }
  return result;
}
/** Whole query words must all match; exact title, title prefix, title words, then aliases/metadata. */
export function searchLocal(
  documents: readonly SearchDocument[],
  query: string,
  kind: SearchKind | 'all' = 'all',
): SearchDocument[] {
  const needle = normal(query.slice(0, 200));
  if (!needle && kind === 'all') return [];
  const words = needle.split(' ').filter(Boolean).slice(0, 16);
  return documents
    .filter((d) => kind === 'all' || d.kind === kind)
    .map((document) => {
      const title = normal(document.title),
        aliases = normal(document.keywords.join(' '));
      const haystack = `${title} ${aliases} ${normal(document.description)} ${normal(document.id)}`;
      const matches = words.every((word) => haystack.includes(word));
      const score = !needle
        ? 0
        : title === needle
          ? 100
          : title.startsWith(needle)
            ? 80
            : words.every((word) => title.includes(word))
              ? 60
              : 20;
      return { document, score: matches ? score : -1 };
    })
    .filter((item) => item.score >= 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.document.title.localeCompare(b.document.title, 'en') ||
        a.document.id.localeCompare(b.document.id, 'en'),
    )
    .map((item) => item.document);
}
