import crypto from 'crypto';
import mongoose from 'mongoose';
import Counter from '../models/Counter.js';
import { AppError } from './AppError.js';

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const normalizeEmail = (e) => String(e || '').trim().toLowerCase();
export const normalizeMobile = (m) => String(m || '').replace(/[\s\-()]/g, '');
export const isObjectId = (id) => mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === String(id);
export const assertObjectId = (id, label = 'id') => {
  if (!isObjectId(id)) throw new AppError(`Invalid ${label}`, 400);
};
export const randomToken = (bytes = 16) => crypto.randomBytes(bytes).toString('hex');
export const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

export async function nextNumber(prefix) {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const key = `${prefix}-${stamp}`;
  const c = await Counter.findByIdAndUpdate(key, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return `${key}-${String(c.seq).padStart(4, '0')}`;
}

export function generateBarcode() {
  // 12 random digits + EAN-13 check digit
  let base = '2' + Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join('');
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(base[i]) * (i % 2 === 0 ? 1 : 3);
  return base + ((10 - (sum % 10)) % 10);
}

export const parsePagination = (q, defLimit = 12, maxLimit = 100) => {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(q.limit, 10) || defLimit));
  return { page, limit, skip: (page - 1) * limit };
};

export const dayRange = (dateStr) => {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return null;
  // Interpret in server local time for store-day semantics
  const local = new Date(dateStr);
  const s = new Date(local.getFullYear(), local.getMonth(), local.getDate());
  const e = new Date(s.getTime() + 24 * 3600 * 1000);
  return { $gte: s, $lt: e };
};
