import { useState } from 'react';
import { ClipboardList, Eye, Search } from 'lucide-react';
import ProductImage from '../../components/ProductImage';
import { Badge, Drawer, EmptyState, ErrorState, OrderStatusBadge, PageHeader, Pagination, PayStatusBadge, Select, Spinner, TableSkeleton } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { useDebounce } from '../../hooks/useDebounce';
import { useToast } from '../../context/ToastContext';
import { api, qs } from '../../services/api';
import { DELIVERY_LABEL, PAYMENT_LABEL, REASON_LABEL, STATUS_LABEL, fmtDate, money } from '../../utils/format';
import { Timeline } from '../customer/OrderDetails';

const NEXT_LABEL = { confirmed: 'Confirm order', processing: 'Start processing', shipped: 'Mark as shipped', ready_for_pickup: 'Mark ready for pickup', delivered: 'Mark as delivered', cancelled: 'Cancel order' };

function OrderDrawer({ id, onClose, onChanged }) {
  const toast = useToast(); const [busy, setBusy] = useState(null); const [note, setNote] = useState('');
  const { data, loading, error, reload } = useAsync(() => (id ? api.get(`/admin/orders/${id}`) : Promise.resolve(null)), [id]);
  const change = async (status) => {
    if (status === 'cancelled' && !window.confirm('Cancel this order? Stock will be restored and the customer notified.')) return;
    setBusy(status);
    try { await api.patch(`/admin/orders/${id}/status`, { status, note: note || undefined }); toast.success(`Order marked as ${STATUS_LABEL[status].toLowerCase()}`); setNote(''); reload(); onChanged(); }
    catch (e) { toast.error(e.message); reload(); } finally { setBusy(null); }
  };
  const o = data?.order; const d = o?.deliveryInformation || {}; const c = o?.customerSnapshot || {};
  return (
    <Drawer open={Boolean(id)} onClose={onClose} title={o ? o.orderNumber : 'Order'} width="max-w-2xl">
      {loading ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-gold" /></div> : error ? <ErrorState message={error} onRetry={reload} /> : o && (
        <div className="space-y-5 text-sm">
          <div className="flex flex-wrap items-center gap-2"><Badge tone={o.orderType === 'pos' ? 'purple' : 'blue'}>{o.orderType === 'pos' ? 'POS' : 'Online'}</Badge><OrderStatusBadge status={o.orderStatus} /><PayStatusBadge status={o.paymentStatus} /><span className="text-xs text-muted">{fmtDate(o.createdAt, true)}</span></div>
          {o.orderType === 'online' && <div className="rounded-xl border border-line p-4"><Timeline order={o} /></div>}
          {o.orderType === 'online' && o.allowedNext.length > 0 && (
            <div className="rounded-xl border border-gold/50 bg-gold-soft/30 p-4 dark:bg-gold/5"><p className="mb-2 font-bold">Update status</p>
              <input className="input mb-3" placeholder="Internal note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} aria-label="Status note" />
              <div className="flex flex-wrap gap-2">{o.allowedNext.map((s) => <button key={s} disabled={Boolean(busy)} onClick={() => change(s)} className={s === 'cancelled' ? 'btn-danger btn-sm' : 'btn-primary btn-sm'}>{busy === s && <Spinner className="h-3.5 w-3.5" />}{NEXT_LABEL[s]}</button>)}</div>
              <p className="mt-2 text-xs text-muted">The customer is e-mailed automatically on each change.</p></div>)}
          {o.orderType === 'pos' && <p className="rounded-lg bg-surface2 px-3 py-2 text-xs text-muted">In-store transactions are final records and cannot be edited. Refunds happen through Returns & Exchanges.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line p-4"><p className="mb-1 font-bold">Customer</p><p>{c.fullName || 'Walk-in customer'}</p><p className="text-muted">{c.mobile}</p><p className="text-muted">{c.email}</p></div>
            <div className="rounded-xl border border-line p-4"><p className="mb-1 font-bold">{DELIVERY_LABEL[o.deliveryMethod]}</p>{o.orderType === 'online' && o.deliveryMethod === 'home' ? <p className="text-muted">{d.address}, {d.city}<br />{d.mobile}{d.instructions && <><br />Note: {d.instructions}</>}</p> : o.orderType === 'pos' ? <p className="text-muted">Cashier: {o.cashierName}</p> : <p className="text-muted">Customer collects from store</p>}</div>
          </div>
          <div><p className="mb-2 font-bold">Items</p><div className="divide-y divide-line rounded-xl border border-line">{o.items.map((i) => (
            <div key={i._id} className="flex items-center gap-3 p-3"><div className="h-14 w-11 shrink-0 overflow-hidden rounded bg-surface2"><ProductImage src={i.imageSnapshot} alt="" className="h-full w-full" /></div>
              <div className="flex-1"><p className="font-semibold">{i.productNameSnapshot}</p><p className="text-xs text-muted">{i.color} · {i.size} · {i.quantity} × {money(i.unitPrice)}{i.returnedQty > 0 && <span className="ml-2 text-amber-600">({i.returnedQty} returned)</span>}</p></div><p className="font-bold">{money(i.subtotal)}</p></div>))}</div></div>
          <dl className="space-y-1 rounded-xl border border-line p-4">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{money(o.subtotal)}</dd></div>
            {o.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount</dt><dd>− {money(o.discount)}</dd></div>}
            {o.orderType === 'online' && <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>{o.deliveryCharge ? money(o.deliveryCharge) : 'Free'}</dd></div>}
            <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><dt>Total</dt><dd>{money(o.total)}</dd></div>
            <div className="flex justify-between text-xs text-muted"><dt>Payment</dt><dd>{PAYMENT_LABEL[o.paymentMethod]}</dd></div></dl>
          {data.payments.length > 0 && <div><p className="mb-2 font-bold">Payments</p><ul className="divide-y divide-line rounded-xl border border-line">{data.payments.map((p) => <li key={p._id} className="flex justify-between px-3 py-2 text-xs"><span><b className="capitalize">{p.kind.replace('_', ' ')}</b> · {PAYMENT_LABEL[p.method]} · <span className="font-mono">{p.transactionReference}</span></span><span className="font-semibold">{money(p.amount)}</span></li>)}</ul></div>}
          {data.returns.length > 0 && <div><p className="mb-2 font-bold">Returns & exchanges</p><ul className="space-y-2">{data.returns.map((r) => <li key={r._id} className="rounded-xl border border-line p-3 text-xs"><div className="flex justify-between"><b>{r.referenceNumber}</b><Badge tone={r.transactionType === 'exchange' ? 'purple' : 'amber'}>{r.transactionType}</Badge></div><p className="mt-1 text-muted">{REASON_LABEL[r.returnReason]} · {fmtDate(r.createdAt, true)}</p>{r.refundAmount > 0 && <p>Refunded {money(r.refundAmount)}</p>}{r.additionalPayment > 0 && <p>Collected {money(r.additionalPayment)}</p>}</li>)}</ul></div>}
          {o.statusHistory?.length > 0 && <div><p className="mb-2 font-bold">History</p><ul className="space-y-1 text-xs text-muted">{o.statusHistory.map((h, i) => <li key={i}>{fmtDate(h.at, true)} — <b className="text-ink">{STATUS_LABEL[h.status]}</b>{h.note ? ` (${h.note})` : ''}</li>)}</ul></div>}
        </div>)}
    </Drawer>
  );
}

