import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="wrap notfound">
      <span className="label">404 — Not in the archive</span>
      <h1>This reel doesn&rsquo;t exist.</h1>
      <p>
        Nothing in the archive lives at this address. It may never have existed, or it may
        not be published yet.
      </p>
      <div className="notfound-actions">
        <Link href="/" className="btn btn-solid">Back to the archive</Link>
        <Link href="/search" className="btn btn-quiet">Search</Link>
      </div>
    </div>
  );
}
