import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Lock, Mail, MailCheck, Phone, ShieldCheck, User } from 'lucide-react';
import { Field, PasswordInput, Spinner, TextInput } from '../../components/ui';
import { api } from '../../services/api';
import { getGoogleIdToken } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const GoogleG = () => (
  <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.5-4.2 7-10.3 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
);

function AuthCard({ icon: Icon, title, subtitle, children, footer }) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-md items-center px-4 py-10">
      <div className="card relative w-full px-6 pb-7 pt-9 sm:px-8">
        {Icon && <div className="absolute -top-7 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full border border-line bg-gold-soft shadow-soft dark:bg-surface2"><Icon className="h-6 w-6 text-gold-dark" /></div>}
        <div className={Icon ? 'pt-3 text-center' : 'text-center'}>
          <h1 className="text-2xl font-extrabold">{title}</h1>
          {subtitle && <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
      </div>
    </div>
  );
}
const SubmitBtn = ({ loading, children }) => (
  <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? <Spinner className="h-4 w-4" /> : <>{children}<ArrowRight className="h-4 w-4" /></>}</button>
);
const Or = () => <div className="my-4 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or continue with<span className="h-px flex-1 bg-line" /></div>;

function GoogleButton({ onDone }) {
  const { google } = useAuth(); const toast = useToast(); const [busy, setBusy] = useState(false);
  const click = async () => {
    setBusy(true);
    try {
      const token = await getGoogleIdToken();
      const r = await google(token);
      toast.success(r.message);
      onDone(r.user);
    } catch (e) {
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return;
      toast.error(e.message || 'Google sign-in failed');
    } finally { setBusy(false); }
  };
  return <button type="button" onClick={click} disabled={busy} className="btn-outline w-full">{busy ? <Spinner className="h-4 w-4" /> : <GoogleG />} Continue with Google</button>;
}

const errOf = (e, k) => e?.errors?.[k];

