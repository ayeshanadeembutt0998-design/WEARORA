import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import ReturnExchange from '../models/ReturnExchange.js';
import { env } from '../config/env.js';
import { AppError, asyncHandler, ok } from '../utils/AppError.js';
import { buildLines, logMovements, releaseStock, reserveStock, restoreWithMovement } from '../utils/inventory.js';
import { nextNumber, randomToken, round2, assertObjectId } from '../utils/helpers.js';
import { queueEmail } from '../utils/mailer.js';

const deadline = (o) => new Date(new Date(o.createdAt).getTime() + env.store.returnWindowDays * 86400000);

function describe(order) {
  const within = new Date() <= deadline(order);
  const items = order.items.map((i) => ({
    _id: i._id, productId: i.productId, productNameSnapshot: i.productNameSnapshot, imageSnapshot: i.imageSnapshot, size: i.size, color: i.color, barcode: i.barcode,
    quantity: i.quantity, returnedQty: i.returnedQty, remaining: i.quantity - i.returnedQty, unitPrice: i.unitPrice, netUnitPrice: i.netUnitPrice,
  }));
  const anyLeft = items.some((i) => i.remaining > 0);
  let reason = null;
  if (order.paymentStatus === 'refunded') reason = 'This sale has already been fully refunded';
  else if (!within) reason = `The ${env.store.returnWindowDays}-day return window has passed`;
  else if (!anyLeft) reason = 'All items from this sale were already returned or exchanged';
  return {
    _id: order._id, orderNumber: order.orderNumber, createdAt: order.createdAt, total: order.total, discount: order.discount, paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus, cashierName: order.cashierName, customer: order.customerSnapshot, items,
    eligibility: { eligible: !reason, reason, deadline: deadline(order), windowDays: env.store.returnWindowDays },
  };
}

export const lookupReceipt = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ orderType: 'pos', orderNumber: String(req.params.receiptNumber).trim().toUpperCase() });
  if (!order) throw new AppError('No in-store receipt found with that number', 404);
  ok(res, { sale: describe(order) });
});

/** Validates the requested lines against the original sale, atomically claiming the returned quantities. */
async function claimReturned(order, reqItems) {
  const claimed = []; const lines = [];
  try {
    for (const r of reqItems) {
      const item = order.items.id(r.orderItemId);
      if (!item) throw new AppError('Item does not belong to this sale', 400);
      if (r.quantity > item.quantity - item.returnedQty) throw new AppError(`Only ${item.quantity - item.returnedQty} unit(s) of ${item.productNameSnapshot} can still be returned`, 422);
      const res = await Order.updateOne(
        { _id: order._id, items: { $elemMatch: { _id: item._id, returnedQty: { $lte: item.quantity - r.quantity } } } },
        { $inc: { 'items.$.returnedQty': r.quantity } }
      );
      if (!res.modifiedCount) throw new AppError(`${item.productNameSnapshot}: return quantity exceeds what was purchased`, 409);
      claimed.push({ itemId: item._id, qty: r.quantity });
      lines.push({ item, quantity: r.quantity, resellable: r.resellable });
    }
    return { claimed, lines };
  } catch (e) { await unclaim(order, claimed); throw e; }
}
const unclaim = async (order, claimed) => {
  for (const c of claimed) await Order.updateOne({ _id: order._id, 'items._id': c.itemId }, { $inc: { 'items.$.returnedQty': -c.qty } });
};

const toLine = (l, forceNonResellable) => ({
  orderItemId: l.item._id, productId: l.item.productId, variationId: l.item.variationId, productNameSnapshot: l.item.productNameSnapshot,
  size: l.item.size, color: l.item.color, barcode: l.item.barcode, quantity: l.quantity, unitPrice: l.item.netUnitPrice,
  amount: round2(l.item.netUnitPrice * l.quantity), resellable: forceNonResellable ? false : l.resellable,
});

async function loadReturnable(orderId) {
  assertObjectId(orderId, 'order id');
  const order = await Order.findOne({ _id: orderId, orderType: 'pos' });
  if (!order) throw new AppError('Original sale not found', 404);
  const d = describe(order);
  if (!d.eligibility.eligible) throw new AppError(d.eligibility.reason, 400, undefined, 'NOT_ELIGIBLE');
  return order;
}

export const processReturn = asyncHandler(async (req, res) => {
  const { orderId, items, reason, reasonNote, refundMethod, idempotencyKey } = req.body;
  const key = `${req.user._id}:${idempotencyKey}`;
  const prior = await ReturnExchange.findOne({ idempotencyKey: key });
  if (prior) return ok(res, { record: prior, duplicate: true }, 'Return already recorded');

  const order = await loadReturnable(orderId);
  const { claimed, lines } = await claimReturned(order, items);
  let record;
  try {
    const returnedItems = lines.map((l) => toLine(l, reason === 'defective'));
    const refundAmount = round2(returnedItems.reduce((s, i) => s + i.amount, 0));
    record = await ReturnExchange.create({
      originalOrderId: order._id, originalOrderNumber: order.orderNumber, referenceNumber: await nextNumber('WR-RET'), cashierId: req.user._id,
      transactionType: 'return', returnedItems, replacementItems: [], returnReason: reason, reasonNote, refundAmount, refundMethod, transactionStatus: 'completed', idempotencyKey: key,
    });
  } catch (e) { await unclaim(order, claimed); throw e; }

  await restoreWithMovement(
    record.returnedItems.filter((i) => i.resellable).map((i) => ({ ...i.toObject(), productNameSnapshot: i.productNameSnapshot })),
    { movementType: 'pos_return', referenceType: 'ReturnExchange', referenceId: record._id, performedBy: req.user._id, note: record.referenceNumber }
  );
  await Payment.create({ orderId: order._id, kind: 'refund', method: refundMethod, amount: record.refundAmount, status: 'refunded', transactionReference: `RFD-${randomToken(5).toUpperCase()}`, simulated: refundMethod !== 'cash' });

  const fresh = await Order.findById(order._id);
  const allReturned = fresh.items.every((i) => i.returnedQty >= i.quantity);
  const refundedTotal = (await Payment.aggregate([{ $match: { orderId: order._id, kind: 'refund' } }, { $group: { _id: null, t: { $sum: '$amount' } } }]))[0]?.t || 0;
  fresh.paymentStatus = allReturned && refundedTotal >= fresh.total - 0.01 ? 'refunded' : 'partially_refunded';
  await fresh.save();

  notifyRecord(record, fresh);
  ok(res, { record, sale: describe(fresh) }, 'Return completed', 201);
});

