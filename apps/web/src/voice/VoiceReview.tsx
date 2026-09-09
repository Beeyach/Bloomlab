import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { VoiceCharacter, VoiceLine } from '@bloomlab/content-schema';
import type { VoiceAssetStatus } from '@bloomlab/shared';
import { Button } from '@bloomlab/design-system';
import { content } from '../content/bundle';
import { voiceAudio, voiceLibrary } from './client';
import styles from './VoiceReview.module.css';

function Player({
  line,
  asset,
  loading,
}: {
  line: VoiceLine;
  asset?: VoiceAssetStatus;
  loading: boolean;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const resource = useRef<{ url?: string; controller?: AbortController }>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const current = resource.current;
    return () => {
      current.controller?.abort();
      if (current.url) URL.revokeObjectURL(current.url);
    };
  }, []);
  async function play() {
    if (!asset?.available || !audio.current) return;
    resource.current.controller?.abort();
    const controller = new AbortController();
    resource.current.controller = controller;
    setBusy(true);
    setMessage('Loading saved audio…');
    try {
      const blob = await voiceAudio(asset.asset_id, controller.signal);
      if (controller.signal.aborted || !audio.current) return;
      if (resource.current.url) URL.revokeObjectURL(resource.current.url);
      const url = URL.createObjectURL(blob);
      resource.current.url = url;
      audio.current.src = url;
      await audio.current.play();
      setMessage('Playing saved audio.');
    } catch (error) {
      if (!controller.signal.aborted)
        setMessage(
          error instanceof Error ? error.message : 'Audio could not play. Use the text below.',
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className={styles.player}>
      <h2>
        {line.kind === 'scenario'
          ? 'Scripted scenario dialogue'
          : line.kind.charAt(0).toUpperCase() + line.kind.slice(1)}
      </h2>
      <p data-testid="voice-transcript" className={styles.transcript}>
        {line.text}
      </p>
      <p>
        {asset
          ? asset.available
            ? `Saved audio · ${Math.round((asset.byte_length ?? 0) / 1024)} KB`
            : 'Audio not generated yet.'
          : loading
            ? 'Checking saved audio…'
            : 'Saved audio is unavailable.'}
      </p>
      <Button onClick={() => void play()} disabled={!asset?.available || busy}>
        {busy ? 'Loading…' : 'Play line'}
      </Button>
      <audio
        ref={audio}
        controls
        preload="none"
        aria-label="Saved voice line"
        onEnded={() => setMessage('Playback finished.')}
        onError={() => setMessage('Audio could not play. The authored text is available above.')}
      />
      <p role="status">{message}</p>
    </div>
  );
}

function CharacterReview({ voice }: { voice: VoiceCharacter }) {
  const [selected, setSelected] = useState(voice.lines[0]!.id);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    attempt: number;
    assets?: VoiceAssetStatus[];
    error?: string;
  } | null>(null);
  const current = result?.attempt === attempt ? result : null;
  useEffect(() => {
    const controller = new AbortController();
    void voiceLibrary(voice.id, controller.signal)
      .then((assets) => {
        if (!controller.signal.aborted) setResult({ attempt, assets });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            attempt,
            error: error instanceof Error ? error.message : 'Library unavailable.',
          });
      });
    return () => controller.abort();
  }, [voice.id, attempt]);
  const line = voice.lines.find((l) => l.id === selected) ?? voice.lines[0]!;
  return (
    <>
      <dl className={styles.metadata} data-testid="voice-identity">
        <dt>Character</dt>
        <dd>{voice.id}</dd>
        <dt>Voice ID</dt>
        <dd>{voice.voice_id}</dd>
        <dt>Language</dt>
        <dd>{voice.language}</dd>
        <dt>Speech rate</dt>
        <dd>{voice.speech_rate}</dd>
        <dt>Style / stability</dt>
        <dd>
          {voice.style} / {voice.stability}
        </dd>
        <dt>Emotion range</dt>
        <dd>{voice.allowed_emotion_range.join(', ')}</dd>
      </dl>
      <label>
        Authored line
        <select
          value={line.id}
          data-testid="voice-line"
          onChange={(e) => setSelected(e.target.value)}
        >
          {voice.lines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.kind} · {l.id}
            </option>
          ))}
        </select>
      </label>
      {current?.error && (
        <p role="alert">
          {current.error} <Link to="/sync">Sync and devices</Link>
        </p>
      )}
      <Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>
        Refresh library
      </Button>
      <Player
        key={line.id}
        line={line}
        loading={!current}
        asset={current?.assets?.find((a) => a.line_id === line.id)}
      />
    </>
  );
}

/** Internal review only, registered behind system_diagnostics. voice_calls stays off. */
export default function VoiceReview() {
  const [params, setParams] = useSearchParams();
  const voice =
    content.voice_characters.find((v) => v.id === params.get('character')) ??
    content.voice_characters[0];
  if (!voice) return <p>No voice characters are authored.</p>;
  return (
    <section className={styles.screen} aria-labelledby="voice-title">
      <Link to="/system">← System diagnostics</Link>
      <h1 id="voice-title">Voice library</h1>
      <p>Review the saved voices and authored lines for Bloomlab’s fictional clients.</p>
      <label>
        Fictional client
        <select
          data-testid="voice-character"
          value={voice.id}
          onChange={(e) => setParams({ character: e.target.value })}
        >
          {content.voice_characters.map((v) => (
            <option key={v.id} value={v.id}>
              {content.clients.find((c) => c.id === v.client)?.business_name ?? v.client}
            </option>
          ))}
        </select>
      </label>
      {voice.asset_delivery === 'text' ? (
        <section>
          <h2>Written character direction</h2>
          <p>This character is authored for written roleplay. No saved audio is claimed.</p>
          {voice.lines.map((line) => (
            <p key={line.id}>{line.text}</p>
          ))}
        </section>
      ) : (
        <CharacterReview key={voice.id} voice={voice} />
      )}
    </section>
  );
}
