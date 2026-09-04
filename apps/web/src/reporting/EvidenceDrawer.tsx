import { useMemo } from 'react';

import { Sheet } from '@bloomlab/design-system';
import type { MetricValue, SimulatorEvent, SimulatorState } from '@bloomlab/simulator-core';
import { contentEventName } from '@bloomlab/simulator-core';

import { basisWords, reading, workings } from './words';
import styles from './reporting.module.css';

/**
 * What one number is made of (REP-001, §17).
 *
 * A metric carries the ids of the events and records it was counted from, so this opens them: the
 * event log lines with their instants, and the account records they wrote. Nothing is
 * paraphrased and nothing is summarised into a friendlier shape — a learner who disagrees with a
 * figure settles it here against the run's own history.
 *
 * The same drawer on every width. On a phone it is a sheet from the bottom rather than a panel at
 * the side, which is a recomposition; the evidence itself is not reduced (§43).
 */

export function EvidenceDrawer({
  state,
  metric,
  onClose,
}: {
  state: SimulatorState;
  metric: MetricValue | null;
  onClose: () => void;
}) {
  const events = useMemo<SimulatorEvent[]>(() => {
    if (!metric) return [];
    const wanted = new Set(metric.evidence_event_ids);
    return state.log.filter((event) => wanted.has(event.id));
  }, [state, metric]);

  if (!metric) return null;
  const detail = workings(metric);

  return (
    <Sheet open onClose={onClose} title={metric.label} side="end" className={styles.sheet}>
      <div className={styles.drawer} data-testid="evidence-drawer">
        <p className={styles.drawerReading} data-testid="evidence-reading">
          {reading(metric)}
        </p>
        {detail && <p className={styles.workingsLine}>{detail}</p>}
        <p className={styles.metricBasis}>{basisWords(metric)}</p>

        <h3 className={styles.drawerHeading}>How it is worked out</h3>
        <p>{metric.definition}</p>
        {metric.denominator_note && <p className={styles.muted}>{metric.denominator_note}</p>}

        {events.length > 0 && (
          <>
            <h3 className={styles.drawerHeading}>
              {events.length} {events.length === 1 ? 'event' : 'events'} it was counted from
            </h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">What happened</th>
                    <th scope="col">Who</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td>{event.at}</td>
                      <td>{contentEventName(event.type)}</td>
                      <td>{String(event.payload.contact_id ?? event.payload.payment_id ?? '—')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {metric.evidence_record_ids.length > 0 && (
          <>
            <h3 className={styles.drawerHeading}>
              {metric.evidence_record_ids.length}{' '}
              {metric.evidence_record_ids.length === 1 ? 'record' : 'records'} behind it
            </h3>
            <ul className={styles.recordList} data-testid="evidence-records">
              {metric.evidence_record_ids.map((id) => (
                <li key={id}>{describe(state, id)}</li>
              ))}
            </ul>
          </>
        )}

        {events.length === 0 && metric.evidence_record_ids.length === 0 && (
          <p className={styles.muted}>
            This one is a sum of the account as it stands rather than a count of things that
            happened, so there is no event list behind it.
          </p>
        )}
      </div>
    </Sheet>
  );
}

/** One record id, said in words the account can actually back up. */
function describe(state: SimulatorState, id: string): string {
  const account = state.account;
  const contact = account.contacts[id];
  if (contact) return `${contact.first_name} ${contact.last_name ?? ''} · contact ${id}`.trim();
  const appointment = account.appointments[id];
  if (appointment) {
    return `Appointment ${id} · ${appointment.starts_at} · ${appointment.status}`;
  }
  const opportunity = account.opportunities[id];
  if (opportunity) {
    return `${opportunity.name} · ${opportunity.status} · ${opportunity.value}`;
  }
  const payment = account.payments[id];
  if (payment) return `Payment ${id} · ${payment.amount} · ${payment.status}`;
  const visit = account.funnel_visits[id];
  if (visit) {
    return `Visit ${id} · ${visit.source} · ${visit.contact_id ? 'became a lead' : 'left'}`;
  }
  const message = Object.values(account.conversations)
    .flatMap((conversation) => conversation.messages)
    .find((row) => row.id === id);
  if (message) return `${message.direction} ${message.channel} · ${message.at}`;
  return id;
}