export const processExchange = asyncHandler(async (req, res) => {
  const { orderId, items, replacements, reason, reasonNote, settlementMethod, simulateOutcome, idempotencyKey } = req.body;
  const key = `${req.user._id}:${idempotencyKey}`;
  const prior = await ReturnExchange.findOne({ idempotencyKey: key });
  if (prior) return ok(res, { record: prior, duplicate: true }, 'Exchange already recorded');

  const order = await loadReturnable(orderId);
  const repLines = await buildLines(replacements); // validates active + stock
  const replacementTotal = round2(repLines.reduce((s, l) => s + l.unitPrice * l.quantity, 0));
  // pre-compute returned value (pure arithmetic, no mutation yet)
  let returnedValue = 0;
  for (const r of items) {
    const it = order.items.id(r.orderItemId);
    if (!it) throw new AppError('Item does not belong to this sale', 400);
    returnedValue += it.netUnitPrice * r.quantity;
  }
  returnedValue = round2(returnedValue);
  const diff = round2(replacementTotal - returnedValue);
  if (diff > 0 && settlementMethod !== 'cash' && simulateOutcome === 'failure') {
    throw new AppError('Payment of the price difference failed (simulated). The exchange was not completed.', 402, undefined, 'PAYMENT_FAILED');
  }

  const reserved = await reserveStock(repLines);
  let claimedState; let record;
  try {
    claimedState = await claimReturned(order, items);
    const returnedItems = claimedState.lines.map((l) => toLine(l, reason === 'defective'));
    record = await ReturnExchange.create({
      originalOrderId: order._id, originalOrderNumber: order.orderNumber, referenceNumber: await nextNumber('WR-EXC'), cashierId: req.user._id,
      transactionType: 'exchange', returnedItems,
      replacementItems: repLines.map((l) => ({ productId: l.productId, variationId: l.variationId, productNameSnapshot: l.productNameSnapshot, size: l.size, color: l.color, barcode: l.barcode, quantity: l.quantity, unitPrice: l.unitPrice, amount: round2(l.unitPrice * l.quantity) })),
      returnReason: reason, reasonNote, refundAmount: diff < 0 ? -diff : 0, additionalPayment: diff > 0 ? diff : 0,
      refundMethod: diff < 0 ? settlementMethod : 'none', additionalPaymentMethod: diff > 0 ? settlementMethod : 'none', transactionStatus: 'completed', idempotencyKey: key,
    });
  } catch (e) {
    if (claimedState) await unclaim(order, claimedState.claimed);
    await releaseStock(repLines);
    throw e;
  }

  await logMovements(reserved, { movementType: 'exchange', referenceType: 'ReturnExchange', referenceId: record._id, performedBy: req.user._id, note: `${record.referenceNumber} replacement` });
  await restoreWithMovement(
    record.returnedItems.filter((i) => i.resellable).map((i) => i.toObject()),
    { movementType: 'exchange', referenceType: 'ReturnExchange', referenceId: record._id, performedBy: req.user._id, note: `${record.referenceNumber} returned item` }
  );
  if (record.additionalPayment > 0) await Payment.create({ orderId: order._id, kind: 'additional_payment', method: settlementMethod, amount: record.additionalPayment, status: 'paid', transactionReference: `EXC-${randomToken(5).toUpperCase()}`, simulated: settlementMethod !== 'cash' });
  if (record.refundAmount > 0) await Payment.create({ orderId: order._id, kind: 'refund', method: settlementMethod, amount: record.refundAmount, status: 'refunded', transactionReference: `RFD-${randomToken(5).toUpperCase()}`, simulated: settlementMethod !== 'cash' });

  const fresh = await Order.findById(order._id);
  notifyRecord(record, fresh);
  ok(res, { record, sale: describe(fresh) }, 'Exchange completed', 201);
});

function notifyRecord(record, order) {
  const to = order.customerSnapshot?.email;
  if (!to) return;
  queueEmail({ dedupeKey: `return:${record.referenceNumber}`, type: 'returnCompleted', to, data: { record: record.toObject(), order: order.toObject() } });
}

export const listReturns = asyncHandler(async (req, res) => {
  const filter = req.user.role === 'cashier' ? { cashierId: req.user._id } : {};
  const list = await ReturnExchange.find(filter).sort({ createdAt: -1 }).limit(30);
  ok(res, { records: list });
});