export function SignIn() {
  const { signIn } = useAuth(); const toast = useToast(); const nav = useNavigate(); const loc = useLocation();
  const [f, setF] = useState({ email: '', password: '', remember: false });
  const [err, setErr] = useState({}); const [loading, setLoading] = useState(false);
  const dest = loc.state?.from || '/products';
  const submit = async (e) => {
    e.preventDefault(); setErr({});
    const v = {};
    if (!/^\S+@\S+\.\S+$/.test(f.email)) v.email = 'Enter a valid email address';
    if (!f.password) v.password = 'Password is required';
    if (Object.keys(v).length) return setErr(v);
    setLoading(true);
    try { await signIn({ ...f, portal: 'customer' }); toast.success('Welcome back!'); nav(dest, { replace: true }); }
    catch (ex) { setErr({ form: ex.message }); } finally { setLoading(false); }
  };
  return (
    <AuthCard title="Welcome Back" subtitle="Sign in to continue your journey." footer={<>Don’t have an account? <Link to="/signup" state={loc.state} className="font-semibold text-gold-dark hover:underline">Create Account</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {err.form && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">{err.form}</p>}
        <Field label="Email Address" error={err.email}>{({ id }) => <TextInput id={id} icon={Mail} type="email" autoComplete="email" placeholder="Email Address" value={f.email} error={err.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
        <Field label="Password" error={err.password}>{({ id }) => <PasswordInput id={id} icon={Lock} autoComplete="current-password" placeholder="Password" value={f.password} error={err.password} onChange={(e) => setF({ ...f, password: e.target.value })} />}</Field>
        <div className="flex items-center justify-between text-sm">
          <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[#C69A52]" checked={f.remember} onChange={(e) => setF({ ...f, remember: e.target.checked })} /> Remember Me</label>
          <Link to="/forgot-password" className="font-semibold text-gold-dark hover:underline">Forgot Password?</Link>
        </div>
        <SubmitBtn loading={loading}>Sign In</SubmitBtn>
      </form>
      <Or />
      <GoogleButton onDone={(u) => nav(u.profileComplete ? dest : '/complete-profile', { replace: true, state: { from: dest } })} />
    </AuthCard>
  );
}

export function SignUp() {
  const { signUp } = useAuth(); const toast = useToast(); const nav = useNavigate(); const loc = useLocation();
  const [f, setF] = useState({ fullName: '', email: '', mobile: '', password: '', confirmPassword: '' });
  const [err, setErr] = useState({}); const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr({});
    const v = {};
    if (f.fullName.trim().length < 2) v.fullName = 'Enter your full name';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) v.email = 'Enter a valid email address';
    if (!/^\+?\d{10,15}$/.test(f.mobile.replace(/[\s\-()]/g, ''))) v.mobile = 'Enter a valid mobile number';
    if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) v.password = 'Min 8 characters with a letter and a number';
    if (f.password !== f.confirmPassword) v.confirmPassword = 'Passwords do not match';
    if (Object.keys(v).length) return setErr(v);
    setLoading(true);
    try { await signUp(f); toast.success('Account created successfully'); nav(loc.state?.from || '/products', { replace: true }); }
    catch (ex) { setErr({ ...(ex.errors || {}), form: ex.errors ? undefined : ex.message }); if (ex.errors?.email) toast.error(ex.message); } finally { setLoading(false); }
  };
  return (
    <AuthCard title="Create Your Account" subtitle="Join Wearora and elevate your style." footer={<>Already have an account? <Link to="/signin" state={loc.state} className="font-semibold text-gold-dark hover:underline">Sign In</Link></>}>
      <form onSubmit={submit} className="space-y-3.5" noValidate>
        {err.form && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{err.form}</p>}
        <Field error={err.fullName}>{({ id }) => <TextInput id={id} icon={User} placeholder="Full Name" autoComplete="name" value={f.fullName} error={err.fullName} onChange={set('fullName')} aria-label="Full Name" />}</Field>
        <Field error={err.email}>{({ id }) => <TextInput id={id} icon={Mail} type="email" placeholder="Email Address" autoComplete="email" value={f.email} error={err.email} onChange={set('email')} aria-label="Email Address" />}</Field>
        <Field error={err.mobile}>{({ id }) => <TextInput id={id} icon={Phone} type="tel" placeholder="Mobile Number" autoComplete="tel" value={f.mobile} error={err.mobile} onChange={set('mobile')} aria-label="Mobile Number" />}</Field>
        <Field error={err.password}>{({ id }) => <PasswordInput id={id} icon={Lock} placeholder="Password" autoComplete="new-password" value={f.password} error={err.password} onChange={set('password')} aria-label="Password" />}</Field>
        <Field error={err.confirmPassword}>{({ id }) => <PasswordInput id={id} icon={Lock} placeholder="Confirm Password" autoComplete="new-password" value={f.confirmPassword} error={err.confirmPassword} onChange={set('confirmPassword')} aria-label="Confirm Password" />}</Field>
        <SubmitBtn loading={loading}>Create Account</SubmitBtn>
      </form>
      <Or />
      <GoogleButton onDone={(u) => nav(u.profileComplete ? (loc.state?.from || '/products') : '/complete-profile', { replace: true })} />
    </AuthCard>
  );
}

export function ForgotPassword() {
  const nav = useNavigate(); const toast = useToast();
  const [email, setEmail] = useState(''); const [err, setErr] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr('Enter a valid email address');
    setErr(''); setLoading(true);
    try {
      const r = await api.post('/auth/forgot-password', { email });
      sessionStorage.setItem('wearora_reset', JSON.stringify({ email: email.trim().toLowerCase(), expires: Date.now() + r.expiresInSeconds * 1000, resendAt: Date.now() + r.resendAfterSeconds * 1000 }));
      toast.success('If this email is registered, a verification code has been sent.');
      nav('/verify-otp');
    } catch (ex) { setErr(ex.message); } finally { setLoading(false); }
  };
  return (
    <AuthCard icon={Lock} title="Forgot Password?" subtitle="Enter your registered email address. We’ll send you a verification code to reset your password."
      footer={<Link to="/signin" className="inline-flex items-center gap-1 font-semibold text-gold-dark hover:underline"><ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In</Link>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field error={err}>{({ id }) => <TextInput id={id} icon={Mail} type="email" placeholder="Email Address" autoComplete="email" value={email} error={err} onChange={(e) => setEmail(e.target.value)} aria-label="Email Address" />}</Field>
        <SubmitBtn loading={loading}>Send OTP</SubmitBtn>
      </form>
    </AuthCard>
  );
}

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export function VerifyOtp() {
  const nav = useNavigate(); const toast = useToast();
  const [state, setState] = useState(() => { try { return JSON.parse(sessionStorage.getItem('wearora_reset')); } catch { return null; } });
  const [otp, setOtp] = useState(''); const [err, setErr] = useState(''); const [loading, setLoading] = useState(false); const [resending, setResending] = useState(false);
  const [now, setNow] = useState(Date.now());
  const input = useRef(null);
  useEffect(() => { if (!state) nav('/forgot-password', { replace: true }); }, [state, nav]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { input.current?.focus(); }, []);
  if (!state) return null;
  const remaining = Math.max(0, Math.round((state.expires - now) / 1000));
  const canResend = now >= state.resendAt;
  const submit = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) return setErr('Enter the 6-digit code');
    if (remaining === 0) return setErr('This code has expired. Please resend a new one.');
    setErr(''); setLoading(true);
    try { await api.post('/auth/verify-otp', { email: state.email, otp }); toast.success('Email verified'); sessionStorage.removeItem('wearora_reset'); nav('/reset-password'); }
    catch (ex) { setErr(ex.message); } finally { setLoading(false); }
  };
  const resend = async () => {
    setResending(true);
    try {
      const r = await api.post('/auth/forgot-password', { email: state.email });
      const next = { ...state, expires: Date.now() + r.expiresInSeconds * 1000, resendAt: Date.now() + r.resendAfterSeconds * 1000 };
      sessionStorage.setItem('wearora_reset', JSON.stringify(next)); setState(next); setOtp(''); setErr('');
      toast.success('A new code has been sent');
    } catch (ex) { toast.error(ex.message); } finally { setResending(false); }
  };
  return (
    <AuthCard icon={MailCheck} title="Verify Your Email" subtitle="We have sent a verification code to your email address. Please check your inbox and spam folder.">
      <form onSubmit={submit} className="space-y-3" noValidate>
        <Field error={err}>{({ id }) => <TextInput id={id} ref={input} icon={ShieldCheck} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Enter 6-Digit OTP" value={otp} error={err} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} className="tracking-[0.4em]" aria-label="6-digit OTP" />}</Field>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Time remaining: <b className={remaining === 0 ? 'text-red-600' : 'text-ink'}>{mmss(remaining)}</b></span>
          <button type="button" className="btn-outline btn-sm" disabled={!canResend || resending} onClick={resend}>{resending ? <Spinner className="h-3.5 w-3.5" /> : 'Resend OTP'}</button>
        </div>
        <SubmitBtn loading={loading}>Verify OTP</SubmitBtn>
      </form>
    </AuthCard>
  );
}

export function ResetPassword() {
  const nav = useNavigate(); const toast = useToast();
  const [f, setF] = useState({ password: '', confirmPassword: '' }); const [err, setErr] = useState({}); const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); const v = {};
    if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) v.password = 'Min 8 characters with a letter and a number';
    if (f.password !== f.confirmPassword) v.confirmPassword = 'Passwords do not match';
    if (Object.keys(v).length) return setErr(v);
    setErr({}); setLoading(true);
    try { await api.post('/auth/reset-password', f); toast.success('Password updated. Please sign in.'); nav('/signin', { replace: true }); }
    catch (ex) { if (ex.status === 401) { toast.error(ex.message); nav('/forgot-password', { replace: true }); } else setErr({ form: ex.message, ...(ex.errors || {}) }); } finally { setLoading(false); }
  };
  return (
    <AuthCard icon={Lock} title="Create New Password" subtitle="Enter your new password below.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {err.form && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{err.form}</p>}
        <Field error={err.password}>{({ id }) => <PasswordInput id={id} icon={Lock} placeholder="New Password" autoComplete="new-password" value={f.password} error={err.password} onChange={(e) => setF({ ...f, password: e.target.value })} aria-label="New Password" />}</Field>
        <Field error={err.confirmPassword}>{({ id }) => <PasswordInput id={id} icon={Lock} placeholder="Confirm New Password" autoComplete="new-password" value={f.confirmPassword} error={err.confirmPassword} onChange={(e) => setF({ ...f, confirmPassword: e.target.value })} aria-label="Confirm New Password" />}</Field>
        <SubmitBtn loading={loading}>Reset Password</SubmitBtn>
      </form>
    </AuthCard>
  );
}
