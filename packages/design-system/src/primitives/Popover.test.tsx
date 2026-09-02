import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Button } from './Button';
import { Popover } from './Popover';

function Example() {
  return (
    <>
      <Popover label="Filters" trigger={(props) => <Button {...props}>Filters</Button>}>
        <p>Only booked contacts</p>
      </Popover>
      <button type="button">Elsewhere</button>
    </>
  );
}

describe('Popover', () => {
  it('toggles from the trigger and exposes expanded state', async () => {
    render(<Example />);
    const trigger = screen.getByRole('button', { name: 'Filters' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Filters' })).toHaveTextContent(
      'Only booked contacts',
    );
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(trigger);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    render(<Example />);
    const trigger = screen.getByRole('button', { name: 'Filters' });
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes on an outside pointer press', async () => {
    render(<Example />);
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
