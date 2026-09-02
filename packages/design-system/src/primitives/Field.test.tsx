import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Field, Input, Select, Textarea } from './Field';

describe('Field', () => {
  it('associates the label with the control', () => {
    render(
      <Field label="Business name">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText('Business name')).toBeInstanceOf(HTMLInputElement);
  });

  it('describes the control with hint and error, and flags it invalid', () => {
    render(
      <Field label="Phone" hint="Include the country code." error="Phone is required.">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText('Phone');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Phone is required. Include the country code.');
    expect(screen.getByRole('alert')).toHaveTextContent('Phone is required.');
  });

  it('marks required controls for assistive technology', () => {
    render(
      <Field label="Email" required>
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText(/Email/)).toBeRequired();
  });

  it('wires Select and Textarea the same way', () => {
    render(
      <>
        <Field label="Pipeline">
          <Select>
            <option>Leads</option>
          </Select>
        </Field>
        <Field label="Notes">
          <Textarea />
        </Field>
      </>,
    );
    expect(screen.getByLabelText('Pipeline')).toBeInstanceOf(HTMLSelectElement);
    expect(screen.getByLabelText('Notes')).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('refuses controls outside a Field', () => {
    expect(() => render(<Input />)).toThrow(/inside <Field>/);
  });
});
