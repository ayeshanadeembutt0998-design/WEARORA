import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { AppError, asyncHandler, ok } from '../utils/AppError.js';
import { buildLines, logMovements, releaseStock, reserveStock } from '../utils/inventory.js';
import { computeTotals } from '../utils/pricing.js';
import { assertObjectId, dayRange, escapeRegex, isObjectId, nextNumber, normalizeMobile, parsePagination, randomToken } from '../utils/helpers.js';
import { buildReceiptPdf, verifyUrl } from '../utils/receiptPdf.js';
import { queueEmail, sendTemplateEmail } from '../utils/mailer.js';
import { emailSchema, mobileSchema } from '../utils/validators.js';
import QRCode from 'qrcode';

const present = (o) => {
  const obj = o.toObject ? o.toObject() : o;
  const { verifyToken, idempotencyKey, ...rest } = obj;
  return { ...rest, id: obj._id, itemCount: obj.items.reduce((s, i) => s + i.quantity, 0) };
};

async function findAccessibleSale(req, idOrNumber) {
  const filter = { orderType: 'pos', ...(isObjectId(idOrNumber) ? { _id: idOrNumber } : { orderNumber: idOrNumber }) };
  if (req.user.role === 'cashier') filter.cashierId = req.user._id; // cashiers only see their own sales
  const sale = await Order.findOne(filter);
  if (!sale) throw new AppError('Sale not found', 404);
  return sale;
}

async function resolveCustomer(c) {
  if (!c) return {};
  if (c.userId) {
    const u = await User.findOne({ _id: c.userId, role: 'customer' });
    if (!u) throw new AppError('Selected customer not found', 404);
    return { customerId: u._id, snapshot: { fullName: u.fullName, mobile: u.mobile, email: u.email } };
  }
  const snap = {};
  if (c.fullName) snap.fullName = c.fullName.trim();
  if (c.mobile) {
    const r = mobileSchema.safeParse(c.mobile);
    if (!r.success) throw new AppError('Customer mobile number is not valid', 422, { 'customer.mobile': 'Invalid mobile number' });
    snap.mobile = r.data;
  }
  if (c.email) {
    const r = emailSchema.safeParse(c.email);
    if (!r.success) throw new AppError('Customer email is not valid', 422, { 'customer.email': 'Invalid email' });
    snap.email = r.data;
  }
  if (!Object.keys(snap).length) return {};
  // link to an existing account when mobile/email matches
  const match = await User.findOne({ role: 'customer', $or: [...(snap.email ? [{ email: snap.email }] : []), ...(snap.mobile ? [{ mobile: snap.mobile }] : [])] });
  return { customerId: match?._id, snapshot: snap };
}

