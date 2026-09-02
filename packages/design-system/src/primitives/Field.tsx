import {
  createContext,
  useContext,
  useId,
  type ComponentPropsWithRef,
  type ReactNode,
} from 'react';

import { IconAlert } from '../icons';
import { cx } from '../utils/cx';
import styles from './Field.module.css';

interface FieldContextValue {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

function useField(): FieldContextValue {
  const value = useContext(FieldContext);
  if (!value) throw new Error('Input, Select and Textarea must be used inside <Field>');
  return value;
}

export interface FieldProps {
  label: string;
  /** Helper text shown under the control and read as its description. */
  hint?: string;
  /** Validation message; sets `aria-invalid` and is read as part of the description. */
  error?: string;
  required?: boolean;
  /** Override the generated id (useful for tests or external labels). */
  id?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Accessible form field: label, control, hint and error are wired with ids so assistive
 * technology reads them together (A11Y-003). Put exactly one Input/Select/Textarea inside.
 */
export function Field({
  label,
  hint,
  error,
  required = false,
  id,
  className,
  children,
}: FieldProps) {
  const generatedId = useId();
  const controlId = id ?? `field-${generatedId}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cx(styles.field, className)}>
      <label className={styles.label} htmlFor={controlId}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            (required)
          </span>
        )}
      </label>
      <FieldContext.Provider
        value={{ id: controlId, describedBy, invalid: Boolean(error), required }}
      >
        {children}
      </FieldContext.Provider>
      {error && (
        <p className={styles.error} id={errorId} role="alert">
          <IconAlert size={16} className={styles.errorIcon} />
          <span>{error}</span>
        </p>
      )}
      {hint && (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}

function controlProps(field: FieldContextValue) {
  return {
    id: field.id,
    'aria-describedby': field.describedBy,
    'aria-invalid': field.invalid || undefined,
    'aria-required': field.required || undefined,
    required: field.required || undefined,
  };
}

export function Input({ className, ...rest }: ComponentPropsWithRef<'input'>) {
  const field = useField();
  return <input className={cx(styles.control, className)} {...controlProps(field)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentPropsWithRef<'textarea'>) {
  const field = useField();
  return <textarea className={cx(styles.control, className)} {...controlProps(field)} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentPropsWithRef<'select'>) {
  const field = useField();
  return (
    <select className={cx(styles.control, className)} {...controlProps(field)} {...rest}>
      {children}
    </select>
  );
}
