import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ShoppingBag, Trash2 } from 'lucide-react';
import ProductImage from '../../components/ProductImage';
import { EmptyState, PageLoader, Qty } from '../../components/ui';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { money } from '../../utils/format';

export default function Cart() {
  const { cart, loading, setQuantity, remove } = useCart(); const { user } = useAuth(); const toast = useToast(); const nav = useNavigate();
  const [busy, setBusy] = useState(null);
  if (loading) return <PageLoader />;
  const wrap = (key, fn) => async () => { setBusy(key); try { await fn(); } catch (e) { toast.error(e.message); } finally { setBusy(null); } };
  if (!cart.items.length) return (
    <div className="mx-auto max-w-3xl px-4 py-16"><EmptyState icon={ShoppingBag} title="Your cart is empty" text="Discover our latest collections and add your favourites." action={<Link to="/products" className="btn-primary">Browse Products</Link>} /></div>
  );
  const blocked = cart.items.some((i) => i.outOfStock || i.exceedsStock);
  const checkout = () => { if (!user) nav('/signin', { state: { from: '/checkout' } }); else nav('/checkout'); };
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-3xl font-extrabold">Your Cart</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <ul className="space-y-3">
          {cart.items.map((i) => (
            <li key={i.itemId} className="card flex gap-4 p-3 sm:p-4">
              <Link to={`/products/${i.productId}`} className="h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-surface2"><ProductImage src={i.imageSnapshot} alt={i.productNameSnapshot} className="h-full w-full" /></Link>
              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div className="flex justify-between gap-3">
                  <div className="min-w-0"><Link to={`/products/${i.productId}`} className="line-clamp-1 font-heading font-bold hover:text-gold-dark">{i.productNameSnapshot}</Link>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted"><span className="inline-block h-3 w-3 rounded-full border border-line" style={{ background: i.colorHex || '#ddd' }} />{i.color} · Size {i.size}</p>
                    <p className="mt-1 text-sm">{money(i.unitPrice)} {i.unitPrice < i.originalUnitPrice && <span className="text-xs text-muted line-through">{money(i.originalUnitPrice)}</span>}</p></div>
                  <button className="h-8 w-8 shrink-0 rounded-lg text-red-600 hover:bg-red-50" aria-label={`Remove ${i.productNameSnapshot}`} disabled={busy === i.itemId} onClick={wrap(i.itemId, () => remove(i))}><Trash2 className="mx-auto h-4 w-4" /></button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <Qty value={Math.min(i.quantity, Math.max(i.available, 1))} max={Math.max(i.available, 1)} disabled={busy === i.itemId || i.outOfStock} onChange={(q) => wrap(i.itemId, () => setQuantity(i, q))()} />
                  <span className="font-bold">{money(i.subtotal)}</span>
                </div>
                {(i.outOfStock || i.exceedsStock) && <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-600"><AlertTriangle className="h-3.5 w-3.5" />{i.outOfStock ? 'Out of stock – remove to continue' : `Only ${i.available} available – reduce quantity`}</p>}
              </div>
            </li>
          ))}
        </ul>
        <aside className="card h-fit p-5 lg:sticky lg:top-24">
          <h2 className="text-lg font-bold">Order Summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Total Items</dt><dd>{cart.count}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{money(cart.subtotal)}</dd></div>
            {cart.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount</dt><dd>− {money(cart.discount)}</dd></div>}
            <p className="text-xs text-muted">Delivery is calculated at checkout.</p>
          </dl>
          <div className="my-4 h-px bg-line" />
          <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{money(cart.subtotal - cart.discount)}</span></div>
          <button className="btn-primary btn-lg mt-5 w-full" onClick={checkout} disabled={blocked}>Checkout</button>
          {blocked && <p className="mt-2 text-center text-xs text-red-600">Resolve the highlighted items to continue.</p>}
          <Link to="/products" className="mt-3 block text-center text-sm font-semibold text-gold-dark hover:underline">Continue shopping</Link>
        </aside>
      </div>
    </div>
  );
}
