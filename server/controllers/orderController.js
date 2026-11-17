import mongoose from 'mongoose';
import Cart from '../models/Cart.js';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import { env } from '../config/env.js';
import { AppError, asyncHandler, ok } from '../utils/AppError.js';
import { buildLines, logMovements, releaseStock, reserveStock } from '../utils/inventory.js';
import { computeTotals, estimateDelivery } from '../utils/pricing.js';
import { assertObjectId, nextNumber, randomToken } from '../utils/helpers.js';
import { allowedNext, changeOrderStatus, sendConfirmationEmail } from '../utils/orderService.js';

export const presentOrder = (o) => {
  const obj = o.toObject ? o.toObject() : o;
  return { ...obj, id: obj._id, allowedNext: allowedNext(o), itemCount: obj.items.reduce((s, i) => s + i.quantity, 0) };
};

export const createOrder = asyncHandler(async (req, res) => {
  const { deliveryMethod, paymentMethod, delivery, idempotencyKey, simulateOutcome } = req.body;
  const customerId = req.user._id;

  // Idempotency: the same checkout submission returns the same order.
  const prior = await Order.findOne({ idempotencyKey: `${customerId}:${idempotencyKey}` });
  if (prior) return ok(res, { order: presentOrder(prior), duplicate: true }, 'Order already placed');

  if (deliveryMethod === 'pickup' && !env.store.pickupEnabled) throw new AppError('Store pickup is currently unavailable', 400);
  if (deliveryMethod === 'home' && (!delivery.city || delivery.city.length < 2 || !delivery.address || delivery.address.length < 5)) {
    throw new AppError('City and complete address are required for home delivery', 422, { address: 'Complete address is required' });
  }

  const cart = await Cart.findOne({ customerId });
  if (!cart || !cart.items.length) throw new AppError('Your cart is empty', 400, undefined, 'EMPTY_CART');

  const lines = await buildLines(cart.items.map((i) => ({ productId: i.productId, variationId: i.variationId, quantity: i.quantity })));
  const totals = computeTotals(lines, { deliveryMethod });

  // Simulated online payment – a failed payment never creates an order nor touches stock.
  if (paymentMethod === 'online' && simulateOutcome === 'failure') {
    throw new AppError('Payment failed (simulated). No order was placed and you have not been charged.', 402, undefined, 'PAYMENT_FAILED');
  }

  const reserved = await reserveStock(lines);
  const orderId = new mongoose.Types.ObjectId();
  let order;
  try {
    const orderNumber = await nextNumber('WR-ORD');
    order = await Order.create({
      _id: orderId, orderNumber, orderType: 'online', customerId,
      customerSnapshot: { fullName: delivery.fullName, mobile: delivery.mobile, email: delivery.email },
      items: totals.items.map(({ available, ...i }) => i),
      subtotal: totals.subtotal, discount: totals.discount, deliveryCharge: totals.deliveryCharge, total: totals.total,
      paymentMethod, paymentStatus: paymentMethod === 'online' ? 'paid' : 'pending',
      orderStatus: 'pending', deliveryMethod,
      deliveryInformation: { ...delivery, ...estimateDelivery(deliveryMethod) },
      idempotencyKey: `${customerId}:${idempotencyKey}`,
      statusHistory: [{ status: 'pending', note: 'Order placed', changedBy: customerId }],
    });
    await Payment.create({
      orderId, kind: 'payment', method: paymentMethod, amount: totals.total,
      status: paymentMethod === 'online' ? 'paid' : 'pending',
      transactionReference: `${paymentMethod === 'online' ? 'SIM' : 'COD'}-${randomToken(6).toUpperCase()}`, simulated: paymentMethod === 'online',
    });
  } catch (err) {
    await Order.deleteOne({ _id: orderId });
    await Payment.deleteMany({ orderId });
    await releaseStock(lines);
    if (err.code === 11000 && err.keyPattern?.idempotencyKey) {
      const dup = await Order.findOne({ idempotencyKey: `${customerId}:${idempotencyKey}` });
      if (dup) return ok(res, { order: presentOrder(dup), duplicate: true }, 'Order already placed');
    }
    throw err;
  }

  await logMovements(reserved, { movementType: 'online_sale', referenceType: 'Order', referenceId: orderId, performedBy: customerId, note: order.orderNumber });
  cart.items = [];
  await cart.save();
  // Emails are fire-and-forget: a mail failure can never fail the order.
  sendConfirmationEmail(order);
  ok(res, { order: presentOrder(order) }, 'Order placed successfully', 201);
});

export const myOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ customerId: req.user._id, orderType: 'online' }).sort({ createdAt: -1 }).limit(100);
  ok(res, { orders: orders.map(presentOrder) });
});

export const getMyOrder = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'order id');
  const order = await Order.findOne({ _id: req.params.id, customerId: req.user._id });
  if (!order) throw new AppError('Order not found', 404);
  ok(res, { order: presentOrder(order) });
});

export const cancelMyOrder = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'order id');
  const order = await Order.findOne({ _id: req.params.id, customerId: req.user._id });
  if (!order) throw new AppError('Order not found', 404);
  if (!['pending', 'confirmed'].includes(order.orderStatus)) throw new AppError('This order can no longer be cancelled. Please contact the store.', 400);
  const updated = await changeOrderStatus(order, 'cancelled', { userId: req.user._id, note: 'Cancelled by customer', byCustomer: true });
  ok(res, { order: presentOrder(updated) }, 'Order cancelled');
});