export const createSale = asyncHandler(async (req, res) => {
  const { items, customer, discountPercent, paymentMethod, amountReceived, simulateOutcome, emailReceipt, idempotencyKey } = req.body;
  const key = `${req.user._id}:${idempotencyKey}`;
  const prior = await Order.findOne({ idempotencyKey: key });
  if (prior) return ok(res, { sale: present(prior), duplicate: true }, 'Sale already recorded');

  if (discountPercent > env.store.maxPosDiscountPercent) throw new AppError(`Discount cannot exceed ${env.store.maxPosDiscountPercent}%`, 422, { discountPercent: `Maximum ${env.store.maxPosDiscountPercent}%` });
  const cust = await resolveCustomer(customer);
  const lines = await buildLines(items);
  const totals = computeTotals(lines, { deliveryMethod: 'in_store', discountPercent });

  if (paymentMethod === 'cash') {
    if (amountReceived == null || amountReceived < totals.total) throw new AppError('Amount received must be equal to or greater than the total', 422, { amountReceived: 'Insufficient amount' });
  } else if (simulateOutcome === 'failure') {
    throw new AppError(`${paymentMethod === 'card' ? 'Card' : 'Wallet'} payment failed (simulated). No sale was recorded.`, 402, undefined, 'PAYMENT_FAILED');
  }

  const reserved = await reserveStock(lines);
  const orderId = new mongoose.Types.ObjectId();
  let sale;
  try {
    sale = await Order.create({
      _id: orderId, orderNumber: await nextNumber('WR-POS'), orderType: 'pos',
      customerId: cust.customerId, customerSnapshot: cust.snapshot, cashierId: req.user._id, cashierName: req.user.fullName,
      items: totals.items.map(({ available, ...i }) => i),
      subtotal: totals.subtotal, discount: totals.discount, deliveryCharge: 0, total: totals.total,
      paymentMethod, paymentStatus: 'paid', orderStatus: 'completed', deliveryMethod: 'in_store',
      amountReceived: paymentMethod === 'cash' ? amountReceived : undefined,
      changeDue: paymentMethod === 'cash' ? Math.round((amountReceived - totals.total) * 100) / 100 : undefined,
      posDiscountPercent: discountPercent, verifyToken: randomToken(12), idempotencyKey: key,
      statusHistory: [{ status: 'completed', note: 'In-store sale', changedBy: req.user._id }],
    });
    await Payment.create({
      orderId, kind: 'payment', method: paymentMethod, amount: totals.total, status: 'paid',
      transactionReference: `${paymentMethod === 'cash' ? 'CSH' : 'SIM'}-${randomToken(6).toUpperCase()}`, simulated: paymentMethod !== 'cash',
    });
  } catch (err) {
    await Order.deleteOne({ _id: orderId });
    await Payment.deleteMany({ orderId });
    await releaseStock(lines);
    if (err.code === 11000 && err.keyPattern?.idempotencyKey) {
      const dup = await Order.findOne({ idempotencyKey: key });
      if (dup) return ok(res, { sale: present(dup), duplicate: true }, 'Sale already recorded');
    }
    throw err;
  }
  await logMovements(reserved, { movementType: 'pos_sale', referenceType: 'Order', referenceId: orderId, performedBy: req.user._id, note: sale.orderNumber });

  let emailQueued = false;
  if (emailReceipt && sale.customerSnapshot?.email) {
    emailQueued = true;
    buildReceiptPdf(sale)
      .then((pdf) => sendTemplateEmail({
        dedupeKey: `pos-receipt:${sale._id}:${sale.customerSnapshot.email}`, type: 'posReceipt', to: sale.customerSnapshot.email,
        data: { order: sale.toObject() }, attachments: [{ filename: `${sale.orderNumber}.pdf`, content: pdf, contentType: 'application/pdf' }],
      }))
      .catch((e) => console.error('[email] receipt error', e.message));
  }
  ok(res, { sale: present(sale), receiptEmailQueued: emailQueued }, 'Sale successful', 201);
});

export const listSales = asyncHandler(async (req, res) => {
  const { q, date } = req.query;
  const { page, limit, skip } = parsePagination(req.query, 15, 100);
  const filter = { orderType: 'pos' };
  if (req.user.role === 'cashier' || req.path.endsWith('my-sales')) filter.cashierId = req.user._id;
  if (q) filter.orderNumber = new RegExp(escapeRegex(String(q).trim()), 'i');
  if (date) { const r = dayRange(date); if (r) filter.createdAt = r; }
  const [sales, total] = await Promise.all([Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), Order.countDocuments(filter)]);
  ok(res, { sales: sales.map(present), pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
});

export const getSale = asyncHandler(async (req, res) => {
  const sale = await findAccessibleSale(req, req.params.id);
  const payments = await Payment.find({ orderId: sale._id }).sort({ createdAt: 1 });
  ok(res, { sale: present(sale), payments });
});

export const getReceipt = asyncHandler(async (req, res) => {
  const sale = await findAccessibleSale(req, req.params.id);
  const url = verifyUrl(sale);
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 200 });
  ok(res, { receipt: present(sale), qrDataUrl: qr, verifyUrl: url, tagline: 'Style Your Everyday.', thanks: 'Thank you for shopping with Wearora!' });
});

