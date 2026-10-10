import styles from './ProgressMeter.module.css';

export function ProgressMeter({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  return (
    <span className={styles.meter}>
      <span>{label}</span>
      <span
        className={styles.track}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={value}
      >
        <span
          className={styles.fill}
          style={{ width: `${total > 0 ? (value / total) * 100 : 0}%` }}
        />
      </span>
      <span>
        {value}/{total}
      </span>
    </span>
  );
}
