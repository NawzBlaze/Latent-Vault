'use client';

import Link from 'next/link';

export default function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="wrap notfound">
      <span className="label">Something misfired</span>
      <h1>The archive hit an error.</h1>
      <p>An unexpected error occurred while rendering this page. Your place in any episode is saved.</p>
      <div className="notfound-actions">
        <button type="button" className="btn btn-solid" onClick={() => reset()}>
          Try again
        </button>
        <Link href="/" className="btn btn-quiet">Back to the archive</Link>
      </div>
      {process.env.NODE_ENV === 'development' && (
        <pre className="error-stack">{error.message}</pre>
      )}
    </div>
  );
}
