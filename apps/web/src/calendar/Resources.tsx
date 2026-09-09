import { useState } from 'react';
import { Button, Field, Input, Stack } from '@bloomlab/design-system';

export function Resources({
  onSave,
  busy,
}: {
  onSave: (resource: {
    id: string;
    name: string;
    capacity: number;
  }) => Promise<{ ok: boolean } | null>;
  busy: boolean;
}) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('1');
  const [status, setStatus] = useState('');
  return (
    <Stack gap={3}>
      <h3>Service resources</h3>
      <p>
        A physical unit has its own capacity. Create Room 1 and Room 2 separately; assign both as
        alternatives on a service. Availability reserves one free unit. No external calendar is
        connected.
      </p>
      <Field label="Resource identifier (reuse to edit)">
        <Input data-testid="resource-id" value={id} onChange={(e) => setId(e.target.value)} />
      </Field>
      <Field label="Resource name">
        <Input data-testid="resource-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Resource capacity">
        <Input
          data-testid="resource-capacity"
          type="number"
          min={1}
          step={1}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
        />
      </Field>
      <Button
        disabled={busy}
        onClick={() => {
          setStatus('Saving resource…');
          void onSave({ id: id.trim(), name: name.trim(), capacity: Number(capacity) }).then(
            (result) =>
              setStatus(
                result?.ok
                  ? 'Resource saved in this account.'
                  : 'Resource was not saved. Check the account message.',
              ),
          );
        }}
      >
        Save resource
      </Button>
      <p role="status">{status}</p>
    </Stack>
  );
}
