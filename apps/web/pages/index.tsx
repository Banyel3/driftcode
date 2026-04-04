import type { NextPage } from 'next';

const HomePage: NextPage = () => {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0D1117',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#E6EDF3',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 600, padding: '0 24px' }}>
        <h1
          style={{
            fontSize: '3rem',
            fontWeight: 700,
            marginBottom: '1rem',
            letterSpacing: '-0.02em',
          }}
        >
          DriftCode
        </h1>
        <p style={{ fontSize: '1.25rem', color: '#8B949E', marginBottom: '2rem' }}>
          AI Coding, Anywhere
        </p>
        <p style={{ color: '#6E7681', fontSize: '0.875rem', lineHeight: 1.6 }}>
          A mobile-first, self-hostable client for{' '}
          <a
            href="https://opencode.ai"
            style={{ color: '#0066CC', textDecoration: 'none' }}
          >
            opencode
          </a>
          . Run full AI coding sessions from your phone, backed by your own VPS.
        </p>
        <p style={{ marginTop: '3rem', color: '#6E7681', fontSize: '0.75rem' }}>
          Landing page — coming soon
        </p>
      </div>
    </main>
  );
};

export default HomePage;
