import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SyncStatusIndicator } from './SyncStatusIndicator';

describe('SyncStatusIndicator', () => {
  it('announces the saved-locally state as text in a polite live region (A11Y-005)', () => {
    render(<SyncStatusIndicator />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('Saved on this device');
  });
});
