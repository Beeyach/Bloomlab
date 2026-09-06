import { content } from '../../content/bundle';
import type { JargonTerm } from './explanation';

/**
 * The builder vocabulary an owner explanation is counted against (SAL-007).
 *
 * It is the glossary — the terms Bloomlab already teaches — minus the ones a business owner uses
 * anyway (`owner_safe`). There is no second list hidden in a component, so adding a term to the
 * curriculum adds it here, and arguing that a word is ordinary business language is an edit to
 * content rather than to code.
 */
export function jargonVocabulary(): JargonTerm[] {
  return content.glossary
    .filter((entry) => !entry.owner_safe)
    .map((entry) => ({
      id: entry.id,
      term: entry.term,
      forms: [entry.term, ...entry.aliases].map((form) => form.toLowerCase()),
    }));
}
