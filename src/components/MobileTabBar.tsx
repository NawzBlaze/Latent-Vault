'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_LINKS } from '@/lib/site';

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav className="tabbar" aria-label="Quick navigation">
      {NAV_LINKS.map((l) => {
        const active = isActive(pathname, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`tabbar-item${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <span className="tabbar-ico" aria-hidden="true">
              {l.href === '/' ? (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 11.2 12 4l8 7.2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M6.2 10.4V20h11.6v-9.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : l.href === '/search' ? (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M16.5 16.5 21 21" strokeLinecap="round" />
                </svg>
              ) : l.href === '/bonus' ? (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 4.5 14 9l4.8.5-3.6 3.2 1 4.7L12 15l-4.2 2.4 1-4.7L5.2 9.5 10 9z" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3.5" y="5" width="17" height="14" rx="3" />
                  <path d="M10.4 9.4 15 12l-4.6 2.6z" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span className="tabbar-label">{l.label === 'Season 2' ? 'Episodes' : l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
