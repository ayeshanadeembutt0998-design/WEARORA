import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import Logo from '../components/ui/Logo';
import ThemeToggle from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { cx } from '../utils/format';

/** Shared shell for Admin and Cashier interfaces (sidebar + top bar). */
export default function PanelLayout({ items, roleLabel, loginPath }) {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const current = items.find((i) => pathname.startsWith(i.to))?.label;

  const side = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-white/10 px-5"><Logo className="h-9 brightness-0 invert" light tagline /></div>
      <p className="px-5 pb-1 pt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">{roleLabel}</p>
      <nav className="flex-1 space-y-1 px-3" aria-label={`${roleLabel} navigation`}>
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => cx('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-gold text-charcoal' : 'text-neutral-300 hover:bg-white/10 hover:text-white')}>
            <Icon className="h-[18px] w-[18px]" />{label}
          </NavLink>
        ))}
      </nav>
      <button onClick={async () => { await signOut(); nav(loginPath); }} className="m-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-300 transition hover:bg-red-500/20 hover:text-red-300"><LogOut className="h-[18px] w-[18px]" /> Sign Out</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg lg:flex">
      <aside className="hidden w-64 shrink-0 bg-charcoal lg:fixed lg:inset-y-0 lg:block">{side}</aside>
      {open && (<div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} /><aside className="absolute inset-y-0 left-0 w-64 animate-slideIn bg-charcoal" style={{ animationName: 'none' }}>{side}</aside></div>)}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 text-muted hover:bg-surface2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
            <h2 className="font-heading text-lg font-bold">{current || roleLabel}</h2>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="hidden text-right sm:block"><p className="text-sm font-semibold leading-tight">{user?.fullName}</p><p className="text-[11px] capitalize text-muted">{user?.role}</p></div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold text-sm font-bold text-charcoal">{user?.fullName?.[0]?.toUpperCase()}</div>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
