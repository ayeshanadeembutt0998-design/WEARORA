import { useState } from 'react';
import { KeyRound, Mail, Pencil, Phone, Plus, Power, Search, UserX, Users } from 'lucide-react';
import { Badge, ConfirmDialog, EmptyState, ErrorState, Field, Modal, PageHeader, PasswordInput, Select, Spinner, TableSkeleton, TextInput } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { useDebounce } from '../../hooks/useDebounce';
import { useToast } from '../../context/ToastContext';
import { api, qs } from '../../services/api';
import { fmtDate } from '../../utils/format';

const blank = { fullName: '', email: '', mobile: '', password: '', confirmPassword: '' };

function CashierForm({ open, onClose, cashier, onSaved }) {
  const toast = useToast(); const edit = Boolean(cashier);
  const [f, setF] = useState(blank); const [err, setErr] = useState({}); const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState(null);
  if (open && seen !== (cashier?.id || 'new')) { setSeen(cashier?.id || 'new'); setF(edit ? { ...blank, fullName: cashier.fullName, email: cashier.email, mobile: cashier.mobile } : blank); setErr({}); }
  if (!open && seen !== null) setSeen(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    const v = {};
    if (f.fullName.trim().length < 2) v.fullName = 'Full name is required';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) v.email = 'Enter a valid email';
    if (!/^\+?\d{10,15}$/.test(f.mobile.replace(/[\s\-()]/g, ''))) v.mobile = 'Enter a valid mobile number';
    if (!edit) {
      if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) v.password = 'Min 8 characters with a letter and a number';
      if (f.password !== f.confirmPassword) v.confirmPassword = 'Passwords do not match';
    }
    setErr(v); if (Object.keys(v).length) return;
    setBusy(true);
    try {
      if (edit) await api.patch(`/admin/cashiers/${cashier.id}`, { fullName: f.fullName, email: f.email, mobile: f.mobile });
      else await api.post('/admin/cashiers', f);
      toast.success(edit ? 'Cashier updated' : 'Cashier account created'); onSaved(); onClose();
    } catch (ex) { setErr(ex.errors || {}); toast.error(ex.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={edit ? 'Edit Cashier' : 'Add Cashier'} footer={<><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={submit}>{busy && <Spinner className="h-4 w-4" />}{edit ? 'Save changes' : 'Create cashier'}</button></>}>
      <div className="space-y-4">
        <Field label="Full Name" error={err.fullName}>{({ id }) => <TextInput id={id} value={f.fullName} error={err.fullName} onChange={set('fullName')} />}</Field>
        <Field label="Email Address" error={err.email}>{({ id }) => <TextInput id={id} type="email" value={f.email} error={err.email} onChange={set('email')} />}</Field>
        <Field label="Mobile Number" error={err.mobile}>{({ id }) => <TextInput id={id} type="tel" value={f.mobile} error={err.mobile} onChange={set('mobile')} />}</Field>
        {!edit && (<>
          <Field label="Password" error={err.password}>{({ id }) => <PasswordInput id={id} value={f.password} error={err.password} onChange={set('password')} autoComplete="new-password" />}</Field>
          <Field label="Confirm Password" error={err.confirmPassword}>{({ id }) => <PasswordInput id={id} value={f.confirmPassword} error={err.confirmPassword} onChange={set('confirmPassword')} autoComplete="new-password" />}</Field>
        </>)}
        {edit && <p className="text-xs text-muted">Passwords can’t be viewed. Use “Reset password” to e-mail the cashier a temporary password.</p>}
      </div>
    </Modal>
  );
}

