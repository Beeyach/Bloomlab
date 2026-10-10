import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ContentTitle } from './ContentTitle';

describe('ContentTitle', () => {
  it('keeps an ordinary authored title unchanged', () => {
    render(
      <h1>
        <ContentTitle title="Build the next step" />
      </h1>,
    );
    expect(screen.getByRole('heading')).toHaveTextContent('Build the next step');
    expect(screen.getByRole('heading').children).toHaveLength(0);
  });
  it.each([' · ', ' | ', ' • '])(
    'separates title facts written with %s without changing the heading name',
    (separator) => {
      const title = ['Placement', 'fields and shared values'].join(separator);
      render(
        <h1>
          <ContentTitle title={title} />
        </h1>,
      );
      expect(
        screen.getByRole('heading', { name: 'Placement fields and shared values' }),
      ).toBeInTheDocument();
      expect(screen.getByText('Placement')).toBeInTheDocument();
      expect(screen.getByText('fields and shared values')).toBeInTheDocument();
      expect(screen.getByRole('heading').textContent).not.toContain(separator.trim());
      expect(title).toBe(['Placement', 'fields and shared values'].join(separator));
    },
  );
});
