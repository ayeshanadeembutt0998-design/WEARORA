import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BadgeCheck, ShieldX } from 'lucide-react';
import { PageLoader } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { api } from '../../services/api';
import { fmtDate, money } from '../../utils/format';

export default function VerifyReceipt() {
  const { number } = useParams(); const [sp] = useSearchParams();
  const { data, loading } = useAsync(() => api.get(`/pos/receipts/${encodeURIComponent(number)}/verify?token=${encodeURIComponent(sp.get('token') || '')}`).catch(() => ({ valid: false })), [number]);
  if (loading) return <PageLoader label="Verifying receipt…" />;
  const r = data.receipt;
  return (
    <div className="mx-auto max-w-md px-4 py-14"><div className="card p-8 text-center">
      {data.valid ? (<>
        <BadgeCheck className="mx-auto h-14 w-14 text-emerald-600" /><h1 className="mt-3 text-2xl font-extrabold">Genuine Wearora receipt</h1>
        <dl className="mt-5 divide-y divide-line rounded-xl border border-line text-left text-sm">
          {[['Receipt', r.receiptNumber], ['Date', fmtDate(r.date, true)], ['Items', r.itemCount], ['Total', money(r.total)]].map(([k, v]) => <div key={k} className="flex justify-between px-4 py-2.5"><dt className="text-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
        </dl></>) : (<><ShieldX className="mx-auto h-14 w-14 text-red-600" /><h1 className="mt-3 text-2xl font-extrabold">Receipt not verified</h1><p className="mt-2 text-sm text-muted">We couldn’t verify this receipt. It may be invalid or altered.</p></>)}
      <Link to="/products" className="btn-outline mt-6">Visit Wearora</Link>
    </div></div>
  );
}
