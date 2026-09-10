import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  listScenarioAttachments: vi.fn(),
  uploadScenarioAttachment: vi.fn(),
  downloadScenarioAttachment: vi.fn(),
  deleteScenarioAttachment: vi.fn(),
}));
vi.mock('./attachments', () => api);

import { ScenarioAttachments } from './ScenarioAttachments';

const asset = {
  attachment_id: '00000000-0000-4000-8000-000000000001',
  scenario_id: 'SC-test',
  name: 'brief.pdf',
  mime_type: 'application/pdf' as const,
  byte_length: 1500,
  checksum: 'a'.repeat(64),
  status: 'ready' as const,
  created_at: '2026-09-10T12:00:00.000Z',
  updated_at: '2026-09-10T12:00:00.000Z',
  deleted_at: null,
};

beforeEach(() => {
  cleanup();
  vi.resetAllMocks();
  api.listScenarioAttachments.mockResolvedValue([]);
  api.uploadScenarioAttachment.mockResolvedValue(asset);
  api.downloadScenarioAttachment.mockResolvedValue(undefined);
  api.deleteScenarioAttachment.mockResolvedValue(undefined);
});

describe('DATA-006 scenario case files', () => {
  it('loads, uploads, downloads and deletes through explicit accessible controls', async () => {
    render(<ScenarioAttachments scenarioId="SC-test" />);
    fireEvent.click(screen.getByRole('button', { name: 'Load case files' }));
    expect(await screen.findByLabelText('Add a case file')).toBeInTheDocument();
    const file = new File(['%PDF-1.4'], 'brief.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Add a case file'), { target: { files: [file] } });
    expect(await screen.findByText(/brief\.pdf · 2 KB/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(api.downloadScenarioAttachment).toHaveBeenCalledWith(asset));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(api.deleteScenarioAttachment).toHaveBeenCalledWith(asset.attachment_id),
    );
    expect(screen.queryByText(/brief\.pdf ·/)).toBeNull();
  });

  it('keeps the file surface usable after a storage error', async () => {
    api.listScenarioAttachments.mockRejectedValueOnce(
      new Error('Private storage unavailable. Retry.'),
    );
    render(<ScenarioAttachments scenarioId="SC-test" />);
    fireEvent.click(screen.getByRole('button', { name: 'Load case files' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Retry');
    expect(screen.getByRole('button', { name: 'Load case files' })).toBeEnabled();
  });
});
