import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import ReturnExchange from '../models/ReturnExchange.js';
import { AppError, asyncHandler, ok } from '../utils/AppError.js';
import { assertObjectId, dayRange, escapeRegex, parsePagination } from '../utils/helpers.js';
import { changeOrderStatus } from '../utils/orderService.js';
import { presentOrder } from './orderController.js';

export const listOrders = asyncHandler(async (req, res) => {
  const { q, orderType, date, paymentStatus, orderStatus } = req.query;
  const { page, limit, skip } = parsePagination(req.query, 15, 100);
  const filter = {};
  if (q) filter.orderNumber = new RegExp(escapeRegex(String(q).trim()), 'i');
  if (['online', 'pos'].includes(orderType)) filter.orderType = orderType;
  if (['pending', 'paid', 'failed', 'refunded', 'partially_refunded'].includes(paymentStatus)) filter.paymentStatus = paymentStatus;
  if (orderStatus) filter.orderStatus = orderStatus;
  if (date) { const r = dayRange(date); if (r) filter.createdAt = r; }
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments(filter),
  ]);
  ok(res, { orders: orders.map(presentOrder), pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
});

export const getOrder = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'order id');
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found', 404);
  const [payments, returns] = await Promise.all([
    Payment.find({ orderId: order._id }).sort({ createdAt: 1 }),
    ReturnExchange.find({ originalOrderId: order._id }).sort({ createdAt: -1 }),
  ]);
  ok(res, { order: presentOrder(order), payments, returns });
});

export const updateStatus = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'order id');
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found', 404);
  const updated = await changeOrderStatus(order, req.body.status, { userId: req.user._id, note: req.body.note });
  ok(res, { order: presentOrder(updated) }, `Order marked as ${req.body.status.replace(/_/g, ' ')}`);
});
