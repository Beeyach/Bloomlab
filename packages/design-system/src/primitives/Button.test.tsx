import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { IconCheck } from '../icons';
import { Button } from './Button';
import { IconButton } from './IconButton';

describe('Button', () => {
  it('is a type="button" by default so it never submits forms accidentally', () => {
    render(<Button>Run it</Button>);
    expect(screen.getByRole('button', { name: 'Run it' })).toHaveAttribute('type', 'button');
  });

  it('fires onClick with mouse and keyboard', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Run it</Button>);
    const button = screen.getByRole('button', { name: 'Run it' });
    await userEvent.click(button);
    button.focus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('announces busy state and ignores clicks while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Saving' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps decorative icons out of the accessible name', () => {
    render(<Button icon={<IconCheck />}>Passed</Button>);
    expect(screen.getByRole('button', { name: 'Passed' })).toBeInTheDocument();
  });
});

describe('IconButton', () => {
  it('always has an accessible name (A11Y-003)', () => {
    render(<IconButton label="Close" icon={<IconCheck />} />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('exposes toggle state through aria-pressed', () => {
    render(<IconButton label="Mute" icon={<IconCheck />} pressed />);
    expect(screen.getByRole('button', { name: 'Mute' })).toHaveAttribute('aria-pressed', 'true');
  });
});