export const getReceiptPdf = asyncHandler(async (req, res) => {
  const sale = await findAccessibleSale(req, req.params.id);
  const pdf = await buildReceiptPdf(sale);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${sale.orderNumber}.pdf"`);
  res.send(pdf);
});

/** Public: confirms a receipt is genuine. Exposes NO customer information. */
export const verifyReceipt = asyncHandler(async (req, res) => {
  const { id } = req.params; const token = String(req.query.token || '');
  const sale = await Order.findOne({ orderType: 'pos', ...(isObjectId(id) ? { _id: id } : { orderNumber: id }) });
  if (!sale || !token || sale.verifyToken !== token) return res.status(404).json({ success: false, valid: false, message: 'Receipt could not be verified' });
  ok(res, { valid: true, receipt: { receiptNumber: sale.orderNumber, date: sale.createdAt, total: sale.total, itemCount: sale.items.reduce((s, i) => s + i.quantity, 0), paymentStatus: sale.paymentStatus, store: 'Wearora' } });
});

export const emailReceipt = asyncHandler(async (req, res) => {
  const sale = await findAccessibleSale(req, req.params.id);
  const parsed = emailSchema.safeParse(req.body.email || sale.customerSnapshot?.email);
  if (!parsed.success) throw new AppError('A valid email address is required', 422);
  const pdf = await buildReceiptPdf(sale);
  const r = await sendTemplateEmail({
    dedupeKey: `pos-receipt:${sale._id}:${parsed.data}`, type: 'posReceipt', to: parsed.data, data: { order: sale.toObject() },
    attachments: [{ filename: `${sale.orderNumber}.pdf`, content: pdf, contentType: 'application/pdf' }],
  });
  if (r.status === 'duplicate') return ok(res, {}, 'This receipt was already emailed to that address');
  if (r.status !== 'sent') throw new AppError(r.status === 'skipped' ? 'Email service is not configured' : 'The receipt email could not be sent. Please try again.', 502);
  ok(res, {}, `Receipt emailed to ${parsed.data}`);
});

export const searchCustomers = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 3) return ok(res, { customers: [] });
  const rx = new RegExp(escapeRegex(q.includes('@') ? q : normalizeMobile(q)), 'i');
  const users = await User.find({ role: 'customer', accountStatus: 'active', $or: [{ mobile: rx }, { email: rx }] }).limit(6);
  const snaps = await Order.aggregate([
    { $match: { orderType: 'pos', customerId: null, $or: [{ 'customerSnapshot.mobile': rx }, { 'customerSnapshot.email': rx }] } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: { m: '$customerSnapshot.mobile', e: '$customerSnapshot.email' }, c: { $first: '$customerSnapshot' } } },
    { $limit: 4 },
  ]);
  const customers = [
    ...users.map((u) => ({ userId: u._id, fullName: u.fullName, mobile: u.mobile, email: u.email, registered: true })),
    ...snaps.map((s) => ({ fullName: s.c.fullName || '', mobile: s.c.mobile || '', email: s.c.email || '', registered: false })),
  ];
  ok(res, { customers });
});

export const cashierProfile = asyncHandler(async (req, res) => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const [salesCount, todayAgg] = await Promise.all([
    Order.countDocuments({ cashierId: req.user._id, orderType: 'pos' }),
    Order.aggregate([{ $match: { cashierId: req.user._id, orderType: 'pos', createdAt: { $gte: start } } }, { $group: { _id: null, n: { $sum: 1 }, total: { $sum: '$total' } } }]),
  ]);
  ok(res, { profile: { ...req.user.toSafeJSON(), lastLoginAt: req.user.lastLoginAt, totalSales: salesCount, salesToday: todayAgg[0]?.n || 0, revenueToday: todayAgg[0]?.total || 0 } });
});
