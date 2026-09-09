'use client';

import Link from 'next/link';

export default function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="wrap notfound">
      <h1>Something misfired</h1>
      <p>The archive hit an unexpected error rendering this page. Your place in any episode is saved.</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-gold" onClick={() => reset()}>
          Try again
        </button>
        <Link href="/" className="btn btn-outline">
          Back to the archive
        </Link>
      </div>
      {process.env.NODE_ENV === 'development' && (
        <pre style={{ textAlign: 'left', marginTop: 24, fontSize: 12, color: 'var(--muted)' }}>
          {error.message}
        </pre>
      )}
    </div>
  );
}
