import Link from 'next/link';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <div className="footer-brand">
            {/* eslint-disable-next-line @next/next/no-img-element -- static local SVG brand mark */}
            <img src="/brand/mark.svg" alt="" width="40" height="40" />
            <div>
              <div className="footer-name">LATENT VAULT</div>
              <p className="footer-desc">
                An independent streaming archive of India’s Got Latent. Episodes stream directly
                from the configured media source to your device.
              </p>
            </div>
          </div>
        </div>
        <div>
          <h4>Archive</h4>
          <nav aria-label="Archive">
            <Link href="/">Home</Link>
            <Link href="/season/2">Season 2</Link>
            <Link href="/bonus">Bonus</Link>
          </nav>
        </div>
        <div>
          <h4>Find</h4>
          <nav aria-label="Find">
            <Link href="/search">Search</Link>
            <Link href="/search?q=bonus">Bonus episodes</Link>
            <Link href="/search?q=season%202">Season 2</Link>
          </nav>
        </div>
      </div>
      <div className="footer-legal">
        <span>© {year} Latent Vault. Unofficial fan archive — not affiliated with, endorsed, or sponsored by the show, its creators, or any network.</span>
        <span>Media is streamed from the configured source; nothing is re-hosted here.</span>
      </div>
    </footer>
  );
}
