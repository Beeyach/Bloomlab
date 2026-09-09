import { SequencePlan } from './SequencePlan';
import { ReviewChecklist } from './ReviewChecklist';
import { NegotiationThread } from './NegotiationThread';
import { useMemo, useState } from 'react';

import type { Exercise } from '@bloomlab/content-schema';

import { randomId } from '../../data/envelope';
import { saveResponse, type ActiveAttempt, type AttemptContext } from '../attempt';
import type { PricingResponse } from '../pricing';
import { predictionFields, pricingOf, salesOf, writtenOf, type LearnerResponse } from '../response';
import { treatmentFor } from '../runnerCopy';
import type { SalesResponse } from '../sales';
import { AuditDesk } from './AuditDesk';
import { ClientThread } from './ClientThread';
import { DealDesk } from './DealDesk';
import { ProspectDesk } from './ProspectDesk';
import { WrittenAnswer } from './WrittenAnswer';
import styles from './work.module.css';
import runner from '../ExerciseRunner.module.css';

/**
 * The work area (spec §27, EXR-001).
 *
 * One surface for every family, composed from what the exercise authored: an architecture choice,
 * predictions, businesses to judge, findings to write, named pieces of writing, a client thread.
 * It branches on the exercise's **content**, never on its id, so a new sales exercise is a file
 * rather than a component.
 *
 * Every keystroke is saved to the attempt in the local workspace, which is why a reload resumes
 * the same half-written audit rather than an empty one.
 */
export function WorkSurface({
  exercise,
  attempt,
  context,
  disabled,
}: {
  exercise: Exercise;
  attempt: ActiveAttempt;
  context: AttemptContext;
  disabled: boolean;
}) {
  const treatment = treatmentFor(exercise);
  const fields = useMemo(() => predictionFields(exercise), [exercise]);
  // Keyed on the attempt id by the caller, so starting again remounts with empty work.
  const [draft, setDraft] = useState(attempt.response);

  const update = (change: Partial<LearnerResponse>) => {
    setDraft((current) => ({ ...current, ...change }));
    void saveResponse(exercise.id, context, change);
  };
  const sales = salesOf(draft);
  const updateSales = (change: Partial<SalesResponse>) =>
    update({ sales: { ...sales, ...change } });

  const pricing = pricingOf(draft);
  const updatePricing = (change: Partial<PricingResponse>) =>
    update({ pricing: { ...pricing, ...change } });

  const evidenceFor = (key: string) => sales.citations[key] ?? [];
  const toggleCitation = (key: string, id: string) => {
    const current = evidenceFor(key);
    updateSales({
      citations: {
        ...sales.citations,
        [key]: current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
      },
    });
  };

  return (
    <section aria-labelledby="work-title" className={runner.work}>
      <h2 id="work-title" className={runner.sectionTitle}>
        {treatment.workTitle}
      </h2>

      {exercise.sequence_steps.length > 0 && (
        <SequencePlan
          steps={exercise.sequence_steps}
          value={draft.sequence}
          disabled={disabled}
          onChange={(sequence) => update({ sequence })}
        />
      )}
      {exercise.review_checks.length > 0 && (
        <ReviewChecklist
          checks={exercise.review_checks}
          value={draft.review}
          disabled={disabled}
          onChange={(review) => update({ review })}
        />
      )}
      {exercise.decision_options.length > 0 && (
        <fieldset className={runner.options} disabled={disabled}>
          <legend className={runner.optionsLegend}>Where it lives</legend>
          {exercise.decision_options.map((option) => (
            <label key={option.value} className={runner.option}>
              <input
                type="radio"
                name="decision-choice"
                value={option.value}
                checked={draft.choice === option.value}
                onChange={() => update({ choice: option.value })}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      )}

      {fields.length > 0 && (
        <div className={runner.predictions}>
          {fields.map((field) => (
            <label key={field.key} className={runner.field}>
              <span className={runner.fieldLabel}>{field.label}</span>
              <input
                type="text"
                value={draft.prediction[field.key] ?? ''}
                disabled={disabled}
                onChange={(event) =>
                  update({ prediction: { ...draft.prediction, [field.key]: event.target.value } })
                }
              />
            </label>
          ))}
        </div>
      )}

      {exercise.prospects.length > 0 && (
        <ProspectDesk
          exercise={exercise}
          sales={sales}
          disabled={disabled}
          onChange={(prospects) => updateSales({ prospects })}
        />
      )}

      {exercise.pricing && (
        <DealDesk
          exercise={exercise}
          pricing={pricing}
          disabled={disabled}
          onChange={updatePricing}
        />
      )}

      {exercise.type === 'AUDIT_IT' && (
        <AuditDesk
          exercise={exercise}
          sales={sales}
          disabled={disabled}
          mintId={randomId}
          onChange={(findings) => updateSales({ findings })}
        />
      )}

      {/*
        Named long-form answers (EXR-010). Each is its own saved field, because for some work the
        difference between two answers is the whole point: what you observed is not what you think
        explains it, and the owner version is not the builder version. Nothing is prefilled and
        nothing is suggested.
      */}
      {exercise.written_fields.map((field) => (
        <WrittenAnswer
          key={field.key}
          field={field}
          value={writtenOf(draft)[field.key] ?? ''}
          disabled={disabled}
          evidence={exercise.sales.evidence}
          nextStep={sales.next_steps[field.key] ?? ''}
          citations={evidenceFor(field.key)}
          onChange={(value) => update({ written: { ...writtenOf(draft), [field.key]: value } })}
          onNextStep={(value) =>
            updateSales({ next_steps: { ...sales.next_steps, [field.key]: value } })
          }
          onToggleCitation={(id) => toggleCitation(field.key, id)}
        />
      ))}

      {exercise.negotiation && (
        <NegotiationThread
          exercise={exercise}
          saved={attempt.response.negotiation}
          context={context}
          disabled={disabled}
        />
      )}

      {exercise.conversation && (
        <ClientThread
          exercise={exercise}
          sales={sales}
          disabled={disabled}
          onSend={(turns) => updateSales({ turns })}
        />
      )}

      {treatment.freeResponse && (
        <>
          <label className={runner.field}>
            <span className={runner.fieldLabel}>{treatment.responseLabel}</span>
            <textarea
              className={runner.response}
              rows={7}
              value={draft.text}
              disabled={disabled}
              aria-describedby="response-help"
              onChange={(event) => update({ text: event.target.value })}
            />
          </label>
          <p id="response-help" className={styles.help}>
            {treatment.responseHelp}
          </p>
        </>
      )}
    </section>
  );
}
