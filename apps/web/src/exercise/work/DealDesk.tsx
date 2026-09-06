import { PricingScopeItem, formatCurrency } from '@bloomlab/design-system';
import type { Exercise } from '@bloomlab/content-schema';

import {
  count,
  danglingScope,
  includedScope,
  isRushed,
  money as parseMoney,
  quoteOf,
  unansweredRequirements,
  type PricingResponse,
} from '../pricing';
import styles from './work.module.css';

/**
 * PRICE IT: the deal desk (EXR-016, PRI-001, PRI-002, SAL-016).
 *
 * One working object with seven areas — what they asked for, what is in the deal, the price, how
 * it is paid, how long it takes, what recurs, and what is explicitly out. Changing the scope
 * changes the other areas immediately, because they are all views of the same eight answers.
 *
 * What the learner sees here is their own arithmetic and their own promises: the total, what is
 * due on signature, what is left on delivery, which requirement no longer has anything answering
 * it. What they do not see is what any of it costs to deliver. Hours, cost, the floor and the
 * margin stay hidden until the attempt is submitted (EXR-016), which is why the price column on
 * every scope line reads as a dash: there is no number there to lean on, so the decision has to
 * be made on what the client actually asked for.
 */
export function DealDesk({
  exercise,
  pricing,
  disabled,
  onChange,
}: {
  exercise: Exercise;
  pricing: PricingResponse;
  disabled: boolean;
  onChange: (change: Partial<PricingResponse>) => void;
}) {
  const config = exercise.pricing;
  if (!config) return null;

  const currency = config.currency;
  const quote = quoteOf(pricing);
  const kept = includedScope(config, pricing);
  const dangling = danglingScope(config, pricing);
  const unanswered = unansweredRequirements(config, pricing);
  const rushed = isRushed(config, pricing.timeline_days);
  const money = (value: number | null) =>
    value === null ? 'Not set' : formatCurrency(value, currency);

  const toggleScope = (id: string, included: boolean) =>
    onChange({
      excluded: included
        ? pricing.excluded.filter((item) => item !== id)
        : [...pricing.excluded, id],
    });

  const setExclusion = (index: number, value: string) =>
    onChange({ exclusions: pricing.exclusions.map((line, at) => (at === index ? value : line)) });

  return (
    <div className={styles.desk} data-testid="deal-desk">
      {/* 1. What they asked for. Scope answers it, and taking scope out can leave it unanswered. */}
      <section className={styles.dealArea} aria-labelledby="deal-requirements">
        <h3 id="deal-requirements" className={styles.deskTitle}>
          What they asked for
        </h3>
        <ul className={styles.requirements}>
          {config.requirements.map((requirement) => {
            const answered = !unanswered.some((row) => row.id === requirement.id);
            return (
              <li
                key={requirement.id}
                className={styles.requirement}
                data-answered={answered}
                data-testid={`requirement-${requirement.id}`}
              >
                <span className={styles.requirementNeed}>{requirement.need}</span>
                <span className={answered ? styles.requirementState : styles.problemNote}>
                  {answered ? 'The deal answers this.' : 'Nothing left in the deal answers this.'}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 2. Scope. Removing a line says what it leaves the client with, never what it saves. */}
      <section className={styles.dealArea} aria-labelledby="deal-scope">
        <h3 id="deal-scope" className={styles.deskTitle}>
          What is in the deal
        </h3>
        <p className={styles.deskNote} data-testid="scope-count">
          {kept.length} of {config.scope.length} lines in. Prices per line are not shown: you are
          deciding what the client gets, and what that is worth is your call afterwards.
        </p>
        <fieldset className={styles.scope} disabled={disabled}>
          <legend className={styles.legend}>Lines you can take out</legend>
          {config.scope.map((item) => (
            <PricingScopeItem
              key={item.id}
              name={item.name}
              description={item.description}
              priceImpact={null}
              currency={currency}
              included={kept.some((line) => line.id === item.id)}
              locked={item.locked}
              dependency={item.consequence}
              className={styles.scopeLine}
              onIncludedChange={(included) => toggleScope(item.id, included)}
            />
          ))}
        </fieldset>
        {dangling.length > 0 && (
          <p className={styles.problemNote} data-testid="scope-dangling">
            {dangling.map((item) => item.name).join(', ')}{' '}
            {dangling.length === 1 ? 'needs' : 'need'} something you have taken out. Put it back, or
            take {dangling.length === 1 ? 'this line' : 'these lines'} out too.
          </p>
        )}
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Rounds of revisions included</span>
          <input
            className={styles.input}
            type="number"
            min={0}
            max={20}
            step={1}
            inputMode="numeric"
            value={pricing.revisions ?? ''}
            disabled={disabled}
            data-testid="deal-revisions"
            onChange={(event) => onChange({ revisions: count(event.target.value) })}
          />
        </label>
      </section>

      {/* 3. The price. Two numbers the learner sets, and the one they add up to. */}
      <section className={styles.dealArea} aria-labelledby="deal-price">
        <h3 id="deal-price" className={styles.deskTitle}>
          The price
        </h3>
        <div className={styles.dealFields}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Project fee</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={pricing.project ?? ''}
              disabled={disabled}
              data-testid="deal-project"
              onChange={(event) => onChange({ project: parseMoney(event.target.value) })}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Rush fee</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={pricing.rush_fee ?? ''}
              disabled={disabled}
              aria-describedby="deal-rush-help"
              data-testid="deal-rush-fee"
              onChange={(event) => onChange({ rush_fee: parseMoney(event.target.value) })}
            />
            <span id="deal-rush-help" className={styles.help}>
              {rushed
                ? `Under ${config.timeline.rush_below_days} days is rush work. Charge for it or absorb it, but decide.`
                : `Nothing is being rushed at ${config.timeline.standard_days} days. Zero is an answer.`}
            </span>
          </label>
        </div>
        <dl className={styles.totals} data-testid="deal-total">
          <dt>One-time total</dt>
          <dd className={styles.totalValue}>{money(quote.total)}</dd>
        </dl>
      </section>

      {/* 4. Payment. One deposit, expressed either way, and what each side of it comes to. */}
      <section className={styles.dealArea} aria-labelledby="deal-payment">
        <h3 id="deal-payment" className={styles.deskTitle}>
          How it is paid
        </h3>
        <fieldset className={styles.choices} disabled={disabled}>
          <legend className={styles.legend}>Deposit</legend>
          <label className={styles.choice}>
            <input
              type="radio"
              name="deposit-kind"
              value="percent"
              checked={pricing.deposit?.kind === 'percent'}
              data-testid="deposit-kind-percent"
              onChange={() =>
                onChange({ deposit: { kind: 'percent', value: pricing.deposit?.value ?? 0 } })
              }
            />
            <span className={styles.choiceBody}>
              <span className={styles.choiceName}>A percentage of the total</span>
            </span>
          </label>
          <label className={styles.choice}>
            <input
              type="radio"
              name="deposit-kind"
              value="amount"
              checked={pricing.deposit?.kind === 'amount'}
              data-testid="deposit-kind-amount"
              onChange={() =>
                onChange({ deposit: { kind: 'amount', value: pricing.deposit?.value ?? 0 } })
              }
            />
            <span className={styles.choiceBody}>
              <span className={styles.choiceName}>A fixed amount</span>
            </span>
          </label>
        </fieldset>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            {pricing.deposit?.kind === 'amount' ? 'Deposit amount' : 'Deposit percentage'}
          </span>
          <input
            className={styles.input}
            type="number"
            min={0}
            max={pricing.deposit?.kind === 'amount' ? undefined : 100}
            step={1}
            inputMode="numeric"
            value={pricing.deposit?.value ?? ''}
            disabled={disabled || pricing.deposit === null}
            aria-describedby="deal-deposit-help"
            data-testid="deposit-value"
            onChange={(event) => {
              const kind = pricing.deposit?.kind;
              // A percentage is a count, a fixed deposit is money. Both are read by the same
              // parsers the grader's arithmetic uses, so nothing is parsed twice differently.
              const value =
                kind === 'amount' ? parseMoney(event.target.value) : count(event.target.value);
              onChange({ deposit: kind === undefined || value === null ? null : { kind, value } });
            }}
          />
          <span id="deal-deposit-help" className={styles.help}>
            {pricing.deposit === null
              ? 'Choose how you are asking for it first.'
              : 'What you are asking for before the work starts.'}
          </span>
        </label>
        <dl className={styles.totals}>
          <dt>Due on signature</dt>
          <dd data-testid="deal-due-now">{money(quote.due_now)}</dd>
          <dt>Left on delivery</dt>
          <dd data-testid="deal-on-delivery">{money(quote.on_delivery)}</dd>
        </dl>
      </section>

      {/* 5. Timeline. The number that decides whether a rush fee is honest. */}
      <section className={styles.dealArea} aria-labelledby="deal-timeline">
        <h3 id="deal-timeline" className={styles.deskTitle}>
          How long it takes
        </h3>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Delivery, in working days</span>
          <input
            className={styles.input}
            type="number"
            min={1}
            max={365}
            step={1}
            inputMode="numeric"
            value={pricing.timeline_days ?? ''}
            disabled={disabled}
            aria-describedby="deal-timeline-help"
            data-testid="deal-timeline"
            onChange={(event) => onChange({ timeline_days: count(event.target.value) })}
          />
          <span id="deal-timeline-help" className={styles.help}>
            Work like this normally takes {config.timeline.standard_days} days.
          </span>
        </label>
        {rushed && (
          <p className={styles.problemNote} data-testid="deal-rushed">
            You have promised it in {pricing.timeline_days} days. That is rush work.
          </p>
        )}
      </section>

      {/* 6. Recurring. Kept apart from the build on purpose. */}
      <section className={styles.dealArea} aria-labelledby="deal-recurring">
        <h3 id="deal-recurring" className={styles.deskTitle}>
          What recurs
        </h3>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Monthly fee</span>
          <input
            className={styles.input}
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={pricing.recurring ?? ''}
            disabled={disabled}
            aria-describedby="deal-recurring-help"
            data-testid="deal-recurring"
            onChange={(event) => onChange({ recurring: parseMoney(event.target.value) })}
          />
          <span id="deal-recurring-help" className={styles.help}>
            What they pay every month after handover. Zero is an answer.
          </span>
        </label>
        <dl className={styles.totals}>
          <dt>Over a year</dt>
          <dd data-testid="deal-recurring-annual">{money(quote.recurring_annual)}</dd>
        </dl>
      </section>

      {/* 7. Exclusions. Written by the learner, because the ones that matter are never generic. */}
      <section className={styles.dealArea} aria-labelledby="deal-exclusions">
        <h3 id="deal-exclusions" className={styles.deskTitle}>
          What is not included
        </h3>
        <p className={styles.deskNote}>
          The things they might reasonably assume are in this and are not. Write them the way you
          would want to read them back to a client in week three.
        </p>
        <div className={styles.exclusions}>
          {pricing.exclusions.map((line, index) => (
            <div key={index} className={styles.exclusion}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Not included {index + 1}</span>
                <input
                  className={styles.input}
                  type="text"
                  value={line}
                  disabled={disabled}
                  data-testid={`exclusion-${index}`}
                  onChange={(event) => setExclusion(index, event.target.value)}
                />
              </label>
              <button
                type="button"
                className={styles.quietButton}
                disabled={disabled}
                data-testid={`exclusion-remove-${index}`}
                onClick={() =>
                  onChange({ exclusions: pricing.exclusions.filter((_, at) => at !== index) })
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className={styles.addButton}
          disabled={disabled}
          data-testid="exclusion-add"
          onClick={() => onChange({ exclusions: [...pricing.exclusions, ''] })}
        >
          Add an exclusion
        </button>
      </section>
    </div>
  );
}
