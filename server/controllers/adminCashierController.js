import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Order from '../models/Order.js';
import { AppError, asyncHandler, ok } from '../utils/AppError.js';
import { assertObjectId, escapeRegex } from '../utils/helpers.js';
import { queueEmail, sendTemplateEmail } from '../utils/mailer.js';

const present = async (u) => ({ ...u.toSafeJSON(), lastLoginAt: u.lastLoginAt, salesCount: await Order.countDocuments({ cashierId: u._id, orderType: 'pos' }) });

export const createCashier = asyncHandler(async (req, res) => {
  const { fullName, email, mobile, password } = req.body;
  if (await User.exists({ email })) throw new AppError('An account with this email already exists', 409, { email: 'Email already in use' });
  // Role is assigned by the server – never from the request body.
  const u = await User.create({ fullName, email, mobile, passwordHash: await bcrypt.hash(password, 12), role: 'cashier', authProvider: 'local', mustChangePassword: false });
  queueEmail({ dedupeKey: `cashier-created:${u._id}`, type: 'cashierAccountCreated', to: u.email, data: { user: u } });
  ok(res, { cashier: await present(u) }, 'Cashier account created', 201);
});

export const listCashiers = asyncHandler(async (req, res) => {
  const { q, status } = req.query;
  const filter = { role: 'cashier' };
  if (['active', 'inactive'].includes(status)) filter.accountStatus = status;
  if (q) { const rx = new RegExp(escapeRegex(String(q).trim()), 'i'); filter.$or = [{ fullName: rx }, { email: rx }, { mobile: rx }]; }
  const list = await User.find(filter).sort({ createdAt: -1 });
  ok(res, { cashiers: await Promise.all(list.map(present)) });
});

export const getCashier = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const u = await User.findOne({ _id: req.params.id, role: 'cashier' });
  if (!u) throw new AppError('Cashier not found', 404);
  ok(res, { cashier: await present(u) });
});

export const updateCashier = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const u = await User.findOne({ _id: req.params.id, role: 'cashier' });
  if (!u) throw new AppError('Cashier not found', 404);
  const { fullName, email, mobile } = req.body;
  if (email && email !== u.email) {
    if (await User.exists({ email, _id: { $ne: u._id } })) throw new AppError('Email already in use', 409, { email: 'Email already in use' });
    u.email = email;
  }
  if (fullName) u.fullName = fullName;
  if (mobile) u.mobile = mobile;
  await u.save();
  ok(res, { cashier: await present(u) }, 'Cashier updated');
});

export const setStatus = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const u = await User.findOne({ _id: req.params.id, role: 'cashier' });
  if (!u) throw new AppError('Cashier not found', 404);
  u.accountStatus = req.body.accountStatus;
  await u.save();
  ok(res, { cashier: await present(u) }, u.accountStatus === 'active' ? 'Cashier activated' : 'Cashier deactivated');
});

/** Issues a random temporary password that is e-mailed straight to the cashier – the admin never sees it. */
export const resetPassword = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const u = await User.findOne({ _id: req.params.id, role: 'cashier' }).select('+passwordHash');
  if (!u) throw new AppError('Cashier not found', 404);
  const temp = 'Wr' + crypto.randomBytes(5).toString('hex') + crypto.randomInt(10, 99);
  const oldHash = u.passwordHash; const oldChanged = u.passwordChangedAt;
  u.passwordHash = await bcrypt.hash(temp, 12);
  u.mustChangePassword = true;
  u.passwordChangedAt = new Date();
  await u.save();
  const r = await sendTemplateEmail({ dedupeKey: `cashier-temp:${u._id}:${Date.now()}`, type: 'cashierTempPassword', to: u.email, data: { user: u, tempPassword: temp } });
  if (r.status !== 'sent') {
    u.passwordHash = oldHash; u.passwordChangedAt = oldChanged; u.mustChangePassword = false;
    await u.save();
    throw new AppError('The temporary password could not be e-mailed, so the password was NOT changed. Check the e-mail configuration and try again.', 502);
  }
  ok(res, {}, `A temporary password was e-mailed to ${u.email}`);
});
