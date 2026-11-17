import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import { restoreWithMovement } from './inventory.js';
import { queueEmail } from './mailer.js';
import { AppError } from './AppError.js';
import { randomToken } from './helpers.js';

export const TRANSITIONS = {
  home: {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered'],
    delivered: [], cancelled: [],
  },
  pickup: {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['processing', 'cancelled'],
    processing: ['ready_for_pickup', 'cancelled'],
    ready_for_pickup: ['delivered', 'cancelled'],
    delivered: [], cancelled: [],
  },
};

export const allowedNext = (order) => (order.orderType === 'online' ? TRANSITIONS[order.deliveryMethod]?.[order.orderStatus] || [] : []);

export function sendStatusEmail(order, { byCustomer = false } = {}) {
  const to = order.deliveryInformation?.email || order.customerSnapshot?.email;
  if (!to) return;
  const status = order.orderStatus;
  const map = { shipped: 'orderShipped', delivered: 'orderDelivered', cancelled: 'orderCancelled' };
  queueEmail({
    dedupeKey: `order-status:${order._id}:${status}`,
    type: map[status] || 'orderStatusUpdate',
    to,
    data: { order: order.toObject(), byCustomer },
  });
}

export function sendConfirmationEmail(order) {
  const to = order.deliveryInformation?.email || order.customerSnapshot?.email;
  if (!to) return;
  queueEmail({ dedupeKey: `order-confirmation:${order._id}`, type: 'orderConfirmation', to, data: { order: order.toObject() } });
}

/**
 * Moves an online order to a new status, enforcing allowed transitions.
 * The conditional update guarantees a status (and stock restoration on cancel) is applied only once.
 */
export async function changeOrderStatus(order, nextStatus, { userId, note, byCustomer = false } = {}) {
  if (order.orderType !== 'online') throw new AppError('POS transactions cannot be edited', 400);
  const allowed = allowedNext(order);
  if (!allowed.includes(nextStatus)) {
    throw new AppError(`Cannot change status from "${order.orderStatus}" to "${nextStatus}"`, 400, { allowed }, 'INVALID_TRANSITION');
  }
  const prev = order.orderStatus;
  const update = {
    $set: { orderStatus: nextStatus },
    $push: { statusHistory: { status: nextStatus, note, changedBy: userId, at: new Date() } },
  };
  const updated = await Order.findOneAndUpdate({ _id: order._id, orderStatus: prev }, update, { new: true });
  if (!updated) throw new AppError('Order status was changed by someone else. Please refresh.', 409);

  if (nextStatus === 'cancelled') {
    await restoreWithMovement(
      updated.items.map((i) => ({ productId: i.productId, variationId: i.variationId, productNameSnapshot: i.productNameSnapshot, size: i.size, color: i.color, quantity: i.quantity })),
      { movementType: 'order_cancellation', referenceType: 'Order', referenceId: updated._id, performedBy: userId, note: `Order ${updated.orderNumber} cancelled` }
    );
    if (updated.paymentStatus === 'paid') {
      updated.paymentStatus = 'refunded';
      await updated.save();
      await Payment.create({ orderId: updated._id, kind: 'refund', method: updated.paymentMethod, amount: updated.total, status: 'refunded', transactionReference: `RFD-${randomToken(5).toUpperCase()}`, simulated: true });
      await Payment.updateMany({ orderId: updated._id, kind: 'payment' }, { status: 'refunded' });
    }
  }
  if (nextStatus === 'delivered' && updated.paymentMethod === 'cod' && updated.paymentStatus !== 'paid') {
    updated.paymentStatus = 'paid';
    await updated.save();
    await Payment.updateMany({ orderId: updated._id, kind: 'payment' }, { status: 'paid' });
  }
  sendStatusEmail(updated, { byCustomer });
  return updated;
}
