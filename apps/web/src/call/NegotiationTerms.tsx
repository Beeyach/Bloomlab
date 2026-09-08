import type { Exercise } from '@bloomlab/content-schema';
import type { CallNegotiationInput, CallSnapshot } from '@bloomlab/shared';
import { emptyNegotiationAction } from '@bloomlab/exercise-engine/negotiation/engine';

/** Spoken turns use the same explicit deal protocol as written negotiation. Prose never changes money. */
export function NegotiationTerms({
  exercise,
  snapshot,
  value,
  onChange,
  disabled,
}: {
  exercise: Exercise;
  snapshot: CallSnapshot;
  value?: CallNegotiationInput;
  onChange: (value: CallNegotiationInput) => void;
  disabled: boolean;
}) {
  const config = exercise.negotiation;
  if (!config) return null;
  const draft = value ?? {
    ...emptyNegotiationAction(),
    excluded: snapshot.agreement?.excluded ?? [],
  };
  const node = config.nodes.find((n) => n.id === snapshot.agreement?.node);
  const change = (patch: Partial<CallNegotiationInput>) => {
    const { text: _text, ...base } = { ...emptyNegotiationAction(), ...draft };
    onChange({ ...base, ...patch });
  };
  const amount = (key: 'project' | 'phase_two_project' | 'timeline_days', label: string) => (
    <label>
      {label}
      <input
        type="number"
        min="0"
        max="1000000"
        step="1"
        inputMode="numeric"
        value={draft[key] ?? ''}
        onChange={(event) =>
          change({ [key]: event.target.value ? Number(event.target.value) : null })
        }
      />
    </label>
  );
  const concession = config.concessions.find((c) => c.id === draft.concession);
  return (
    <fieldset disabled={disabled}>
      <legend>Terms offered in this turn</legend>
      <label>
        My intended move
        <select
          value={draft.action ?? ''}
          onChange={(e) =>
            change({ action: (e.target.value || null) as CallNegotiationInput['action'] })
          }
        >
          <option value="">Interpret my spoken intent</option>
          <option value="clarify">Clarify</option>
          <option value="hold_price">Hold price</option>
          <option value="reduce_scope">Reduce scope</option>
          <option value="phase">Phase the project</option>
          <option value="concession">Offer a concession</option>
          <option value="walk_away">Walk away</option>
        </select>
      </label>
      <label>
        How I am responding
        <select
          value={draft.approach}
          onChange={(e) => change({ approach: e.target.value as CallNegotiationInput['approach'] })}
        >
          <option value="address">Address this objection</option>
          <option value="pitch">Pitch the solution again</option>
          <option value="ignore">Move past the objection</option>
          <option value="defensive">Challenge the client’s judgment</option>
        </select>
      </label>
      {draft.action === 'clarify' && (
        <label>
          What I want to establish
          <select
            value={draft.diagnosis ?? ''}
            onChange={(e) => change({ diagnosis: e.target.value || null })}
          >
            <option value="">Choose the distinction</option>
            {node?.diagnosis.map((d) => (
              <option value={d.id} key={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {draft.action === 'reduce_scope' && (
        <>
          <p>Remove named work and state the new fee.</p>
          {config.pricing.scope.map((scope) => (
            <label key={scope.id}>
              <input
                type="checkbox"
                disabled={scope.locked}
                checked={draft.excluded.includes(scope.id)}
                onChange={() =>
                  change({
                    excluded: draft.excluded.includes(scope.id)
                      ? draft.excluded.filter((id) => id !== scope.id)
                      : [...draft.excluded, scope.id],
                  })
                }
              />
              {scope.name}
              {scope.locked ? ' (required)' : ''}
              {draft.excluded.includes(scope.id) && <small>{scope.consequence}</small>}
            </label>
          ))}
          {amount('project', 'New project fee (USD)')}
        </>
      )}
      {draft.action === 'phase' && (
        <>
          <label>
            Delivery stages
            <select
              value={draft.phase ?? ''}
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
          <p>{config.phases.find((p) => p.id === draft.phase)?.consequence}</p>
          {amount('project', 'Phase 1 fee (USD)')}
          {amount('phase_two_project', 'Phase 2 fee (USD)')}
          {amount('timeline_days', 'Phase 1 days (blank keeps current terms)')}
        </>
      )}
      {draft.action === 'concession' && (
        <>
          <label>
            Concession and reciprocal trade
            <select
              value={draft.concession ?? ''}
              onChange={(e) => change({ concession: e.target.value || null })}
            >
              <option value="">Choose the terms</option>
              {config.concessions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <p>
            {concession?.consequence} {concession?.trade?.label}
          </p>
          {concession?.kind === 'discount' && amount('project', 'Fee for retained work (USD)')}
        </>
      )}
    </fieldset>
  );
}
