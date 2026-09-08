import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '@bloomlab/design-system';
import { db } from '../data/db';
import { evidenceFetch, EvidenceRequestError, readEvidence } from '../fieldwork/assets';
import type { PortfolioView } from './view';
import styles from './portfolio.module.css';

export function PrivateScreenshot({ asset }: { asset: PortfolioView['screenshots'][number] }) {
  const local = useLiveQuery(() => db.evidence_assets.get(asset.asset_id), [asset.asset_id]);
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState(
    'Private screenshot referenced. Availability is checked when opened.',
  );
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  const deleted = asset.deleted || local?.status === 'deleted' || local?.status === 'deleting';
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  async function open() {
    const turn = ++request.current;
    setBusy(true);
    setUrl(null);
    setStatus('Checking private screenshot…');
    try {
      const metadata = await readEvidence(asset.asset_id);
      if (
        metadata.status !== 'ready' ||
        metadata.attempt_id !== asset.attempt_id ||
        metadata.exercise_id !== asset.exercise_id ||
        metadata.item_key !== asset.item_key
      )
        throw new Error('unavailable');
      const image = await evidenceFetch(asset.asset_id, {}, true);
      const blob = await image.blob();
      if (turn !== request.current) return;
      setUrl(URL.createObjectURL(blob));
      setStatus('Private screenshot available.');
    } catch (error) {
      if (turn !== request.current) return;
      setStatus(
        error instanceof EvidenceRequestError && error.status === 410
          ? 'Screenshot deleted. Historical proof remains recorded.'
          : 'Screenshot unavailable. Connect this Bloomlab device and retry; your project is saved.',
      );
    } finally {
      if (turn === request.current) setBusy(false);
    }
  }
  return (
    <figure className={styles.media}>
      <figcaption>
        {deleted ? 'Screenshot deleted. Historical proof remains recorded.' : status}
      </figcaption>
      {!deleted && url && <img src={url} alt="Private screenshot supplied with fieldwork" />}
      {!deleted && (
        <Button loading={busy} onClick={() => void open()}>
          {url ? 'Check screenshot again' : 'View private screenshot'}
        </Button>
      )}
    </figure>
  );
}
