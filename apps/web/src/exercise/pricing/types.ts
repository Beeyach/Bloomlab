/**
 * What a learner sets on the deal desk (EXR-016).
 *
 * The eight things PRICE IT asks for, and nothing derived: the project fee, the deposit, the
 * recurring fee, the rush fee, the timeline, the revisions, what is in (the scope they kept) and
 * what is explicitly out (the exclusions they wrote). Everything else — the total, what is due
 * now, the margin — is worked out from these by one function, never stored beside them.
 *
 * `null` means "not set yet" and is different from `0`: a learner who has decided there is no
 * recurring fee has answered the question, and one who has not reached it has not.
 */

/** A deposit as the learner expressed it. Both forms are canonicalised to dollars once. */
export interface DepositInput {
  kind: 'percent' | 'amount';
  value: number;
}

export interface PricingResponse {
  /** Scope lines the learner has taken out. Everything the exercise authors is in by default. */
  excluded: string[];
  project: number | null;
  rush_fee: number | null;
  recurring: number | null;
  deposit: DepositInput | null;
  timeline_days: number | null;
  revisions: number | null;
  /** What the learner has written as explicitly out of scope. */
  exclusions: string[];
}

export const emptyPricingResponse = (): PricingResponse => ({
  excluded: [],
  project: null,
  rush_fee: null,
  recurring: null,
  deposit: null,
  timeline_days: null,
  revisions: null,
  exclusions: [],
});
