import { Link } from 'react-router-dom';
import { PackageOpen } from 'lucide-react';
import { EmptyState, ErrorState, OrderStatusBadge, PageLoader, PayStatusBadge } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { api } from '../../services/api';
import { fmtDate, money } from '../../utils/format';

export default function MyOrders() {
  const { data, loading, error, reload } = useAsync(() => api.get('/orders/my-orders'), []);
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-3xl font-extrabold">My Orders</h1>
      {loading ? <PageLoader /> : error ? <ErrorState message={error} onRetry={reload} /> : data.orders.length === 0 ? (
        <EmptyState icon={PackageOpen} title="No orders yet" text="When you place an order it will appear here." action={<Link to="/products" className="btn-primary">Start Shopping</Link>} />
      ) : (
        <ul className="space-y-3">{data.orders.map((o) => (
          <li key={o.id} className="card flex flex-wrap items-center justify-between gap-4 p-4">
            <div><p className="font-heading font-bold">{o.orderNumber}</p><p className="text-xs text-muted">{fmtDate(o.createdAt, true)} · {o.itemCount} item{o.itemCount === 1 ? '' : 's'}</p>
              <div className="mt-2 flex gap-2"><OrderStatusBadge status={o.orderStatus} /><PayStatusBadge status={o.paymentStatus} /></div></div>
            <div className="text-right"><p className="text-lg font-bold">{money(o.total)}</p><Link to={`/orders/${o.id}`} className="btn-outline btn-sm mt-2">View Details</Link></div>
          </li>))}</ul>
      )}
    </div>
  );
}
