import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Meta } from './Meta';

describe('metadata layout', () => {
  it('renders chip, text and badge facts without separator characters', () => {
    render(
      <Meta
        aria-label="Lesson details"
        items={[
          { kind: 'chip', label: 'Academy' },
          { kind: 'text', label: '18 min' },
          { kind: 'badge', label: 'No hints' },
        ]}
      />,
    );
    const metadata = screen.getByLabelText('Lesson details');
    expect(metadata).toHaveTextContent('Academy 18 min No hints');
    expect(metadata.textContent).not.toMatch(/[·|•]/);
    expect(metadata.children).toHaveLength(3);
  });
  it('uses decorative arrow icons between ordered flow facts', () => {
    const { container } = render(
      <Meta
        variant="flow"
        items={[
          { kind: 'text', label: '64 booked' },
          { kind: 'text', label: '37 showed' },
          { kind: 'text', label: '13 bought' },
        ]}
      />,
    );
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2);
    expect(container.textContent).not.toMatch(/[·|•]/);
  });
  it('keeps separate facts readable in a heading accessible name', () => {
    render(
      <h2>
        <Meta
          items={[
            { kind: 'chip', label: 'Gate 1' },
            { kind: 'text', label: 'Funnel Thinking' },
          ]}
        />
      </h2>,
    );
    expect(screen.getByRole('heading', { name: 'Gate 1 Funnel Thinking' })).toBeInTheDocument();
  });
});

it('uses the singular capability label for a one-capability territory', async () => {
  const { HoloTerritory } = await import('./HoloTerritory');
  render(<HoloTerritory territory="BUILD" scope="Build pages" demonstrated={0} total={1} />);
  expect(screen.getByText('0 of 1 capability demonstrated')).toBeInTheDocument();
});
