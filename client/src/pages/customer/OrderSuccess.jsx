import { Link, useParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { ErrorState, PageLoader, OrderStatusBadge, PayStatusBadge } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { api } from '../../services/api';
import { DELIVERY_LABEL, PAYMENT_LABEL, fmtDate, money } from '../../utils/format';

export default function OrderSuccess() {
  const { id } = useParams();
  const { data, loading, error, reload } = useAsync(() => api.get(`/orders/${id}`), [id]);
  if (loading) return <PageLoader />;
  if (error) return <div className="mx-auto max-w-xl p-6"><ErrorState message={error} onRetry={reload} /></div>;
  const o = data.order;
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="card p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/50"><CheckCircle2 className="h-9 w-9 text-emerald-600" /></div>
        <h1 className="text-3xl font-extrabold">Order Placed</h1>
        <p className="mt-2 text-sm text-muted">Thank you for shopping with Wearora. A confirmation email is on its way to {o.deliveryInformation?.email}.</p>
        <dl className="mt-6 divide-y divide-line rounded-xl border border-line text-left text-sm">
          {[['Order number', <b key="n">{o.orderNumber}</b>], ['Date', fmtDate(o.createdAt, true)], ['Total', <b key="t">{money(o.total)}</b>], ['Payment', PAYMENT_LABEL[o.paymentMethod]], ['Payment status', <PayStatusBadge key="p" status={o.paymentStatus} />], ['Delivery', DELIVERY_LABEL[o.deliveryMethod]], ['Status', <OrderStatusBadge key="s" status={o.orderStatus} />]]
            .map(([k, v]) => <div key={k} className="flex items-center justify-between px-4 py-2.5"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>)}
        </dl>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link to={`/orders/${o.id}`} className="btn-primary">View Order</Link><Link to="/products" className="btn-outline">Continue Shopping</Link>
        </div>
      </div>
    </div>
  );
}
