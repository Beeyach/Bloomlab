import { useState } from 'react';

import type { Exercise } from '@bloomlab/content-schema';

import { content } from '../../content/bundle';
import { resolveThread, type ConversationTurnResponse, type SalesResponse } from '../sales';
import { MOVE_KIND_WORDS } from './words';
import styles from './work.module.css';

/**
 * The written client thread (CONV-002).
 *
 * A client writes, the learner writes back, and the client answers as themselves. What comes next
 * follows the move the learner picked — a question, saying the problem back, proposing a system,
 * asking for a decision — so the thread branches on something real rather than on a guess at their
 * prose. Sending without picking a move is allowed and takes the authored fallback: the client
 * asks what was meant instead of the screen pretending to have understood.
 *
 * Nothing here ever says "Correct." There is no verdict between messages, and the whole exchange
 * is kept, so it is still there after a reload and travels with the finished attempt.
 */
export function ClientThread({
  exercise,
  sales,
  onSend,
  disabled,
}: {
  exercise: Exercise;
  sales: SalesResponse;
  onSend: (turns: ConversationTurnResponse[]) => void;
  disabled: boolean;
}) {
  const conversation = exercise.conversation;
  const [draft, setDraft] = useState('');
  const [move, setMove] = useState<string | null>(null);
  if (!conversation) return null;

  const thread = resolveThread(conversation, sales.turns);
  const node = thread.current;
  const client = content.clients.find(
    (candidate) => candidate.id === (conversation.client ?? exercise.client),
  );
  const who = client?.team[0]?.name ?? client?.business_name ?? 'The client';
  const open = node !== null && !node.end;

  const send = () => {
    if (!node || draft.trim().length === 0) return;
    onSend([...sales.turns, { node: node.id, move, text: draft }]);
    setDraft('');
    setMove(null);
  };

  return (
    <section className={styles.thread} aria-labelledby="thread-title" data-testid="client-thread">
      <header className={styles.threadHead}>
        <h3 id="thread-title" className={styles.deskTitle}>
          {conversation.subject}
        </h3>
        <p className={styles.deskNote}>
          {who}
          {client ? ` · ${client.business_name}` : ''}
        </p>
      </header>

      <ol className={styles.messages} aria-live="polite" data-testid="thread-messages">
        {thread.messages.map((message) => (
          <li
            key={`${message.index}-${message.node}`}
            className={message.from === 'client' ? styles.fromClient : styles.fromLearner}
            data-testid={`message-${message.index}`}
          >
            <p className={styles.messageWho}>{message.from === 'client' ? who : 'You'}</p>
            <p className={styles.messageText}>{message.text}</p>
            {message.unclassified && (
              <p className={styles.messageNote}>Sent without saying what you were doing.</p>
            )}
          </li>
        ))}
      </ol>

      {open && node && (
        <div className={styles.composer}>
          <fieldset className={styles.choices} disabled={disabled}>
            <legend className={styles.legend}>What are you doing here</legend>
            {node.moves.map((option) => (
              <label key={option.id} className={styles.choice}>
                <input
                  type="radio"
                  name={`move-${node.id}`}
                  value={option.id}
                  checked={move === option.id}
                  data-testid={`move-${option.id}`}
                  onChange={() => setMove(option.id)}
                />
                <span className={styles.choiceBody}>
                  <span className={styles.choiceName}>{option.label}</span>
                  <span className={styles.choiceHelp}>{MOVE_KIND_WORDS[option.kind]}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Your reply</span>
            <textarea
              className={styles.textarea}
              rows={5}
              value={draft}
              disabled={disabled}
              data-testid="thread-composer"
              aria-describedby="thread-composer-help"
              onChange={(event) => setDraft(event.target.value)}
            />
            <span id="thread-composer-help" className={styles.help}>
              {conversation.composer_help}
            </span>
          </label>

          <button
            type="button"
            className={styles.addButton}
            disabled={disabled || draft.trim().length === 0}
            data-testid="thread-send"
            onClick={send}
          >
            Send
          </button>
        </div>
      )}

      {!open && (
        <p className={styles.deskNote} data-testid="thread-closed">
          {node
            ? 'This thread is finished.'
            : 'This thread cannot go further. It was saved against an older version of the exercise.'}
        </p>
      )}
    </section>
  );
}
