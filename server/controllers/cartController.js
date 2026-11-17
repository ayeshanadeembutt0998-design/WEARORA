import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import { AppError, asyncHandler, ok } from '../utils/AppError.js';
import { computeTotals } from '../utils/pricing.js';
import { round2 } from '../utils/helpers.js';

/** Turns raw cart lines into priced, stock-checked lines (never throws for stock problems). */
export async function priceCart(rawItems, deliveryMethod = 'home') {
  const products = await Product.find({ _id: { $in: [...new Set(rawItems.map((i) => String(i.productId)))] } });
  const pmap = new Map(products.map((p) => [String(p._id), p]));
  const lines = []; const unavailable = [];
  for (const it of rawItems) {
    const p = pmap.get(String(it.productId));
    const v = p?.variations.id(it.variationId);
    if (!p || p.status !== 'active' || !v) { unavailable.push({ itemId: it._id, variationId: it.variationId, productId: it.productId, reason: 'No longer available' }); continue; }
    const qty = Math.min(it.quantity, Math.max(v.stockQuantity, 0));
    lines.push({
      itemId: it._id, productId: p._id, variationId: v._id, productNameSnapshot: p.name, imageSnapshot: p.images?.[0] || '',
      size: v.size, color: v.color, colorHex: v.colorHex, barcode: v.barcode, quantity: it.quantity,
      originalUnitPrice: p.price, unitPrice: p.effectivePrice, available: v.stockQuantity,
      outOfStock: v.stockQuantity < 1, exceedsStock: it.quantity > v.stockQuantity, _q: qty,
    });
  }
  const t = computeTotals(lines.filter((l) => !l.outOfStock), { deliveryMethod });
  const items = lines.map((l) => ({ ...l, subtotal: round2(l.unitPrice * l.quantity) }));
  return { items, unavailable, subtotal: t.subtotal, discount: t.discount, deliveryCharge: t.deliveryCharge, total: t.total };
}

const shape = async (cart, deliveryMethod) => {
  const priced = await priceCart(cart.items.map((i) => i.toObject()), deliveryMethod);
  // drop dead lines silently from the stored cart
  if (priced.unavailable.length) {
    const dead = new Set(priced.unavailable.map((u) => String(u.itemId)));
    cart.items = cart.items.filter((i) => !dead.has(String(i._id)));
    await cart.save();
  }
  const count = priced.items.reduce((s, i) => s + i.quantity, 0);
  return { items: priced.items.map(({ _q, ...r }) => r), count, subtotal: priced.subtotal, discount: priced.discount, deliveryCharge: priced.deliveryCharge, total: priced.total, removed: priced.unavailable.length };
};

const getOrCreate = async (userId) => (await Cart.findOne({ customerId: userId })) || Cart.create({ customerId: userId, items: [] });

export const getCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreate(req.user._id);
  ok(res, { cart: await shape(cart, req.query.deliveryMethod === 'pickup' ? 'pickup' : 'home') });
});

export const addToCart = asyncHandler(async (req, res) => {
  const { productId, variationId, quantity } = req.body;
  const p = await Product.findOne({ _id: productId, status: 'active' });
  const v = p?.variations.id(variationId);
  if (!p || !v) throw new AppError('This product variation is not available', 404);
  if (v.stockQuantity < 1) throw new AppError('This variation is out of stock', 409);
  const cart = await getOrCreate(req.user._id);
  const existing = cart.items.find((i) => String(i.productId) === productId && String(i.variationId) === variationId);
  const newQty = (existing?.quantity || 0) + quantity;
  if (newQty > v.stockQuantity) throw new AppError(`Only ${v.stockQuantity} available in stock${existing ? ` (you already have ${existing.quantity} in your cart)` : ''}`, 409);
  if (existing) existing.quantity = newQty; else cart.items.push({ productId, variationId, quantity });
  await cart.save();
  ok(res, { cart: await shape(cart) }, 'Added to cart');
});

export const updateCartItem = asyncHandler(async (req, res) => {
  const cart = await getOrCreate(req.user._id);
  const item = cart.items.id(req.params.itemId);
  if (!item) throw new AppError('Cart item not found', 404);
  const p = await Product.findById(item.productId);
  const v = p?.variations.id(item.variationId);
  if (!v || p.status !== 'active') throw new AppError('This item is no longer available', 409);
  if (req.body.quantity > v.stockQuantity) throw new AppError(`Only ${v.stockQuantity} available in stock`, 409);
  item.quantity = req.body.quantity;
  await cart.save();
  ok(res, { cart: await shape(cart) });
});

export const removeCartItem = asyncHandler(async (req, res) => {
  const cart = await getOrCreate(req.user._id);
  const item = cart.items.id(req.params.itemId);
  if (!item) throw new AppError('Cart item not found', 404);
  item.deleteOne();
  await cart.save();
  ok(res, { cart: await shape(cart) }, 'Item removed');
});

export const clearCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreate(req.user._id);
  cart.items = [];
  await cart.save();
  ok(res, { cart: await shape(cart) });
});

/** Public: prices a guest (localStorage) cart using live product data. */
export const priceGuestCart = asyncHandler(async (req, res) => {
  const priced = await priceCart(req.body.items.map((i, idx) => ({ ...i, _id: `g${idx}` })), req.body.deliveryMethod || 'home');
  const count = priced.items.reduce((s, i) => s + i.quantity, 0);
  ok(res, { cart: { items: priced.items.map(({ _q, ...r }) => r), count, subtotal: priced.subtotal, discount: priced.discount, deliveryCharge: priced.deliveryCharge, total: priced.total, unavailable: priced.unavailable } });
});

/** Merge a guest cart into the account cart after sign-in. */
export const mergeCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreate(req.user._id);
  for (const it of req.body.items) {
    const p = await Product.findOne({ _id: it.productId, status: 'active' });
    const v = p?.variations.id(it.variationId);
    if (!v || v.stockQuantity < 1) continue;
    const ex = cart.items.find((i) => String(i.productId) === it.productId && String(i.variationId) === it.variationId);
    const q = Math.min((ex?.quantity || 0) + it.quantity, v.stockQuantity);
    if (ex) ex.quantity = q; else cart.items.push({ productId: it.productId, variationId: it.variationId, quantity: q });
  }
  await cart.save();
  ok(res, { cart: await shape(cart) });
});
