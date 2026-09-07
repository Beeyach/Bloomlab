import { useState } from 'react';
import type { Exercise } from '@bloomlab/content-schema';
import { saveNegotiationDraft, sendNegotiationTurn, type AttemptContext } from '../attempt';
import { negotiationOf, negotiationSpeaker } from '../negotiation/context';
import {
  negotiationDialogue,
  negotiationProjection,
  type NegotiationAction,
  type NegotiationState,
} from '../negotiation/engine';
import { economicsFor, quoteOf } from '../pricing';
import styles from './work.module.css';
import local from './negotiation.module.css';

const ACTION_LABELS = {
  clarify: 'Clarify',
  hold_price: 'Hold price',
  reduce_scope: 'Reduce scope',
  phase: 'Phase the project',
  concession: 'Offer a concession',
  walk_away: 'Walk away',
} as const;
export function NegotiationThread({
  exercise,
  saved,
  context,
  disabled = false,
  readOnly = false,
}: {
  exercise: Exercise;
  saved?: NegotiationState;
  context: AttemptContext;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  const [state, setState] = useState(() => negotiationOf(exercise, saved));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!exercise.negotiation || !state) return null;
  const config = exercise.negotiation;
  const draft = state.draft;
  const node = config.nodes.find((n) => n.id === state.node);
  const quote = quoteOf(state.deal.quote);
  const projection = negotiationProjection(config, economicsFor(exercise), state);
  const editable = !readOnly && !projection.complete;
  const change = (patch: Partial<NegotiationAction>) => {
    setState((s) => (s ? { ...s, draft: { ...s.draft, ...patch } } : s));
    void saveNegotiationDraft(exercise, context, patch).catch(() =>
      setError('Your reply could not be saved. Try the edit again before sending.'),
    );
  };
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const attempt = await sendNegotiationTurn(exercise, context);
      if (attempt?.response.negotiation) setState(attempt.response.negotiation);
      else setError('This attempt is no longer open. Reload to see its saved result.');
    } catch {
      setError('Your turn could not be saved. Your draft is still here; try sending again.');
    } finally {
      setBusy(false);
    }
  };
  const amount = (key: 'project' | 'phase_two_project' | 'timeline_days', label: string) => (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        type="number"
        min="0"
        max="1000000"
        step="1"
        inputMode="numeric"
        value={draft[key] ?? ''}
        data-testid={`neg-${key}`}
        onChange={(e) => change({ [key]: e.target.value === '' ? null : Number(e.target.value) })}
      />
    </label>
  );
  const concession = config.concessions.find((c) => c.id === draft.concession);
  const phase = config.phases.find((p) => p.id === state.deal.phase?.id);
  return (
    <section
      className={local.negotiation}
      data-testid="negotiation"
      aria-label="Negotiation conversation"
    >
      <header className={styles.threadHead}>
        <h3 className={styles.deskTitle}>{config.subject}</h3>
        <p className={styles.deskNote}>
          Standalone practice agreement · Changes apply to this attempt.
        </p>
      </header>
      <div className={local.layout}>
        <div className={styles.thread}>
          <ol className={styles.messages} aria-live="polite" data-testid="neg-dialogue">
            {negotiationDialogue(config, state).map((message, i) => (
              <li
                key={i}
                className={message.from === 'client' ? styles.fromClient : styles.fromLearner}
              >
                <p className={styles.messageWho}>
                  {message.from === 'client' ? negotiationSpeaker(exercise) : 'You'}
                </p>
                <p className={styles.messageText}>{message.text}</p>
              </li>
            ))}
          </ol>
          {editable && node && (
            <div className={styles.composer}>
              <p className={styles.help}>
                Choose the move you intend. Your words are saved for reasoning review; an unselected
                move asks the client to clarify.
              </p>
              <fieldset className={styles.choices} disabled={disabled || busy}>
                <legend className={styles.legend}>Your move</legend>
                {Object.entries(ACTION_LABELS).map(([value, label]) => (
                  <label key={value} className={styles.choice}>
                    <input
                      type="radio"
                      name="neg-action"
                      checked={draft.action === value}
                      data-testid={`neg-action-${value}`}
                      onChange={() => change({ action: value as NegotiationAction['action'] })}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>
              <fieldset disabled={disabled || busy} className={local.terms}>
                <legend className={styles.legend}>Shape your reply</legend>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>How you will respond</span>
                  <select
                    value={draft.approach}
                    data-testid="neg-approach"
                    onChange={(e) =>
                      change({ approach: e.target.value as NegotiationAction['approach'] })
                    }
                  >
                    <option value="address">Address the current objection</option>
                    <option value="pitch">Pitch the solution again</option>
                    <option value="ignore">Move past this objection</option>
                    <option value="defensive">Challenge the client’s judgment</option>
                  </select>
                </label>
                {draft.action === 'clarify' && (
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>What you want to establish</span>
                    <select
                      value={draft.diagnosis ?? ''}
                      data-testid="neg-diagnosis"
                      onChange={(e) => change({ diagnosis: e.target.value || null })}
                    >
                      <option value="">Choose the distinction you are asking about</option>
                      {node.diagnosis.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {draft.action === 'reduce_scope' && (
                  <>
                    <p className={styles.help}>
                      Take named work out. Its consequences become exclusions in the offer.
                    </p>
                    {config.pricing.scope.map((s) => (
                      <label className={styles.choice} key={s.id}>
                        <input
                          type="checkbox"
                          disabled={s.locked}
                          data-testid={`neg-remove-${s.id}`}
                          checked={draft.excluded.includes(s.id)}
                          onChange={() =>
                            change({
                              excluded: draft.excluded.includes(s.id)
                                ? draft.excluded.filter((id) => id !== s.id)
                                : [...draft.excluded, s.id],
                            })
                          }
                        />
                        <span>
                          <span className={styles.choiceName}>
                            {s.name}
                            {s.locked ? ' · Required foundation' : ''}
                          </span>
                          {draft.excluded.includes(s.id) && (
                            <span className={styles.choiceHelp}>{s.consequence}</span>
                          )}
                        </span>
                      </label>
                    ))}
                    {amount('project', 'New project fee (USD)')}
                  </>
                )}
                {draft.action === 'phase' && (
                  <>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Delivery stages</span>
                      <select
                        value={draft.phase ?? ''}
                        data-testid="neg-phase"
                        onChange={(e) => change({ phase: e.target.value || null })}
                      >
                        <option value="">Choose a delivery plan</option>
                        {config.phases.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {amount('project', 'Phase 1 fee (USD)')}
                    {amount('phase_two_project', 'Phase 2 fee (USD)')}
                    {amount(
                      'timeline_days',
                      'Phase 1 delivery in days (blank keeps current terms)',
                    )}
                    <p className={styles.help}>
                      {config.phases.find((p) => p.id === draft.phase)?.consequence}
                    </p>
                  </>
                )}
                {draft.action === 'concession' && (
                  <>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>The concession and trade</span>
                      <select
                        value={draft.concession ?? ''}
                        data-testid="neg-concession"
                        onChange={(e) => change({ concession: e.target.value || null })}
                      >
                        <option value="">Choose the terms you are offering</option>
                        {config.concessions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {concession && (
                      <p className={styles.help}>
                        {concession.consequence}{' '}
                        {concession.trade?.label ?? 'No reciprocal commitment.'}
                      </p>
                    )}
                    {concession?.kind === 'discount' &&
                      amount('project', 'New fee for the retained work (USD)')}
                  </>
                )}
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Your reply</span>
                  <textarea
                    rows={5}
                    value={draft.text}
                    className={styles.textarea}
                    data-testid="neg-reply"
                    onChange={(e) => change({ text: e.target.value })}
                  />
                </label>
              </fieldset>
              <button
                type="button"
                className={styles.addButton}
                data-testid="neg-send"
                disabled={disabled || busy || !draft.text.trim()}
                onClick={() => void send()}
              >
                {busy ? 'Sending…' : 'Send reply'}
              </button>
              {state.turns.at(-1)?.fallback && (
                <p className={styles.help} data-testid="neg-fallback">
                  The client needs a clearer move and complete terms. No new offer was made.
                </p>
              )}
            </div>
          )}
          {projection.complete && (
            <p role="status" data-testid="neg-terminal" className={styles.deskNote}>
              {state.status === 'won'
                ? 'Deal agreed.'
                : state.status === 'walked_away'
                  ? 'You walked away.'
                  : state.status === 'approval_needed'
                    ? 'Awaiting another decision maker.'
                    : 'No agreement.'}{' '}
              {readOnly
                ? 'The conversation is saved with this result.'
                : 'Use Run it to review your decisions. The deal outcome does not decide your score.'}
            </p>
          )}
          {error && <p role="alert">{error}</p>}
        </div>
        <aside
          className={local.agreement}
          aria-label="Current agreement"
          data-testid="neg-agreement"
        >
          <h4 className={styles.deskTitle}>The agreement on the table</h4>
          <p className={styles.deskNote}>
            {state.deal.phase ? 'Phase 1' : 'Project'}: ${quote.total} · Deposit: ${quote.deposit} ·{' '}
            {quote.timeline_days} days · {quote.revisions} revision rounds
          </p>
          <p className={styles.help}>
            Separate support: ${quote.recurring} per month. Balance{' '}
            {state.deal.balance_days
              ? `${state.deal.balance_days} days after delivery`
              : 'on delivery'}
            .
          </p>
          {state.deal.phase && (
            <>
              <p className={styles.deskNote}>
                Phase 2: ${state.deal.phase.project} · {state.deal.phase.days} days after Phase 1
                acceptance
              </p>
              <p className={styles.help}>{phase?.consequence}</p>
            </>
          )}
          <details className={local.scopeDetails}>
            <summary>Read scope and exclusions</summary>
            <ul className={local.scope}>
              {config.pricing.scope.map((s) => (
                <li key={s.id}>
                  <strong>{s.name}</strong>
                  <p>
                    {state.deal.quote.excluded.includes(s.id)
                      ? `Excluded. ${s.consequence}`
                      : state.deal.phase?.deferred.includes(s.id)
                        ? `Phase 2. Until then: ${s.consequence}`
                        : `${state.deal.phase ? 'Phase 1. ' : ''}${s.description}`}
                  </p>
                </li>
              ))}
            </ul>
          </details>
          {config.pricing.scope
            .filter((s) => state.deal.quote.excluded.includes(s.id))
            .map((s) => (
              <p key={s.id} className={styles.help}>
                Excluded: {s.name}. {s.consequence}
              </p>
            ))}
          {state.deal.concessions.map((id) => {
            const c = config.concessions.find((c) => c.id === id);
            return c ? (
              <p key={id} className={styles.help}>
                {c.consequence} {c.trade?.label ?? 'No reciprocal commitment.'}
              </p>
            ) : null;
          })}
          <p className={styles.help}>{config.starting_deal.exclusions.join(' ')}</p>
        </aside>
      </div>
    </section>
  );
}
