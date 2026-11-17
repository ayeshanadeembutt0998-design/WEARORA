import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, LogOut, Menu, Package, ShoppingCart, User, UserPlus, X, LayoutDashboard, ScanLine } from 'lucide-react';
import Logo from '../components/ui/Logo';
import ThemeToggle from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { cx } from '../utils/format';

const navLink = ({ isActive }) => cx('relative px-1 py-2 text-sm font-semibold transition hover:text-gold-dark', isActive ? 'text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-gold' : 'text-muted');

function ProfileMenu() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  const item = 'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-ink hover:bg-surface2';
  const go = (to) => { setOpen(false); nav(to); };
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="rounded-lg p-2 text-muted transition hover:bg-surface2 hover:text-gold-dark" aria-label="Account menu" aria-expanded={open}>
        <User className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 animate-pop rounded-xl border border-line bg-surface p-1.5 shadow-soft" role="menu">
          {user ? (
            <>
              <div className="border-b border-line px-3 py-2"><p className="truncate text-sm font-bold">{user.fullName}</p><p className="truncate text-xs text-muted">{user.email}</p></div>
              {user.role === 'customer' && (<><button className={item} onClick={() => go('/profile')}><User className="h-4 w-4" /> My Profile</button><button className={item} onClick={() => go('/orders')}><Package className="h-4 w-4" /> My Orders</button></>)}
              {user.role === 'admin' && <button className={item} onClick={() => go('/admin')}><LayoutDashboard className="h-4 w-4" /> Admin Panel</button>}
              {user.role === 'cashier' && <button className={item} onClick={() => go('/cashier')}><ScanLine className="h-4 w-4" /> Cashier POS</button>}
              <button className={cx(item, 'text-red-600')} onClick={async () => { setOpen(false); await signOut(); nav('/products'); }}><LogOut className="h-4 w-4" /> Sign Out</button>
            </>
          ) : (
            <>
              <button className={item} onClick={() => go('/signin')}><LogIn className="h-4 w-4" /> Sign In</button>
              <button className={item} onClick={() => go('/signup')}><UserPlus className="h-4 w-4" /> Create Account</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function CustomerLayout() {
  const { count } = useCart();
  const [mobile, setMobile] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setMobile(false); window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/products" aria-label="Wearora home"><Logo className="h-9 sm:h-10" tagline /></Link>
          <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
            <NavLink to="/products" className={navLink}>Products</NavLink>
            <NavLink to="/about" className={navLink}>About</NavLink>
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link to="/cart" className="relative rounded-lg p-2 text-muted transition hover:bg-surface2 hover:text-gold-dark" aria-label={`Cart, ${count} items`}>
              <ShoppingCart className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-charcoal">{count}</span>
            </Link>
            <div className="mx-1 hidden h-6 w-px bg-line sm:block" />
            <ThemeToggle />
            <ProfileMenu />
            <button className="rounded-lg p-2 text-muted hover:bg-surface2 md:hidden" onClick={() => setMobile((m) => !m)} aria-label="Toggle menu">{mobile ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          </div>
        </div>
        {mobile && (
          <nav className="animate-pop border-t border-line bg-bg px-4 py-3 md:hidden">
            <NavLink to="/products" className="block rounded-md px-3 py-2.5 text-sm font-semibold hover:bg-surface2">Products</NavLink>
            <NavLink to="/about" className="block rounded-md px-3 py-2.5 text-sm font-semibold hover:bg-surface2">About</NavLink>
          </nav>
        )}
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-muted sm:flex-row sm:px-6">
          <Logo className="h-7" />
          <p>© 2026 Wearora. All rights reserved.</p>
          <nav className="flex items-center gap-1" aria-label="Footer">
            <Link to="/contact" className="hover:text-gold-dark">Contact</Link><span aria-hidden>|</span>
            <Link to="/privacy" className="hover:text-gold-dark">Privacy Policy</Link><span aria-hidden>|</span>
            <Link to="/terms" className="hover:text-gold-dark">Terms and Conditions</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