export default function CashierManagement() {
  const toast = useToast();
  const [q, setQ] = useState(''); const dq = useDebounce(q); const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useAsync(() => api.get(`/admin/cashiers${qs({ q: dq, status })}`), [dq, status]);
  const [form, setForm] = useState({ open: false, cashier: null }); const [confirm, setConfirm] = useState(null); const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      if (confirm.type === 'reset') { const r = await api.post(`/admin/cashiers/${confirm.c.id}/reset-password`); toast.success(r.message); }
      else { await api.patch(`/admin/cashiers/${confirm.c.id}/status`, { accountStatus: confirm.c.accountStatus === 'active' ? 'inactive' : 'active' }); toast.success(confirm.c.accountStatus === 'active' ? 'Cashier deactivated' : 'Cashier activated'); }
      setConfirm(null); reload();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const ic = 'rounded-lg p-2 text-muted hover:bg-surface2 hover:text-ink';
  return (
    <div>
      <PageHeader title="Cashier Management" subtitle="Create and manage cashier accounts for the POS." actions={<button className="btn-primary" onClick={() => setForm({ open: true, cashier: null })}><Plus className="h-4 w-4" /> Add Cashier</button>} />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-60 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="input pl-9" placeholder="Search by name, email or mobile" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search cashiers" /></div>
        <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status"><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></Select>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="card overflow-x-auto">
          {loading ? <TableSkeleton /> : data.cashiers.length === 0 ? <div className="p-6"><EmptyState icon={Users} title="No cashiers found" text="Add a cashier so they can use the POS." /></div> : (
            <table className="w-full min-w-[760px]"><thead className="border-b border-line bg-surface2"><tr><th className="th">Cashier</th><th className="th">Contact</th><th className="th">Sales</th><th className="th">Last sign-in</th><th className="th">Status</th><th className="th text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-line">{data.cashiers.map((c) => (
                <tr key={c.id} className="hover:bg-surface2/60">
                  <td className="td"><p className="font-semibold">{c.fullName}</p><p className="text-xs text-muted">Since {fmtDate(c.createdAt)}</p></td>
                  <td className="td text-xs"><p className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-muted" />{c.email}</p><p className="mt-0.5 flex items-center gap-1.5"><Phone className="h-3 w-3 text-muted" />{c.mobile}</p></td>
                  <td className="td font-semibold">{c.salesCount}</td>
                  <td className="td text-xs text-muted">{c.lastLoginAt ? fmtDate(c.lastLoginAt, true) : 'Never'}</td>
                  <td className="td"><Badge tone={c.accountStatus === 'active' ? 'green' : 'red'}>{c.accountStatus === 'active' ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="td"><div className="flex justify-end gap-1">
                    <button className={ic} title="Edit" aria-label={`Edit ${c.fullName}`} onClick={() => setForm({ open: true, cashier: c })}><Pencil className="h-4 w-4" /></button>
                    <button className={ic} title="Reset password" aria-label={`Reset password for ${c.fullName}`} onClick={() => setConfirm({ type: 'reset', c })}><KeyRound className="h-4 w-4" /></button>
                    <button className={ic} title={c.accountStatus === 'active' ? 'Deactivate' : 'Activate'} aria-label="Toggle status" onClick={() => setConfirm({ type: 'status', c })}>{c.accountStatus === 'active' ? <UserX className="h-4 w-4 text-red-600" /> : <Power className="h-4 w-4 text-emerald-600" />}</button>
                  </div></td>
                </tr>))}</tbody></table>)}
        </div>)}
      <CashierForm open={form.open} cashier={form.cashier} onClose={() => setForm({ open: false, cashier: null })} onSaved={reload} />
      <ConfirmDialog open={Boolean(confirm)} loading={busy} danger={confirm?.type === 'status' && confirm?.c.accountStatus === 'active'} onClose={() => setConfirm(null)} onConfirm={run}
        title={confirm?.type === 'reset' ? 'Reset password?' : confirm?.c.accountStatus === 'active' ? 'Deactivate cashier?' : 'Activate cashier?'}
        confirmLabel={confirm?.type === 'reset' ? 'Send temporary password' : confirm?.c.accountStatus === 'active' ? 'Deactivate' : 'Activate'}
        message={confirm?.type === 'reset' ? `A random temporary password will be e-mailed to ${confirm?.c.email}. You will not see it. They must change it at next sign-in.` : confirm?.c.accountStatus === 'active' ? `${confirm?.c.fullName} will no longer be able to sign in. Their sales history is kept.` : `${confirm?.c.fullName} will be able to sign in again.`} />
    </div>
  );
}
