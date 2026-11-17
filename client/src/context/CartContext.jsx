import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

const Ctx = createContext(null);
export const useCart = () => useContext(Ctx);
const KEY = 'wearora_cart';
const readLocal = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const writeLocal = (items) => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ } };
const EMPTY = { items: [], count: 0, subtotal: 0, discount: 0, deliveryCharge: 0, total: 0 };

/**
 * Guests keep their cart in localStorage (priced by the backend via /cart/price).
 * Signed-in customers use the server cart; any guest items are merged on sign-in.
 */
export function CartProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const isCustomer = user?.role === 'customer';
  const [cart, setCart] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [deliveryMethod, setDeliveryMethod] = useState('home');
  const merged = useRef(null);

  const load = useCallback(async () => {
    try {
      if (isCustomer) {
        const r = await api.get(`/cart?deliveryMethod=${deliveryMethod}`);
        setCart(r.cart);
      } else {
        const local = readLocal();
        if (!local.length) { setCart(EMPTY); return; }
        const r = await api.post('/cart/price', { items: local, deliveryMethod });
        const alive = new Set(r.cart.items.map((i) => `${i.productId}:${i.variationId}`));
        const cleaned = local.filter((i) => alive.has(`${i.productId}:${i.variationId}`));
        if (cleaned.length !== local.length) writeLocal(cleaned);
        setCart({ ...r.cart, items: r.cart.items.map((i) => ({ ...i, itemId: `${i.productId}:${i.variationId}` })) });
      }
    } catch { /* keep previous cart on transient failure */ } finally { setLoading(false); }
  }, [isCustomer, deliveryMethod]);

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      if (isCustomer && merged.current !== user.id) {
        merged.current = user.id;
        const local = readLocal();
        if (local.length) { try { await api.post('/cart/merge', { items: local }); writeLocal([]); } catch { /* ignore */ } }
      }
      if (!isCustomer) merged.current = null;
      await load();
    })();
  }, [authLoading, isCustomer, user?.id, load]);

  const add = useCallback(async (productId, variationId, quantity = 1) => {
    if (isCustomer) {
      const r = await api.post('/cart', { productId, variationId, quantity });
      setCart(r.cart); return;
    }
    const { product } = await api.get(`/products/${productId}`);
    const v = product.variations.find((x) => x._id === variationId);
    if (!v || v.stockQuantity < 1) throw new Error('This variation is out of stock');
    const local = readLocal();
    const ex = local.find((i) => i.productId === productId && i.variationId === variationId);
    const next = (ex?.quantity || 0) + quantity;
    if (next > v.stockQuantity) throw new Error(`Only ${v.stockQuantity} available in stock`);
    if (ex) ex.quantity = next; else local.push({ productId, variationId, quantity });
    writeLocal(local);
    await load();
  }, [isCustomer, load]);

  const setQuantity = useCallback(async (item, quantity) => {
    if (quantity < 1) return;
    if (isCustomer) { const r = await api.patch(`/cart/${item.itemId}`, { quantity }); setCart(r.cart); return; }
    if (quantity > item.available) throw new Error(`Only ${item.available} available in stock`);
    writeLocal(readLocal().map((i) => (i.productId === item.productId && i.variationId === item.variationId ? { ...i, quantity } : i)));
    await load();
  }, [isCustomer, load]);

  const remove = useCallback(async (item) => {
    if (isCustomer) { const r = await api.del(`/cart/${item.itemId}`); setCart(r.cart); return; }
    writeLocal(readLocal().filter((i) => !(i.productId === item.productId && i.variationId === item.variationId)));
    await load();
  }, [isCustomer, load]);

  const reset = useCallback(() => { writeLocal([]); setCart(EMPTY); }, []);
  const localCount = !isCustomer ? readLocal().reduce((s, i) => s + i.quantity, 0) : 0;

  const value = useMemo(() => ({
    cart, loading, count: isCustomer ? cart.count : (cart.count || localCount), add, setQuantity, remove, reload: load, reset, deliveryMethod, setDeliveryMethod,
  }), [cart, loading, isCustomer, localCount, add, setQuantity, remove, load, reset, deliveryMethod]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
