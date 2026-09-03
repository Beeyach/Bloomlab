import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { SyncStatusIndicator } from './SyncStatusIndicator';

describe('SyncStatusIndicator', () => {
  it('announces the saved-locally state as text in a polite live region and links to sync', () => {
    render(
      <MemoryRouter>
        <SyncStatusIndicator />
      </MemoryRouter>,
    );
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('Saved on this device');
    expect(screen.getByRole('link', { name: /open sync settings/i })).toHaveAttribute(
      'href',
      '/sync',
    );
  });
});
