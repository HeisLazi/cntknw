/**
 * Top-level error boundary.
 *
 * Sits outside the providers and the router, so it still catches a
 * failure in either. Handoff §22: `console.error` is never the only
 * failure handling — a user who hits a render crash must be told
 * something true and be given a way forward, and a blank page tells
 * them the app lost their work even when it did not.
 */
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { isStorageError } from '@data/errors';
import './error-boundary.css';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Test seam. Production leaves this to the default reload. */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Kept: it is the only diagnostic a local-first app has. It is
    // no longer the *only* handling, which is what §22 prohibits.
    console.error('CNTKNW: unrecoverable render error', error, info);
  }

  private readonly handleReset = (): void => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    // A typed storage error already carries wording written for a
    // person. Anything else gets a message that does not pretend to
    // know what happened.
    const message = isStorageError(error)
      ? error.userMessage
      : 'Something went wrong while displaying this view. Your library has not been changed.';

    return (
      <div className="cn-error-boundary" role="alert">
        <div className="cn-error-boundary__panel">
          <h1 className="cn-error-boundary__title">CNTKNW could not continue</h1>
          <p className="cn-error-boundary__message">{message}</p>
          <button
            type="button"
            className="cn-error-boundary__action"
            onClick={this.handleReset}
          >
            Try again
          </button>
          <details className="cn-error-boundary__details">
            <summary>Technical details</summary>
            <pre className="cn-error-boundary__trace">
              {error.name}: {error.message}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
