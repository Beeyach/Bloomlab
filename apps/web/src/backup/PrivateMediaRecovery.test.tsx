import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  exportPrivateMedia: vi.fn(),
  previewPrivateMedia: vi.fn(),
  confirmPrivateMedia: vi.fn(),
  cancelPrivateMedia: vi.fn(),
}));
vi.mock('../data/privateMediaRecovery', () => api);

import { PrivateMediaRecovery } from './PrivateMediaRecovery';

const preview = {
  stage_id: '00000000-0000-4000-8000-000000000001',
  backup_id: '00000000-0000-4000-8000-000000000002',
  expires_at: '2026-09-11T12:00:00.000Z',
  counts: { add: 1, repair: 1, keep: 2, deleted: 1 },
  assets: [
    {
      kind: 'scenario_attachment' as const,
      id: '00000000-0000-4000-8000-000000000003',
      action: 'add' as const,
      reason: 'private bytes missing',
    },
  ],
};

beforeEach(() => {
  cleanup();
  vi.resetAllMocks();
  api.exportPrivateMedia.mockResolvedValue(undefined);
  api.previewPrivateMedia.mockResolvedValue(preview);
  api.confirmPrivateMedia.mockResolvedValue(undefined);
  api.cancelPrivateMedia.mockResolvedValue(undefined);
});

describe('DATA-006 private-media recovery UI', () => {
  it('exports and stages an archive before explicit confirmation', async () => {
    render(<PrivateMediaRecovery />);
    fireEvent.click(screen.getByRole('button', { name: 'Export Private Media' }));
    expect(await screen.findByRole('status')).toHaveTextContent('archive prepared');
    const file = new File(['binary'], 'media.blb', {
      type: 'application/vnd.bloomlab.recovery-v1',
    });
    fireEvent.change(screen.getByLabelText('Choose private-media archive'), {
      target: { files: [file] },
    });
    const heading = await screen.findByRole('heading', { name: 'Review private-media restore' });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByText(/Add 1; repair 1; keep 2; deleted 1/)).toBeInTheDocument();
    expect(api.confirmPrivateMedia).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm media restore' }));
    await waitFor(() => expect(api.confirmPrivateMedia).toHaveBeenCalledWith(preview.stage_id));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('recovery completed'));
  });

  it('cancels a stage and exposes a retryable error', async () => {
    render(<PrivateMediaRecovery />);
    const input = screen.getByLabelText('Choose private-media archive');
    fireEvent.change(input, { target: { files: [new File(['binary'], 'media.blb')] } });
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel media restore' }));
    await waitFor(() => expect(api.cancelPrivateMedia).toHaveBeenCalledWith(preview.stage_id));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Review private-media restore' })).toBeNull(),
    );
    api.previewPrivateMedia.mockRejectedValueOnce(new Error('Checksum mismatch. Choose it again.'));
    fireEvent.change(input, { target: { files: [new File(['bad'], 'bad.blb')] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Checksum mismatch');
  });
});
