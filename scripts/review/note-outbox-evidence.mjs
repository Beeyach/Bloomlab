// Pure evidence check: other pending entities and UI render timing cannot mask a saved note.
export function noteOutboxEvidence(notes, queue) {
  const live = notes.filter((note) => note.deleted_at === null);
  return {
    savedLocally: live.length > 0,
    queuedBeforeSync: live.some((note) =>
      queue.some(
        (row) =>
          row.entity === 'notes' &&
          row.entity_id === note.id &&
          row.op === 'upsert' &&
          row.revision === note.revision &&
          row.payload?.id === note.id &&
          row.payload?.revision === note.revision &&
          row.payload?.deleted_at === note.deleted_at &&
          row.payload?.body === note.body,
      ),
    ),
    queueCount: queue.length,
  };
}
