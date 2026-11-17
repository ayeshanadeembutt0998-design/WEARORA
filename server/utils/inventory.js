import Product from '../models/Product.js';
import InventoryMovement from '../models/InventoryMovement.js';
import { AppError } from './AppError.js';
import { env } from '../config/env.js';

/**
 * Load products for requested lines, validate they exist/are active/variation exists and stock is sufficient.
 * Returns priced lines with product snapshots. Does NOT mutate stock.
 */
export async function buildLines(items, { requireActive = true } = {}) {
  const merged = new Map();
  for (const it of items) {
    const key = `${it.productId}:${it.variationId}`;
    merged.set(key, { ...it, quantity: (merged.get(key)?.quantity || 0) + Number(it.quantity) });
  }
  const list = [...merged.values()];
  const products = await Product.find({ _id: { $in: [...new Set(list.map((i) => String(i.productId)))] } });
  const map = new Map(products.map((p) => [String(p._id), p]));
  const problems = [];
  const lines = [];
  for (const it of list) {
    const p = map.get(String(it.productId));
    if (!p) { problems.push({ ...it, reason: 'Product no longer exists' }); continue; }
    if (requireActive && p.status !== 'active') { problems.push({ ...it, reason: `${p.name} is no longer available` }); continue; }
    const v = p.variations.id(it.variationId);
    if (!v) { problems.push({ ...it, reason: `${p.name}: selected size/color is not available` }); continue; }
    if (v.stockQuantity < it.quantity) {
      problems.push({ ...it, reason: v.stockQuantity === 0 ? `${p.name} (${v.size}/${v.color}) is out of stock` : `Only ${v.stockQuantity} of ${p.name} (${v.size}/${v.color}) left`, available: v.stockQuantity });
      continue;
    }
    lines.push({
      productId: p._id,
      productNameSnapshot: p.name,
      imageSnapshot: p.images?.[0] || '',
      variationId: v._id,
      size: v.size,
      color: v.color,
      barcode: v.barcode,
      quantity: it.quantity,
      originalUnitPrice: p.price,
      unitPrice: p.effectivePrice,
    });
  }
  if (problems.length) throw new AppError(problems[0].reason, 409, problems, 'STOCK_UNAVAILABLE');
  return lines;
}

/** Atomically deduct stock; rolls back everything if any line fails. Returns movement drafts. */
export async function reserveStock(lines) {
  const done = [];
  try {
    for (const l of lines) {
      const before = await Product.findOneAndUpdate(
        { _id: l.productId, variations: { $elemMatch: { _id: l.variationId, stockQuantity: { $gte: l.quantity } } } },
        { $inc: { 'variations.$.stockQuantity': -l.quantity } },
        { new: false }
      );
      if (!before) {
        throw new AppError(`${l.productNameSnapshot} (${l.size}/${l.color}) is no longer available in the requested quantity`, 409, undefined, 'STOCK_UNAVAILABLE');
      }
      const prev = before.variations.id(l.variationId).stockQuantity;
      done.push({ line: l, previousStock: prev, newStock: prev - l.quantity });
    }
    return done;
  } catch (err) {
    await releaseStock(done.map((d) => d.line));
    throw err;
  }
}

/** Add stock back (no movement). Used for rollback. */
export async function releaseStock(lines) {
  for (const l of lines) {
    await Product.updateOne(
      { _id: l.productId, 'variations._id': l.variationId },
      { $inc: { 'variations.$.stockQuantity': l.quantity } }
    );
  }
}

export async function addStock(line, qty) {
  const before = await Product.findOneAndUpdate(
    { _id: line.productId, 'variations._id': line.variationId },
    { $inc: { 'variations.$.stockQuantity': qty } },
    { new: false }
  );
  if (!before) return null;
  const prev = before.variations.id(line.variationId).stockQuantity;
  return { previousStock: prev, newStock: prev + qty };
}

export async function logMovements(drafts, { movementType, referenceType, referenceId, performedBy, note }) {
  if (!drafts.length) return;
  await InventoryMovement.insertMany(
    drafts.map((d) => ({
      productId: d.line.productId,
      variationId: d.line.variationId,
      productName: d.line.productNameSnapshot,
      size: d.line.size,
      color: d.line.color,
      movementType,
      quantity: -Math.abs(d.line.quantity),
      referenceType,
      referenceId,
      note,
      previousStock: d.previousStock,
      newStock: d.newStock,
      performedBy,
    }))
  );
}

/** Restore stock with movement records (cancellations, resellable returns). */
export async function restoreWithMovement(lines, { movementType, referenceType, referenceId, performedBy, note }) {
  for (const l of lines) {
    const r = await addStock(l, l.quantity);
    if (!r) continue;
    await InventoryMovement.create({
      productId: l.productId,
      variationId: l.variationId,
      productName: l.productNameSnapshot,
      size: l.size,
      color: l.color,
      movementType,
      quantity: Math.abs(l.quantity),
      referenceType,
      referenceId,
      note,
      previousStock: r.previousStock,
      newStock: r.newStock,
      performedBy,
    });
  }
}

export const isLowStock = (qty) => qty <= env.store.lowStockThreshold;
