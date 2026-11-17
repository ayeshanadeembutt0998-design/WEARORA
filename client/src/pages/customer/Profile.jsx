import { useEffect, useRef, useState } from 'react';
import { Lock, Mail, MapPin, Phone, ShieldCheck, User } from 'lucide-react';
import { Field, Modal, PasswordInput, Spinner, TextInput } from '../../components/ui';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

function EmailChange({ open, onClose }) {
  const { setUser } = useAuth(); const toast = useToast();
  const [step, setStep] = useState(1); const [email, setEmail] = useState(''); const [otp, setOtp] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setStep(1); setEmail(''); setOtp(''); setErr(''); } }, [open]);
  const send = async () => { setBusy(true); setErr(''); try { await api.post('/users/email-change', { newEmail: email }); setStep(2); toast.success('Verification code sent to your new email'); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  const verify = async () => { setBusy(true); setErr(''); try { const r = await api.post('/users/email-change/verify', { otp }); setUser(r.user); toast.success('Email updated'); onClose(); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  return (
    <Modal open={open} onClose={onClose} title="Change email address" size="sm" footer={<><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || (step === 1 ? !email : otp.length !== 6)} onClick={step === 1 ? send : verify}>{busy && <Spinner className="h-4 w-4" />}{step === 1 ? 'Send code' : 'Verify & update'}</button></>}>
      {step === 1 ? <Field label="New email address" error={err}>{({ id }) => <TextInput id={id} icon={Mail} type="email" value={email} error={err} onChange={(e) => setEmail(e.target.value)} />}</Field>
        : <Field label={`Enter the 6-digit code sent to ${email}`} error={err}>{({ id }) => <TextInput id={id} icon={ShieldCheck} inputMode="numeric" maxLength={6} value={otp} error={err} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} className="tracking-[0.4em]" />}</Field>}
    </Modal>
  );
}

export default function Profile() {
  const { user, setUser } = useAuth(); const toast = useToast();
  const [f, setF] = useState({ fullName: user.fullName, mobile: user.mobile || '', line1: user.address?.line1 || '', city: user.address?.city || '' });
  const [err, setErr] = useState({}); const [busy, setBusy] = useState(false); const [emailOpen, setEmailOpen] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' }); const [pwErr, setPwErr] = useState({}); const [pwBusy, setPwBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault(); const v = {};
    if (f.fullName.trim().length < 2) v.fullName = 'Enter your full name';
    if (!/^\+?\d{10,15}$/.test(f.mobile.replace(/[\s\-()]/g, ''))) v.mobile = 'Enter a valid mobile number';
    setErr(v); if (Object.keys(v).length) return;
    setBusy(true);
    try { const r = await api.patch('/users/profile', { fullName: f.fullName, mobile: f.mobile, address: { line1: f.line1, city: f.city } }); setUser(r.user); toast.success('Profile updated'); } catch (ex) { toast.error(ex.message); } finally { setBusy(false); }
  };
  const changePw = async (e) => {
    e.preventDefault(); const v = {};
    if (user.authProvider === 'local' && !pw.currentPassword) v.currentPassword = 'Required';
    if (pw.newPassword.length < 8 || !/[A-Za-z]/.test(pw.newPassword) || !/\d/.test(pw.newPassword)) v.newPassword = 'Min 8 characters with a letter and a number';
    if (pw.newPassword !== pw.confirmPassword) v.confirmPassword = 'Passwords do not match';
    setPwErr(v); if (Object.keys(v).length) return;
    setPwBusy(true);
    try { const r = await api.patch('/users/change-password', pw); setUser(r.user); setPw({ currentPassword: '', newPassword: '', confirmPassword: '' }); toast.success('Password changed'); } catch (ex) { setPwErr(ex.errors || { currentPassword: ex.message }); toast.error(ex.message); } finally { setPwBusy(false); }
  };
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-extrabold">My Profile</h1>
      <form onSubmit={save} className="card space-y-4 p-6" noValidate>
        <h2 className="text-lg font-bold">Personal details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full Name" error={err.fullName}>{({ id }) => <TextInput id={id} icon={User} value={f.fullName} error={err.fullName} onChange={set('fullName')} />}</Field>
          <Field label="Mobile Number" error={err.mobile}>{({ id }) => <TextInput id={id} icon={Phone} value={f.mobile} error={err.mobile} onChange={set('mobile')} />}</Field>
          <Field label="Email Address" className="sm:col-span-2" hint="Changing your email requires verification.">{({ id }) => (<div className="flex gap-2"><TextInput id={id} icon={Mail} value={user.email} disabled readOnly /><button type="button" className="btn-outline shrink-0" onClick={() => setEmailOpen(true)}>Change</button></div>)}</Field>
          <Field label="Address">{({ id }) => <TextInput id={id} icon={MapPin} value={f.line1} onChange={set('line1')} placeholder="House no., street, area" />}</Field>
          <Field label="City">{({ id }) => <TextInput id={id} value={f.city} onChange={set('city')} />}</Field>
        </div>
        <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Save changes</button>
      </form>
      <form onSubmit={changePw} className="card space-y-4 p-6" noValidate>
        <h2 className="text-lg font-bold">{user.authProvider === 'google' ? 'Set a password' : 'Change password'}</h2>
        {user.authProvider === 'local' && <Field label="Current Password" error={pwErr.currentPassword}>{({ id }) => <PasswordInput id={id} icon={Lock} value={pw.currentPassword} error={pwErr.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} autoComplete="current-password" />}</Field>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New Password" error={pwErr.newPassword}>{({ id }) => <PasswordInput id={id} icon={Lock} value={pw.newPassword} error={pwErr.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} autoComplete="new-password" />}</Field>
          <Field label="Confirm New Password" error={pwErr.confirmPassword}>{({ id }) => <PasswordInput id={id} icon={Lock} value={pw.confirmPassword} error={pwErr.confirmPassword} onChange={(e) => setPw({ ...pw, confirmPassword: e.target.value })} autoComplete="new-password" />}</Field>
        </div>
        <button className="btn-outline" disabled={pwBusy}>{pwBusy && <Spinner className="h-4 w-4" />} Update password</button>
      </form>
      <EmailChange open={emailOpen} onClose={() => setEmailOpen(false)} />
    </div>
  );
}
