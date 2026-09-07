import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { AiMode, AiSettings } from '@bloomlab/shared';
import { getAiSettings, selectAiOff, setAiSettings } from '../ai/client';
import { loadWorkspace } from '../data/workspace';
import styles from './AiSettingsScreen.module.css';
export default function AiSettingsScreen() {
  const [mode, setMode] = useState<AiMode>('Limited');
  const [limit, setLimit] = useState('20');
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void getAiSettings()
      .then((s) => {
        if (live) {
          setSettings(s);
          setMode(s.mode);
          setLimit(String(s.monthly_limit_usd));
        }
      })
      .catch(async (e) => {
        const local = await loadWorkspace<AiMode>('ai.mode');
        if (live) {
          if (local) setMode(local);
          setMessage(e instanceof Error ? e.message : 'Settings unavailable.');
        }
      });
    return () => {
      live = false;
    };
  }, []);
  async function save() {
    setBusy(true);
    try {
      const s = await setAiSettings(mode, Number(limit));
      setSettings(s);
      setMode(s.mode);
      setMessage('AI settings saved for your learner account.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Settings could not be saved.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.screen} aria-labelledby="ai-settings-title">
      <h1 id="ai-settings-title">AI settings</h1>
      <p>AI helps evaluate reasoning. Your Labs and deterministic exercises work with AI Off.</p>
      <label>
        AI Coaching
        <select
          value={mode}
          disabled={busy}
          onChange={(e) => {
            const next = e.target.value as AiMode;
            setMode(next);
            if (next === 'Off')
              void selectAiOff().catch((e: unknown) => {
                setMessage(e instanceof Error ? e.message : 'Local settings could not be saved.');
              });
          }}
        >
          <option>Off</option>
          <option>Limited</option>
          <option>Full</option>
        </select>
      </label>
      <p>
        Limited evaluates submitted rubrics and interprets negotiation language. Full also permits
        optional coaching when available.
      </p>
      <label>
        Monthly limit in dollars
        <input
          type="number"
          min="0"
          max="1000"
          step="1"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
        />
      </label>
      <button
        disabled={
          busy ||
          limit === '' ||
          !Number.isFinite(Number(limit)) ||
          Number(limit) < 0 ||
          Number(limit) > 1000
        }
        onClick={() => void save()}
      >
        {busy ? 'Saving…' : 'Save AI settings'}
      </button>
      {message && <p role="status">{message}</p>}
      {settings ? (
        <>
          <h2>
            AI this month: ${settings.spent_usd.toFixed(2)} / $
            {settings.monthly_limit_usd.toFixed(2)}
          </h2>
          {settings.reserved_usd > 0 && (
            <p>${settings.reserved_usd.toFixed(2)} reserved for pending or unconfirmed requests.</p>
          )}
          <ul>
            {settings.categories.map((c) => (
              <li key={c.category}>
                {c.category.replaceAll('_', ' ')}: ${c.cost_usd.toFixed(2)}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>Link this device to see account usage and save server settings.</p>
      )}
      <Link to="/sync">Sync and devices</Link>
    </section>
  );
}
