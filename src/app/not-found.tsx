import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="wrap notfound">
      {/* eslint-disable-next-line @next/next/no-img-element -- static local SVG brand mark */}
      <img src="/brand/mark.svg" alt="" width="72" height="72" />
      <h1>Reel not found</h1>
      <p>
        Nothing in the archive lives at this address. It may never have existed — or it may not be
        published yet.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/" className="btn btn-gold">
          Back to the archive
        </Link>
        <Link href="/search" className="btn btn-outline">
          Search
        </Link>
      </div>
    </div>
  );
}
