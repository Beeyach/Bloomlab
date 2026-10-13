import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { content } from '../content/bundle';
import { Markdown } from './markdown';

const exercises = [
  ['EX-BUILD_IT-advanced-scheduling', 'Calendar Lab', '/calendar'],
  ['EX-BUILD_IT-companies-objects', 'CRM', '/crm?area=companies'],
  ['EX-BUILD_IT-consultation-capacity', 'Calendar Lab', '/calendar'],
  ['EX-BUILD_IT-payment-lifecycle', 'Payments Lab', '/payments'],
  ['EX-BUILD_IT-smart-lists', 'CRM smart lists', '/crm?area=lists'],
];

describe('authored exercise Markdown links', () => {
  it.each(exercises)('renders the existing lab link in %s', (id, label, destination) => {
    const exercise = content.exercises.find((row) => row.id === id)!;
    render(
      <MemoryRouter>
        <Markdown text={exercise.instructions} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', destination);
    expect(document.body.textContent).not.toContain(`[${label}](${destination})`);
  });

  it('uses app navigation and preserves the authored query string', () => {
    function Location() {
      const location = useLocation();
      return <output>{location.pathname + location.search}</output>;
    }
    render(
      <MemoryRouter initialEntries={['/exercise/example']}>
        <Markdown text="Work in [CRM smart lists](/crm?area=lists)." />
        <Location />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'CRM smart lists' }));
    expect(screen.getByRole('status')).toHaveTextContent('/crm?area=lists');
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,hello',
    '//other.example',
    '/\\other.example',
    'https://other.example',
  ])('keeps unsupported or unsafe destination %s as text', (destination) => {
    const text = `[Open](${destination})`;
    render(<Markdown text={text} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(document.body).toHaveTextContent(text);
  });

  it('retains formatting, literal code and escaped HTML around links', () => {
    const { container } = render(
      <MemoryRouter>
        <Markdown
          text={
            '**Prepare** *carefully* `[Calendar](/calendar)` <img src=x onerror=alert(1)>\n\n- Open [Calendar Lab](/calendar).'
          }
        />
      </MemoryRouter>,
    );
    expect(container.querySelector('strong')).toHaveTextContent('Prepare');
    expect(container.querySelector('em')).toHaveTextContent('carefully');
    expect(container.querySelector('code')).toHaveTextContent('[Calendar](/calendar)');
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('listitem')).toContainElement(screen.getByRole('link'));
  });
});
