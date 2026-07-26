import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Phase 0A placeholder entry point.
 *
 * This renders a minimal shell so that `npm run build` and
 * `npm run dev` produce a valid application. The legacy v1
 * app remains untouched under src/legacy-v1/.
 *
 * Phase 0D will replace this with the router, providers,
 * and AppShell layout.
 */
function App() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#191919',
      color: '#e8e8e8',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          CNTKNW
        </h1>
        <p style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>
          Phase 0A — Foundation build verified
        </p>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
