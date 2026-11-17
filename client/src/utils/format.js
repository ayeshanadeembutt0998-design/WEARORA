export const SYMBOL = 'Rs.';
export const money = (n) => `${SYMBOL} ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
export const fmtDate = (d, time = false) =>
  new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}) });
export const imgUrl = (p) => {
  if (!p) return '';
  if (/^https?:/.test(p)) return p;
  return `${import.meta.env.VITE_API_URL || ''}${p}`;
};
export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
export const cx = (...a) => a.filter(Boolean).join(' ');

export const PAYMENT_LABEL = { cod: 'Cash on Delivery', online: 'Online Payment (Simulated)', cash: 'Cash', card: 'Card (Simulated)', wallet: 'Digital Wallet (Simulated)' };
export const STATUS_LABEL = { pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing', ready_for_pickup: 'Ready for Pickup', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', completed: 'Completed' };
export const PAY_STATUS_LABEL = { pending: 'Pending', paid: 'Paid', failed: 'Failed', refunded: 'Refunded', partially_refunded: 'Partially Refunded' };
export const CATEGORY_LABEL = { women: 'Women', men: 'Men', kids: 'Kids' };
export const MOVEMENT_LABEL = { online_sale: 'Online Sale', pos_sale: 'POS Sale', customer_return: 'Customer Return', pos_return: 'POS Return', exchange: 'Exchange', admin_adjustment: 'Admin Stock Adjustment', order_cancellation: 'Order Cancellation', initial_stock: 'Initial Stock' };
export const REASON_LABEL = { wrong_size: 'Wrong Size', defective: 'Defective Product', wrong_product: 'Wrong Product', other: 'Other' };
export const DELIVERY_LABEL = { home: 'Home Delivery', pickup: 'Store Pickup', in_store: 'In-store Purchase' };
