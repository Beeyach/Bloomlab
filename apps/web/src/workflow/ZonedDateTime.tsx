import { useState } from 'react';
import { Field, Input } from '@bloomlab/design-system';
import { wallFields, wallTimeInstant } from './wallTime';
import styles from './workflow.module.css';

export function ZonedDateTime({
  label,
  value,
  zone,
  onChange,
}: {
  label: string;
  value: string;
  zone: string;
  onChange: (value: string) => void;
}) {
  const [editing, setEditing] = useState({
    value,
    zone,
    ...wallFields(value, zone),
    invalid: false,
  });
  const fields =
    editing.value === value && editing.zone === zone
      ? editing
      : { value, zone, ...wallFields(value, zone), invalid: false };
  const change = (patch: Partial<{ date: string; time: string }>) => {
    const next = { ...fields, ...patch };
    const instant = wallTimeInstant(next.date, next.time, zone, value);
    setEditing({
      ...next,
      value: instant ?? '',
      invalid: Boolean(next.date && next.time && !instant),
    });
    onChange(instant ?? '');
  };
  return (
    <div className={styles.dateTime}>
      <Field label={`${label} date`}>
        <Input
          type="date"
          value={fields.date}
          onChange={(event) => change({ date: event.target.value })}
        />
      </Field>
      <Field label={`${label} time`}>
        <Input
          type="time"
          step={1}
          value={fields.time}
          onChange={(event) => change({ time: event.target.value })}
        />
      </Field>
      <span className={styles.muted}>{zone}</span>
      {fields.invalid && (
        <p role="alert" className={styles.muted}>
          That time does not occur in this time zone. Choose another time.
        </p>
      )}
    </div>
  );
}
