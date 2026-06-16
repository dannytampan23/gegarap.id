'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  Menu,
  X,
  Hammer,
  Search,
  Briefcase,
  LayoutDashboard,
  ClipboardList,
  LogOut,
  ChevronDown,
  User,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/Button';

const links = [
  { href: '/search', label: 'Cari Tukang', icon: Search },
  { href: '/onboarding', label: 'Jadi Mitra', icon: Briefcase },
];

/** Mask a normalised WA number for display, e.g. 6281234567890 → +62 812***7890. */
function maskPhone(phone?: string): string {
  if (!phone) return 'Akun';
  const local = phone.startsWith('62') ? phone.slice(2) : phone;
  if (local.length < 7) return `+62 ${local}`;
  return `+62 ${local.slice(0, 3)}***${local.slice(-4)}`;
}

export function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [open, setOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const authed = status === 'authenticated';
  const masked = maskPhone(session?.user?.phone);
  const isProvider = session?.user?.role === 'PROVIDER';
  const isAdmin = session?.user?.role === 'ADMIN';

  // "Dashboard" is the customer view; providers get an extra link to their own
  // dashboard, and admins get the KYC panel. Links are role-gated so users never
  // see an area they can't enter (middleware enforces it server-side too).
  const accountLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ...(isProvider
      ? [{ href: '/provider/dashboard', label: 'Dashboard Tukang', icon: ClipboardList }]
      : []),
    ...(isAdmin ? [{ href: '/admin', label: 'Panel Admin (KYC)', icon: ShieldCheck }] : []),
  ];

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menus whenever the route changes.
  React.useEffect(() => {
    setOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  // Close the account dropdown on outside click / Escape.
  React.useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-300',
        scrolled
          ? 'glass border-b border-border/70 shadow-soft'
          : 'border-b border-transparent bg-background/80 backdrop-blur-sm'
      )}
    >
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="gegarap.id beranda">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow transition-transform duration-300 group-hover:scale-105 group-hover:rotate-6">
            <Hammer className="h-5 w-5" />
          </span>
          <span className="text-xl font-extrabold tracking-tight text-foreground">
            gegarap<span className="text-primary">.id</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + '/');
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors',
                  active
                    ? 'bg-primary-light text-primary-800'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop auth area */}
        <div className="hidden items-center gap-2 md:flex">
          {authed ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1.5 pr-2.5 shadow-soft transition-colors hover:bg-muted"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-primary">
                  <User className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold text-foreground">{masked}</span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-muted-foreground transition-transform',
                    menuOpen && 'rotate-180'
                  )}
                />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-elevated animate-scale-in"
                >
                  <div className="border-b border-border px-3 py-2.5">
                    <p className="text-xs text-muted-foreground">Masuk sebagai</p>
                    <p className="truncate text-sm font-bold text-foreground">{masked}</p>
                  </div>
                  <div className="py-1">
                    {accountLinks.map((l) => {
                      const Icon = l.icon;
                      return (
                        <Link
                          key={l.label}
                          href={l.href}
                          role="menuitem"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                        >
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          {l.label}
                        </Link>
                      );
                    })}
                  </div>
                  <div className="border-t border-border pt-1">
                    <button
                      role="menuitem"
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Keluar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className={buttonVariants({ variant: 'primary', size: 'sm' })}>
              Masuk
            </Link>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted md:hidden"
          aria-label={open ? 'Tutup menu' : 'Buka menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-border glass md:hidden animate-fade-down">
          <nav className="container flex flex-col gap-1 py-4">
            {links.map((l) => {
              const active = pathname === l.href || pathname.startsWith(l.href + '/');
              const Icon = l.icon;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold transition-colors',
                    active ? 'bg-primary-light text-primary-800' : 'text-foreground hover:bg-muted'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {l.label}
                </Link>
              );
            })}

            {authed ? (
              <>
                <div className="my-2 border-t border-border" />
                <p className="px-4 pb-1 text-xs text-muted-foreground">{masked}</p>
                {accountLinks.map((l) => {
                  const Icon = l.icon;
                  return (
                    <Link
                      key={l.label}
                      href={l.href}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold text-foreground transition-colors hover:bg-muted"
                    >
                      <Icon className="h-5 w-5" />
                      {l.label}
                    </Link>
                  );
                })}
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold text-red-600 transition-colors hover:bg-red-50"
                >
                  <LogOut className="h-5 w-5" />
                  Keluar
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className={buttonVariants({
                  variant: 'primary',
                  size: 'lg',
                  className: 'mt-2 w-full',
                })}
              >
                Masuk
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
