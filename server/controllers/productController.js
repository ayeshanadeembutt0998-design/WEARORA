import Product from '../models/Product.js';
import { AppError, asyncHandler, ok } from '../utils/AppError.js';
import { assertObjectId, escapeRegex, parsePagination } from '../utils/helpers.js';

const staff = (u) => u && (u.role === 'cashier' || u.role === 'admin');

export const serializeProduct = (p, withBarcodes = false) => {
  const o = p.toObject ? p.toObject({ virtuals: true }) : p;
  return {
    id: o._id, _id: o._id, name: o.name, description: o.description, category: o.category, images: o.images,
    price: o.price, salePrice: o.salePrice, effectivePrice: p.effectivePrice, onSale: p.effectivePrice < o.price,
    isNew: p.isNewArrival, status: o.status, totalStock: p.totalStock, createdAt: o.createdAt,
    variations: o.variations.map((v) => ({
      _id: v._id, size: v.size, color: v.color, colorHex: v.colorHex, stockQuantity: v.stockQuantity,
      ...(withBarcodes ? { barcode: v.barcode, sku: v.sku } : {}),
    })),
  };
};

export const listProducts = asyncHandler(async (req, res) => {
  const { q, category, sort } = req.query;
  const { page, limit, skip } = parsePagination(req.query, 12, 60);
  const isStaff = staff(req.user);
  const filter = { status: 'active' };
  if (['women', 'men', 'kids'].includes(category)) filter.category = category;
  if (q && String(q).trim()) {
    const rx = new RegExp(escapeRegex(String(q).trim()), 'i');
    filter.$or = [{ name: rx }, ...(isStaff ? [{ 'variations.barcode': String(q).trim() }] : [])];
  }
  const sortBy = sort === 'price_asc' ? { price: 1, _id: 1 } : sort === 'price_desc' ? { price: -1, _id: 1 } : { createdAt: -1, _id: 1 };
  const [items, total] = await Promise.all([Product.find(filter).sort(sortBy).skip(skip).limit(limit), Product.countDocuments(filter)]);
  ok(res, {
    products: items.map((p) => serializeProduct(p, isStaff)),
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
});

export const getProduct = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'product id');
  const p = await Product.findOne({ _id: req.params.id, status: 'active' });
  if (!p) throw new AppError('Product not found', 404);
  ok(res, { product: serializeProduct(p, staff(req.user)) });
});

export const getByBarcode = asyncHandler(async (req, res) => {
  const barcode = String(req.params.barcode).trim();
  const p = await Product.findOne({ 'variations.barcode': barcode });
  if (!p) throw new AppError('Unknown barcode', 404, undefined, 'BARCODE_NOT_FOUND');
  const v = p.variations.find((x) => x.barcode === barcode);
  if (p.status !== 'active') throw new AppError(`${p.name} is currently unavailable`, 409, undefined, 'PRODUCT_INACTIVE');
  ok(res, { product: serializeProduct(p, true), variation: { _id: v._id, size: v.size, color: v.color, colorHex: v.colorHex, barcode: v.barcode, stockQuantity: v.stockQuantity } });
});
