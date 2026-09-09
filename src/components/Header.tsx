'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { NAV_LINKS } from '@/lib/site';

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [q, setQ] = useState('');

  return (
    <header className="masthead">
      <div className="masthead-rule" aria-hidden="true" />
      <div className="wrap masthead-inner">
        <Link href="/" className="brand" aria-label="Latent Vault home">
          {/* eslint-disable-next-line @next/next/no-img-element -- static local SVG brand mark */}
          <img src="/brand/mark.svg" alt="" width="34" height="34" className="brand-mark" />
          <span className="brand-word">
            <span className="brand-name">LATENT VAULT</span>
            <span className="brand-sub">India’s Got Latent · Archive</span>
          </span>
        </Link>

        <nav className="nav-desktop" aria-label="Primary">
          {NAV_LINKS.filter((l) => l.label !== 'Search').map((l) => (
            <Link key={l.href} href={l.href} aria-current={isActive(pathname, l.href) ? 'page' : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>

        <form
          className="header-search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`/search?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <label htmlFor="header-q" className="visually-hidden">
            Search the archive
          </label>
          <input
            id="header-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search episodes, guests…"
            autoComplete="off"
          />
        </form>

        <div className="mobile-btns">
          <Link href="/search" className="mobile-iconbtn" aria-label="Search the archive">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M16.5 16.5L21 21" strokeLinecap="round" />
            </svg>
          </Link>
          <button
            type="button"
            className="mobile-iconbtn"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? (
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <nav className={`nav-mobile${menuOpen ? ' open' : ''}`} aria-label="Mobile">
        {NAV_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive(pathname, l.href) ? 'page' : undefined}
            onClick={() => setMenuOpen(false)}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
