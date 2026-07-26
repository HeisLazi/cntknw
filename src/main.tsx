import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@app/App';
import { createProductionRepositories } from '@app/composition/production';
import { isStorageError } from '@data/errors';
import '@design/tokens.css';
import '@design/base.css';
// The start-up failure panel below reuses the error-boundary styles.
import '@app/providers/error-boundary.css';

/**
 * Production entry point.
 *
 * The only thing that happens before React mounts is opening the
 * database, so a storage failure surfaces as a typed error at a
 * known point rather than as an unhandled rejection from whichever
 * component happened to read first. The app is local-first: if
 * storage cannot open, there is nothing to render and saying so is
 * the only honest response.
 */
async function start(): Promise<void> {
  const container = document.getElementById('root');
  if (!container) throw new Error('CNTKNW: #root is missing from index.html');

  const root = createRoot(container);

  try {
    const repositories = await createProductionRepositories();
    root.render(
      <StrictMode>
        <App repositories={repositories} />
      </StrictMode>,
    );
  } catch (error) {
    console.error('CNTKNW: storage could not be opened', error);
    const message = isStorageError(error)
      ? error.userMessage
      : 'Your library could not be opened. Your work has not been lost.';

    // Rendered without the providers, deliberately: they are exactly
    // what failed, so mounting them again would fail again.
    root.render(
      <div className="cn-error-boundary" role="alert">
        <div className="cn-error-boundary__panel">
          <h1 className="cn-error-boundary__title">CNTKNW could not start</h1>
          <p className="cn-error-boundary__message">{message}</p>
          <button
            type="button"
            className="cn-error-boundary__action"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      </div>,
    );
  }
}

void start();
