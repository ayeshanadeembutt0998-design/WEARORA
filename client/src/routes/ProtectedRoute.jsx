import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/ui';

const LOGIN = { customer: '/signin', admin: '/admin/login', cashier: '/cashier/login' };

/** Frontend guard only – the backend enforces all authorization. */
export default function ProtectedRoute({ role }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to={LOGIN[role]} replace state={{ from: loc.pathname + loc.search }} />;
  if (user.role !== role) {
    const home = { customer: '/products', admin: '/admin', cashier: '/cashier' }[user.role];
    return <Navigate to={home} replace />;
  }
  if (role === 'customer' && !user.profileComplete && loc.pathname !== '/complete-profile') return <Navigate to="/complete-profile" replace state={{ from: loc.pathname }} />;
  if (role === 'cashier' && user.mustChangePassword && !loc.pathname.endsWith('/profile')) return <Navigate to="/cashier/profile" replace />;
  return <Outlet />;
}

/** Redirects signed-in users away from auth screens. */
export function GuestOnly({ children, role = 'customer' }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageLoader />;
  if (user && user.role === role) {
    const dest = role === 'customer' ? (user.profileComplete ? (loc.state?.from || '/products') : '/complete-profile') : role === 'admin' ? '/admin' : '/cashier';
    return <Navigate to={dest} replace />;
  }
  return children;
}
