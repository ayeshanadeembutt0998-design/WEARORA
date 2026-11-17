import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, ChevronLeft, XCircle } from 'lucide-react';
import ProductImage from '../../components/ProductImage';
import { ConfirmDialog, ErrorState, OrderStatusBadge, PageLoader, PayStatusBadge } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { DELIVERY_LABEL, PAYMENT_LABEL, STATUS_LABEL, cx, fmtDate, money } from '../../utils/format';

const FLOW = { home: ['pending', 'confirmed', 'processing', 'shipped', 'delivered'], pickup: ['pending', 'confirmed', 'processing', 'ready_for_pickup', 'delivered'] };

export function Timeline({ order }) {
  if (order.orderStatus === 'cancelled') return <p className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300"><XCircle className="h-4 w-4" /> This order was cancelled.</p>;
  const steps = FLOW[order.deliveryMethod] || FLOW.home; const idx = steps.indexOf(order.orderStatus);
  return (
    <ol className="flex items-start justify-between gap-1 overflow-x-auto pb-1">
      {steps.map((s, i) => (
        <li key={s} className="flex min-w-[64px] flex-1 flex-col items-center text-center">
          <div className="flex w-full items-center"><span className={cx('h-0.5 flex-1', i === 0 ? 'opacity-0' : i <= idx ? 'bg-gold' : 'bg-line')} />
            <span className={cx('flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs', i <= idx ? 'border-gold bg-gold text-charcoal' : 'border-line bg-surface text-muted')}>{i <= idx ? <Check className="h-4 w-4" /> : i + 1}</span>
            <span className={cx('h-0.5 flex-1', i === steps.length - 1 ? 'opacity-0' : i < idx ? 'bg-gold' : 'bg-line')} /></div>
          <span className={cx('mt-1.5 text-[11px] font-semibold', i <= idx ? 'text-ink' : 'text-muted')}>{STATUS_LABEL[s]}</span>
        </li>))}
    </ol>
  );
}

export default function OrderDetails() {
  const { id } = useParams(); const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => api.get(`/orders/${id}`), [id]);
  const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false);
  if (loading) return <PageLoader />;
  if (error) return <div className="mx-auto max-w-3xl p-6"><ErrorState message={error} onRetry={reload} /></div>;
  const o = data.order; const d = o.deliveryInformation || {};
  const cancel = async () => { setBusy(true); try { await api.patch(`/orders/${id}/cancel`); toast.success('Order cancelled'); setConfirm(false); reload(); } catch (e) { toast.error(e.message); } finally { setBusy(false); } };
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link to="/orders" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-gold-dark"><ChevronLeft className="h-4 w-4" /> My Orders</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-extrabold">{o.orderNumber}</h1><p className="text-sm text-muted">Placed on {fmtDate(o.createdAt, true)}</p></div>
        <div className="flex items-center gap-2"><OrderStatusBadge status={o.orderStatus} /><PayStatusBadge status={o.paymentStatus} /></div></div>
      <section className="card mb-5 p-5"><Timeline order={o} /></section>
      <div className="grid gap-5 md:grid-cols-[1fr_300px]">
        <section className="card divide-y divide-line">
          {o.items.map((i) => (
            <div key={i._id} className="flex gap-3 p-4"><div className="h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-surface2"><ProductImage src={i.imageSnapshot} alt="" className="h-full w-full" /></div>
              <div className="flex-1"><p className="font-heading font-bold">{i.productNameSnapshot}</p><p className="text-xs text-muted">{i.color} · Size {i.size}</p><p className="mt-1 text-sm">{money(i.unitPrice)} × {i.quantity}</p></div>
              <p className="font-bold">{money(i.subtotal)}</p></div>))}
        </section>
        <div className="space-y-5">
          <section className="card p-5 text-sm"><h2 className="mb-3 font-bold">Summary</h2>
            <dl className="space-y-1.5"><div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{money(o.subtotal)}</dd></div>
              {o.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount</dt><dd>− {money(o.discount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>{o.deliveryCharge ? money(o.deliveryCharge) : 'Free'}</dd></div>
              <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><dt>Total</dt><dd>{money(o.total)}</dd></div></dl>
            <p className="mt-3 text-xs text-muted">{PAYMENT_LABEL[o.paymentMethod]}</p></section>
          <section className="card p-5 text-sm"><h2 className="mb-2 font-bold">{DELIVERY_LABEL[o.deliveryMethod]}</h2>
            {o.deliveryMethod === 'home' ? <address className="not-italic text-muted">{d.fullName}<br />{d.address}<br />{d.city}<br />{d.mobile}</address> : <p className="text-muted">Collect from our store. We will email you when it is ready.</p>}
            {d.estimatedFrom && !['delivered', 'cancelled'].includes(o.orderStatus) && <p className="mt-2 text-xs"><b>Estimated:</b> {fmtDate(d.estimatedFrom)} – {fmtDate(d.estimatedTo)}</p>}</section>
          {['pending', 'confirmed'].includes(o.orderStatus) && <button className="btn-danger w-full" onClick={() => setConfirm(true)}>Cancel Order</button>}
        </div>
      </div>
      <ConfirmDialog open={confirm} danger loading={busy} title="Cancel this order?" message="The items will be returned to stock. This cannot be undone." confirmLabel="Yes, cancel order" onConfirm={cancel} onClose={() => setConfirm(false)} />
    </div>
  );
}
