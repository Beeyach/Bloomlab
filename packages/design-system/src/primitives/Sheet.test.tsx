import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Sheet } from './Sheet';

describe('Sheet', () => {
  it('is hidden until opened and labelled by its title', () => {
    const { rerender } = render(
      <Sheet open={false} onClose={() => undefined} title="Configure step">
        Body
      </Sheet>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(
      <Sheet open onClose={() => undefined} title="Configure step">
        Body
      </Sheet>,
    );
    expect(screen.getByRole('dialog', { name: 'Configure step' })).toBeInTheDocument();
  });

  it('closes from the close button, Escape (cancel) and the backdrop', async () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Configure step">
        Body
      </Sheet>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    const dialog = screen.getByRole('dialog');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('does not close when clicking inside the content', () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Configure step">
        <p>Body</p>
      </Sheet>,
    );
    fireEvent.click(screen.getByText('Body'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
