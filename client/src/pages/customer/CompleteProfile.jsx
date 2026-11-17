import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { Field, Spinner, TextInput } from '../../components/ui';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function CompleteProfile() {
  const { user, setUser } = useAuth(); const nav = useNavigate(); const loc = useLocation(); const toast = useToast();
  const [mobile, setMobile] = useState(user.mobile || ''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!/^\+?\d{10,15}$/.test(mobile.replace(/[\s\-()]/g, ''))) return setErr('Enter a valid mobile number');
    setBusy(true);
    try { const r = await api.patch('/users/profile', { mobile }); setUser(r.user); toast.success('Profile completed'); nav(loc.state?.from || '/products', { replace: true }); }
    catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center px-4 py-10"><form onSubmit={submit} className="card w-full space-y-4 p-8" noValidate>
      <div><h1 className="text-2xl font-extrabold">Complete your profile</h1><p className="mt-1 text-sm text-muted">Welcome, {user.fullName}. Please add your mobile number so we can reach you about your orders.</p></div>
      <Field label="Mobile Number" error={err}>{({ id }) => <TextInput id={id} icon={Phone} type="tel" value={mobile} error={err} onChange={(e) => setMobile(e.target.value)} placeholder="03XX XXXXXXX" autoFocus />}</Field>
      <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : 'Continue'}</button>
    </form></div>
  );
}
