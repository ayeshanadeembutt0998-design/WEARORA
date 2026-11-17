import { useState } from 'react';
import { AlertTriangle, Calendar, Lock, Mail, Phone, User, Receipt, Wallet } from 'lucide-react';
import { Field, PageHeader, PageLoader, PasswordInput, Spinner, Stat, ErrorState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { api } from '../services/api';
import { fmtDate, money } from '../utils/format';

const Info = ({ icon: Icon, label, value }) => <div className="flex items-center gap-3 rounded-lg border border-line p-3"><Icon className="h-4 w-4 text-gold-dark" /><div className="min-w-0"><p className="text-[11px] text-muted">{label}</p><p className="truncate text-sm font-semibold">{value || '—'}</p></div></div>;

/** Read-only account info + password change (used by Admin and Cashier). */
export default function StaffProfile() {
  const { user, setUser } = useAuth(); const toast = useToast();
  const cashier = user.role === 'cashier';
  const { data, loading, error, reload } = useAsync(() => (cashier ? api.get('/cashier/profile') : Promise.resolve(null)), [cashier]);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' }); const [err, setErr] = useState({}); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); const v = {};
    if (!pw.currentPassword) v.currentPassword = 'Required';
    if (pw.newPassword.length < 8 || !/[A-Za-z]/.test(pw.newPassword) || !/\d/.test(pw.newPassword)) v.newPassword = 'Min 8 characters with a letter and a number';
    if (pw.newPassword !== pw.confirmPassword) v.confirmPassword = 'Passwords do not match';
    setErr(v); if (Object.keys(v).length) return;
    setBusy(true);
    try { const r = await api.patch('/users/change-password', pw); setUser(r.user); setPw({ currentPassword: '', newPassword: '', confirmPassword: '' }); toast.success('Password changed'); }
    catch (ex) { setErr(ex.errors || { currentPassword: ex.message }); toast.error(ex.message); } finally { setBusy(false); }
  };
  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const p = data?.profile;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={cashier ? 'Cashier Profile' : 'Admin Profile'} subtitle="Your account details are managed by an administrator." />
      {user.mustChangePassword && <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><p><b>Action required:</b> you are using a temporary password. Please set a new password below to continue.</p></div>}
      <section className="card grid gap-3 p-5 sm:grid-cols-2">
        <Info icon={User} label="Full name" value={user.fullName} /><Info icon={Mail} label="Email" value={user.email} />
        <Info icon={Phone} label="Mobile" value={user.mobile} /><Info icon={Calendar} label="Member since" value={fmtDate(user.createdAt)} />
      </section>
      {p && <section className="grid gap-3 sm:grid-cols-3"><Stat icon={Receipt} label="Total sales" value={p.totalSales} /><Stat icon={Receipt} label="Sales today" value={p.salesToday} /><Stat icon={Wallet} label="Revenue today" value={money(p.revenueToday)} /></section>}
      <form onSubmit={submit} noValidate className="card space-y-4 p-5">
        <h2 className="text-lg font-bold">Change password</h2>
        <Field label="Current / temporary password" error={err.currentPassword}>{({ id }) => <PasswordInput id={id} icon={Lock} autoComplete="current-password" value={pw.currentPassword} error={err.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password" error={err.newPassword}>{({ id }) => <PasswordInput id={id} icon={Lock} autoComplete="new-password" value={pw.newPassword} error={err.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />}</Field>
          <Field label="Confirm new password" error={err.confirmPassword}>{({ id }) => <PasswordInput id={id} icon={Lock} autoComplete="new-password" value={pw.confirmPassword} error={err.confirmPassword} onChange={(e) => setPw({ ...pw, confirmPassword: e.target.value })} />}</Field>
        </div>
        <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Update password</button>
      </form>
    </div>
  );
}
