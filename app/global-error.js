'use client';

/**
 * Root-level error UI — must define its own html/body and must not use app providers.
 * Fixes Next.js prerender failures on /_global-error during production builds (e.g. Netlify).
 */
export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          background: '#f8fafc',
          color: '#0f172a',
        }}
      >
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              maxWidth: '420px',
              width: '100%',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 10px 40px rgba(15, 23, 42, 0.08)',
            }}
          >
            <p
              style={{
                margin: '0 0 8px',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#6366f1',
              }}
            >
              Safe Hands Escrow
            </p>
            <h1 style={{ margin: '0 0 12px', fontSize: '22px' }}>Something went wrong</h1>
            <p style={{ margin: '0 0 20px', color: '#475569', lineHeight: 1.6 }}>
              An unexpected error occurred. You can try again or return to the home page.
            </p>
            {error?.digest ? (
              <p style={{ margin: '0 0 20px', fontSize: '12px', color: '#94a3b8' }}>
                Reference: {error.digest}
              </p>
            ) : null}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <button
                type="button"
                onClick={() => reset()}
                style={{
                  background: '#4338ca',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 18px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
              <a
                href="/"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: '#4338ca',
                  fontWeight: 600,
                  textDecoration: 'none',
                  padding: '10px 4px',
                }}
              >
                Go home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
