import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreditCard, Home, Lock, ShoppingBag, Store, Truck, Wallet } from 'lucide-react';
import ProductImage from '../../components/ProductImage';
import { EmptyState, Field, PageLoader, Spinner, TextInput } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { api } from '../../services/api';
import { cx, money, uuid } from '../../utils/format';

const Option = ({ checked, onChange, icon: Icon, title, text, disabled }) => (
  <label className={cx('flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition', checked ? 'border-gold bg-gold-soft/50 dark:bg-gold/10' : 'border-line hover:border-gold/60', disabled && 'opacity-50')}>
    <input type="radio" className="mt-1 accent-[#C69A52]" checked={checked} onChange={onChange} disabled={disabled} />
    <Icon className="mt-0.5 h-5 w-5 text-gold-dark" /><span><span className="block text-sm font-bold">{title}</span><span className="text-xs text-muted">{text}</span></span>
  </label>
);

export default function Checkout() {
  const { user } = useAuth(); const { cart, loading, deliveryMethod, setDeliveryMethod, reload } = useCart(); const toast = useToast(); const nav = useNavigate();
  const { data: cfg } = useAsync(() => api.get('/config'), []);
  const [f, setF] = useState({ fullName: user.fullName, mobile: user.mobile || '', email: user.email, city: user.address?.city || '', address: user.address?.line1 || '', instructions: '' });
  const [payment, setPayment] = useState('cod'); const [simFail, setSimFail] = useState(false);
  const [err, setErr] = useState({}); const [busy, setBusy] = useState(false);
  const key = useRef(uuid());
  useEffect(() => { reload(); }, []); // eslint-disable-line
  useEffect(() => { if (cfg && !cfg.store.pickupEnabled && deliveryMethod === 'pickup') setDeliveryMethod('home'); }, [cfg]); // eslint-disable-line
  if (loading) return <PageLoader />;
  if (!cart.items.length) return <div className="mx-auto max-w-3xl px-4 py-16"><EmptyState icon={ShoppingBag} title="Your cart is empty" action={<Link to="/products" className="btn-primary">Browse Products</Link>} /></div>;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const home = deliveryMethod === 'home';
  const blocked = cart.items.some((i) => i.outOfStock || i.exceedsStock);

  const submit = async (e) => {
    e.preventDefault(); const v = {};
    if (f.fullName.trim().length < 2) v.fullName = 'Full name is required';
    if (!/^\+?\d{10,15}$/.test(f.mobile.replace(/[\s\-()]/g, ''))) v.mobile = 'Enter a valid mobile number';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) v.email = 'Enter a valid email';
    if (home && f.city.trim().length < 2) v.city = 'City is required';
    if (home && f.address.trim().length < 5) v.address = 'Complete delivery address is required';
    setErr(v); if (Object.keys(v).length) return toast.error('Please complete the highlighted fields');
    setBusy(true);
    try {
      const r = await api.post('/orders', { deliveryMethod, paymentMethod: payment, delivery: f, idempotencyKey: key.current, simulateOutcome: payment === 'online' ? (simFail ? 'failure' : 'success') : undefined });
      await reload();
      toast.success('Order placed successfully');
      nav(`/order-success/${r.order.id}`, { replace: true });
    } catch (ex) {
      toast.error(ex.message);
      if (ex.code === 'STOCK_UNAVAILABLE') { await reload(); nav('/cart'); }
      if (ex.errors) setErr(ex.errors);
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-3xl font-extrabold">Checkout</h1>
      <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card p-5"><h2 className="mb-4 text-lg font-bold">Delivery Method</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Option checked={home} onChange={() => setDeliveryMethod('home')} icon={Truck} title="Home Delivery" text="Delivered in 3–5 business days" />
              {cfg?.store.pickupEnabled !== false && <Option checked={!home} onChange={() => setDeliveryMethod('pickup')} icon={Store} title="Store Pickup" text="Collect from our store, no delivery fee" />}
            </div></section>
          <section className="card p-5"><h2 className="mb-4 text-lg font-bold">{home ? 'Delivery Information' : 'Contact Information'}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full Name" error={err.fullName}>{({ id }) => <TextInput id={id} value={f.fullName} error={err.fullName} onChange={set('fullName')} autoComplete="name" />}</Field>
              <Field label="Mobile Number" error={err.mobile}>{({ id }) => <TextInput id={id} type="tel" value={f.mobile} error={err.mobile} onChange={set('mobile')} autoComplete="tel" />}</Field>
              <Field label="Email Address" error={err.email} className="sm:col-span-2">{({ id }) => <TextInput id={id} type="email" value={f.email} error={err.email} onChange={set('email')} autoComplete="email" hint="Order updates are sent here" />}</Field>
              {home && (<>
                <Field label="City" error={err.city}>{({ id }) => <TextInput id={id} value={f.city} error={err.city} onChange={set('city')} autoComplete="address-level2" />}</Field>
                <Field label="Complete Address" error={err.address} className="sm:col-span-2">{({ id }) => <TextInput id={id} value={f.address} error={err.address} onChange={set('address')} autoComplete="street-address" placeholder="House no., street, area" />}</Field>
              </>)}
              <Field label="Delivery Instructions (optional)" className="sm:col-span-2">{({ id }) => <TextInput id={id} value={f.instructions} onChange={set('instructions')} maxLength={300} />}</Field>
            </div></section>
          <section className="card p-5"><h2 className="mb-4 text-lg font-bold">Payment Method</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Option checked={payment === 'cod'} onChange={() => setPayment('cod')} icon={Wallet} title="Cash on Delivery" text={home ? 'Pay when your order arrives' : 'Pay when you collect'} />
              <Option checked={payment === 'online'} onChange={() => setPayment('online')} icon={CreditCard} title="Online Payment (Simulated)" text="Demo payment – no real charge" />
            </div>
            {payment === 'online' && (
              <div className="mt-4 rounded-lg border border-dashed border-gold/60 bg-gold-soft/40 p-4 text-sm dark:bg-gold/10">
                <p className="flex items-center gap-2 font-semibold"><Lock className="h-4 w-4 text-gold-dark" /> Simulated secure payment</p>
                <p className="mt-1 text-xs text-muted">No card details are collected. Your payment will be approved automatically, unless you choose to test a failure.</p>
                <label className="mt-3 flex items-center gap-2 text-xs"><input type="checkbox" className="accent-[#C69A52]" checked={simFail} onChange={(e) => setSimFail(e.target.checked)} /> Simulate a failed payment (for testing)</label>
              </div>)}
          </section>
        </div>
        <aside className="card h-fit p-5 lg:sticky lg:top-24">
          <h2 className="text-lg font-bold">Order Summary</h2>
          <ul className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-1">
            {cart.items.map((i) => (
              <li key={i.itemId} className="flex gap-3 text-sm">
                <div className="h-16 w-14 shrink-0 overflow-hidden rounded-md bg-surface2"><ProductImage src={i.imageSnapshot} alt="" className="h-full w-full" /></div>
                <div className="min-w-0 flex-1"><p className="line-clamp-1 font-semibold">{i.productNameSnapshot}</p><p className="text-xs text-muted">{i.color} · {i.size} · Qty {i.quantity}</p></div>
                <span className="font-semibold">{money(i.subtotal)}</span>
              </li>))}
          </ul>
          <div className="my-4 h-px bg-line" />
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{money(cart.subtotal)}</dd></div>
            {cart.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount</dt><dd>− {money(cart.discount)}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>{cart.deliveryCharge ? money(cart.deliveryCharge) : 'Free'}</dd></div>
            {home && cfg && cart.deliveryCharge > 0 && <p className="text-xs text-muted">Free delivery on orders above {money(cfg.store.freeDeliveryThreshold)}.</p>}
          </dl>
          <div className="my-4 h-px bg-line" />
          <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{money(cart.total)}</span></div>
          <button className="btn-primary btn-lg mt-5 w-full" disabled={busy || blocked}>{busy ? <Spinner className="h-5 w-5" /> : payment === 'online' ? 'Pay & Place Order' : 'Place Order'}</button>
          {blocked && <p className="mt-2 text-center text-xs text-red-600">Some items are unavailable. <Link className="underline" to="/cart">Review cart</Link></p>}
        </aside>
      </form>
    </div>
  );
}
