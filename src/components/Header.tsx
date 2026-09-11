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
      <div className="wrap masthead-inner">
        <Link href="/" className="brand" aria-label="Latent Vault home">
          {/* eslint-disable-next-line @next/next/no-img-element -- static local SVG brand mark */}
          <img src="/brand/mark.svg" alt="" width="26" height="26" className="brand-mark" />
          <span className="brand-word">
            <span className="brand-name">Latent Vault</span>
            <span className="brand-sub">India&rsquo;s Got Latent &middot; S2 Archive</span>
          </span>
        </Link>

        <nav className="nav-desktop" aria-label="Primary">
          {NAV_LINKS.filter((l) => l.label !== 'Search').map((l) => (
            <Link key={l.href} href={l.href} aria-current={isActive(pathname, l.href) ? 'page' : undefined}>
              {l.label === 'Season 2' ? 'Episodes' : l.label}
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
            placeholder="Search"
            autoComplete="off"
          />
        </form>

        <div className="mobile-btns">
          <Link href="/search" className="mobile-iconbtn" aria-label="Search the archive">
            <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7">
              <circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" strokeLinecap="round" />
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
              <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M4 8h16M4 16h16" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="wrap">
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
      </div>
    </header>
  );
}
