import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail, ShieldCheck, ScanLine } from 'lucide-react';
import Logo from '../components/ui/Logo';
import { Field, PasswordInput, Spinner, TextInput } from '../components/ui';
import ThemeToggle from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function StaffLogin({ portal }) {
  const { signIn } = useAuth(); const nav = useNavigate(); const toast = useToast();
  const [f, setF] = useState({ email: '', password: '' }); const [err, setErr] = useState({}); const [busy, setBusy] = useState(false);
  const admin = portal === 'admin'; const Icon = admin ? ShieldCheck : ScanLine;
  const submit = async (e) => {
    e.preventDefault(); const v = {};
    if (!/^\S+@\S+\.\S+$/.test(f.email)) v.email = 'Enter a valid email address';
    if (!f.password) v.password = 'Password is required';
    setErr(v); if (Object.keys(v).length) return;
    setBusy(true);
    try { await signIn({ ...f, portal }); toast.success('Signed in'); nav(admin ? '/admin' : '/cashier', { replace: true }); }
    catch (ex) { setErr({ form: ex.message }); } finally { setBusy(false); }
  };
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-charcoal px-4">
      <div className="absolute right-4 top-4"><ThemeToggle className="text-neutral-300" /></div>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center"><Logo className="h-12 brightness-0 invert" light tagline /></div>
        <form onSubmit={submit} noValidate className="card space-y-4 p-7">
          <div className="text-center"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold-soft dark:bg-surface2"><Icon className="h-6 w-6 text-gold-dark" /></div>
            <h1 className="text-xl font-extrabold">{admin ? 'Admin Sign In' : 'Cashier Sign In'}</h1><p className="mt-1 text-xs text-muted">{admin ? 'Manage products, orders and cashiers.' : 'Sign in to start serving customers.'}</p></div>
          {err.form && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">{err.form}</p>}
          <Field label="Email Address" error={err.email}>{({ id }) => <TextInput id={id} icon={Mail} type="email" autoComplete="username" value={f.email} error={err.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
          <Field label="Password" error={err.password}>{({ id }) => <PasswordInput id={id} icon={Lock} autoComplete="current-password" value={f.password} error={err.password} onChange={(e) => setF({ ...f, password: e.target.value })} />}</Field>
          <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : <>Sign In <ArrowRight className="h-4 w-4" /></>}</button>
        </form>
        <p className="mt-4 text-center text-xs text-neutral-500">© 2026 Wearora. All rights reserved.</p>
      </div>
    </div>
  );
}
