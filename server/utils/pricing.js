import { env } from '../config/env.js';
import { round2 } from './helpers.js';

/**
 * Backend-authoritative totals.
 * subtotal  = sum(original price * qty)
 * discount  = product sale savings + optional POS discount
 */
export function computeTotals(lines, { deliveryMethod = 'in_store', discountPercent = 0 } = {}) {
  const subtotal = round2(lines.reduce((s, l) => s + l.originalUnitPrice * l.quantity, 0));
  const saleSubtotal = round2(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0));
  const extraDiscount = round2((saleSubtotal * discountPercent) / 100);
  const discount = round2(subtotal - saleSubtotal + extraDiscount);
  const afterDiscount = round2(saleSubtotal - extraDiscount);
  let deliveryCharge = 0;
  if (deliveryMethod === 'home' && lines.length && afterDiscount < env.store.freeDeliveryThreshold) {
    deliveryCharge = env.store.deliveryCharge;
  }
  const total = round2(afterDiscount + deliveryCharge);
  const items = lines.map((l) => ({
    ...l,
    subtotal: round2(l.unitPrice * l.quantity),
    netUnitPrice: round2(l.unitPrice * (1 - discountPercent / 100)),
  }));
  return { items, subtotal, discount, deliveryCharge, total, extraDiscount };
}

export function estimateDelivery(method, from = new Date()) {
  const add = (d, n) => new Date(from.getTime() + n * 86400000 + (d || 0));
  if (method === 'pickup') return { estimatedFrom: add(0, 1), estimatedTo: add(0, 2) };
  return { estimatedFrom: add(0, 3), estimatedTo: add(0, 5) };
}
