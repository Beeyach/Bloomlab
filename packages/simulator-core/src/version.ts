/**
 * Simulator version (spec §101, SIM-019). Every run, save and simulator-backed attempt records
 * it, so evidence stays bound to the engine that produced it. Bump it whenever simulated
 * behaviour changes — a new event semantic, a different ordering rule, a changed reducer — so a
 * later engine can never silently claim an older run's result as its own.
 *
 * Same shape as the other engines' rule versions (`2026.09.03-r4` for mastery, `2026.09.04-r1`
 * for the exercise grader): the date the behaviour was authored, then a revision within it.
 */
export const SIMULATOR_VERSION = '2026.09.08-r1';
