import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button, IconRefresh, Surface } from '@bloomlab/design-system';

import styles from './ScreenErrorBoundary.module.css';

interface Props {
  /** Changing the key (the route path) resets the boundary so navigation recovers. */
  resetKey: string;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * A screen that throws must not take the shell with it (INF-011): the rail, the sync status and
 * the learner's local data stay; the screen shows a plain message and can be retried. Details go
 * to the console for diagnostics, never to the learner.
 */
export class ScreenErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen failed', error, info.componentStack);
  }

  override componentDidUpdate(previous: Props) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  override render() {
    if (this.state.failed) {
      return (
        <Surface padding="md" className={styles.failed} role="alert">
          <h1 className={styles.title}>This screen hit a problem.</h1>
          <p className={styles.text}>
            Your progress is safe on this device. Try the screen again, or use the rail to go
            somewhere else.
          </p>
          <Button
            variant="primary"
            icon={<IconRefresh size={16} />}
            onClick={() => this.setState({ failed: false })}
          >
            Try again
          </Button>
        </Surface>
      );
    }
    return this.props.children;
  }
}