export default function OrdersManagement() {
  const [q, setQ] = useState(''); const dq = useDebounce(q); const [type, setType] = useState(''); const [date, setDate] = useState(''); const [pay, setPay] = useState(''); const [st, setSt] = useState(''); const [page, setPage] = useState(1); const [open, setOpen] = useState(null);
  const { data, loading, error, reload } = useAsync(() => api.get(`/admin/orders${qs({ q: dq, orderType: type, date, paymentStatus: pay, orderStatus: st, page, limit: 12 })}`), [dq, type, date, pay, st, page]);
  const f = (setter) => (e) => { setter(e.target.value); setPage(1); };
  return (
    <div>
      <PageHeader title="Orders Management" subtitle="Online orders and in-store POS transactions in one place." />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="input pl-9" placeholder="Search by order / receipt number" value={q} onChange={f(setQ)} aria-label="Search orders" /></div>
        <Select className="w-36" value={type} onChange={f(setType)} aria-label="Order type"><option value="">All types</option><option value="online">Online</option><option value="pos">POS</option></Select>
        <Select className="w-44" value={st} onChange={f(setSt)} aria-label="Order status"><option value="">All order statuses</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Select className="w-44" value={pay} onChange={f(setPay)} aria-label="Payment status"><option value="">All payment statuses</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="refunded">Refunded</option><option value="partially_refunded">Partially refunded</option></Select>
        <input type="date" className="input w-40" value={date} onChange={f(setDate)} aria-label="Date" />
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="card overflow-x-auto">
          {loading ? <TableSkeleton cols={7} /> : data.orders.length === 0 ? <div className="p-6"><EmptyState icon={ClipboardList} title="No orders found" text="Orders will appear here as customers and cashiers make purchases." /></div> : (
            <table className="w-full min-w-[860px]"><thead className="border-b border-line bg-surface2"><tr><th className="th">Order</th><th className="th">Type</th><th className="th">Customer</th><th className="th">Total</th><th className="th">Payment</th><th className="th">Status</th><th className="th text-right">View</th></tr></thead>
              <tbody className="divide-y divide-line">{data.orders.map((o) => (
                <tr key={o.id} className="cursor-pointer hover:bg-surface2/60" onClick={() => setOpen(o.id)}>
                  <td className="td"><p className="font-semibold">{o.orderNumber}</p><p className="text-xs text-muted">{fmtDate(o.createdAt, true)}</p></td>
                  <td className="td"><Badge tone={o.orderType === 'pos' ? 'purple' : 'blue'}>{o.orderType === 'pos' ? 'POS' : 'Online'}</Badge></td>
                  <td className="td text-xs">{o.customerSnapshot?.fullName || <span className="text-muted">Walk-in</span>}<p className="text-muted">{o.customerSnapshot?.mobile}</p></td>
                  <td className="td font-semibold">{money(o.total)}</td>
                  <td className="td"><PayStatusBadge status={o.paymentStatus} /><p className="mt-0.5 text-[11px] text-muted">{PAYMENT_LABEL[o.paymentMethod]}</p></td>
                  <td className="td"><OrderStatusBadge status={o.orderStatus} /></td>
                  <td className="td text-right"><button className="rounded-lg p-2 text-muted hover:bg-surface2" aria-label={`View ${o.orderNumber}`}><Eye className="h-4 w-4" /></button></td>
                </tr>))}</tbody></table>)}
        </div>)}
      {data && <Pagination page={data.pagination.page} pages={data.pagination.pages} onChange={setPage} />}
      <OrderDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} />
    </div>
  );
}
