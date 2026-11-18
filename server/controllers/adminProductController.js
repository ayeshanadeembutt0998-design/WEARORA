import Product from '../models/Product.js';
import Order from '../models/Order.js';
import InventoryMovement from '../models/InventoryMovement.js';
import { env } from '../config/env.js';
import { AppError, asyncHandler, ok } from '../utils/AppError.js';
import {
  assertObjectId,
  escapeRegex,
  generateBarcode,
  parsePagination,
} from '../utils/helpers.js';

const summarize = (p) => {
  const o = p.toObject({ virtuals: true });

  return {
    ...o,
    id: o._id,
    totalStock: p.totalStock,
    effectivePrice: p.effectivePrice,
    lowStock: p.variations.some(
      (v) => v.stockQuantity <= env.store.lowStockThreshold
    ),
    outOfStock: p.totalStock === 0,
  };
};

const imgOk = (arr = []) =>
  Array.isArray(arr) &&
  arr.every((i) => {
    try {
      const url = new URL(i);

      return (
        url.protocol === 'https:' &&
        url.hostname === 'res.cloudinary.com' &&
        url.pathname.includes('/image/upload/')
      );
    } catch {
      return false;
    }
  });

async function normalizeVariations(vars, productId) {
  const seen = new Set();
  const barcodes = new Set();
  const result = [];

  for (const v of vars) {
    const key = `${v.size.toLowerCase()}|${v.color.toLowerCase()}`;

    if (seen.has(key)) {
      throw new AppError(
        `Duplicate variation: ${v.color} / ${v.size}`,
        422
      );
    }

    seen.add(key);

    let barcode = v.barcode || '';

    if (!barcode) {
      do {
        barcode = generateBarcode();
      } while (
        await Product.exists({ 'variations.barcode': barcode }) ||
        barcodes.has(barcode)
      );
    }

    if (barcodes.has(barcode)) {
      throw new AppError(
        `Barcode ${barcode} is used by more than one variation`,
        422
      );
    }

    barcodes.add(barcode);

    const clash = await Product.findOne({
      'variations.barcode': barcode,
      ...(productId ? { _id: { $ne: productId } } : {}),
    });

    if (clash) {
      throw new AppError(
        `Barcode ${barcode} is already assigned to "${clash.name}"`,
        409
      );
    }

    result.push({ ...v, barcode });
  }

  return result;
}

export const listProducts = asyncHandler(async (req, res) => {
  const { q, category, status, stock } = req.query;
  const { page, limit, skip } = parsePagination(req.query, 10, 100);

  const filter = {};

  if (q) {
    const rx = new RegExp(escapeRegex(String(q).trim()), 'i');

    filter.$or = [
      { name: rx },
      { 'variations.barcode': String(q).trim() },
    ];
  }

  if (['women', 'men', 'kids'].includes(category)) {
    filter.category = category;
  }

  if (['active', 'inactive'].includes(status)) {
    filter.status = status;
  }

  if (stock === 'low') {
    filter.variations = {
      $elemMatch: {
        stockQuantity: { $lte: env.store.lowStockThreshold },
      },
    };
  }

  const [items, total] = await Promise.all([
    Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  ok(res, {
    products: items.map(summarize),
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
    lowStockThreshold: env.store.lowStockThreshold,
  });
});

export const getProduct = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'product id');

  const p = await Product.findById(req.params.id);

  if (!p) {
    throw new AppError('Product not found', 404);
  }

  ok(res, { product: summarize(p) });
});

export const createProduct = asyncHandler(async (req, res) => {
  const b = req.body;

  if (!imgOk(b.images)) {
    throw new AppError('Invalid image reference', 422);
  }

  if (b.salePrice != null && b.salePrice >= b.price) {
    throw new AppError(
      'Sale price must be lower than the regular price',
      422,
      { salePrice: 'Must be lower than price' }
    );
  }

  const variations = await normalizeVariations(b.variations);

  const p = await Product.create({
    ...b,
    salePrice: b.salePrice ?? null,
    variations,
  });

  const moves = p.variations
    .filter((v) => v.stockQuantity > 0)
    .map((v) => ({
      productId: p._id,
      variationId: v._id,
      productName: p.name,
      size: v.size,
      color: v.color,
      movementType: 'initial_stock',
      quantity: v.stockQuantity,
      referenceType: 'Product',
      referenceId: p._id,
      previousStock: 0,
      newStock: v.stockQuantity,
      performedBy: req.user._id,
      note: 'Initial stock',
    }));

  if (moves.length) {
    await InventoryMovement.insertMany(moves);
  }

  ok(res, { product: summarize(p) }, 'Product created', 201);
});

/**
 * Updates product details & variations.
 * Stock of existing variations is intentionally not overwritten here.
 * Use PATCH /:id/stock for atomic, audited stock changes.
 */
export const updateProduct = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'product id');

  const p = await Product.findById(req.params.id);

  if (!p) {
    throw new AppError('Product not found', 404);
  }

  const b = req.body;

  if (b.images && !imgOk(b.images)) {
    throw new AppError('Invalid image reference', 422);
  }

  if (b.salePrice != null && b.salePrice >= b.price) {
    throw new AppError(
      'Sale price must be lower than the regular price',
      422,
      { salePrice: 'Must be lower than price' }
    );
  }

  const normalized = await normalizeVariations(b.variations, p._id);

  const incoming = new Map(
    normalized
      .filter((v) => v._id)
      .map((v) => [String(v._id), v])
  );

  const added = [];

  for (const ex of [...p.variations]) {
    const inc = incoming.get(String(ex._id));

    if (!inc) {
      ex.deleteOne();
      continue;
    }

    ex.size = inc.size;
    ex.color = inc.color;
    ex.colorHex = inc.colorHex;
    ex.barcode = inc.barcode;
    ex.sku = inc.sku;
  }

  for (const v of normalized.filter((x) => !x._id)) {
    p.variations.push(v);
    added.push(v);
  }

  Object.assign(p, {
    name: b.name,
    description: b.description,
    category: b.category,
    price: b.price,
    salePrice: b.salePrice ?? null,
    status: b.status,
    ...(b.images ? { images: b.images } : {}),
  });

  await p.save();

  for (const a of added) {
    const nv = p.variations.find(
      (v) => v.barcode === a.barcode
    );

    if (nv && nv.stockQuantity > 0) {
      await InventoryMovement.create({
        productId: p._id,
        variationId: nv._id,
        productName: p.name,
        size: nv.size,
        color: nv.color,
        movementType: 'initial_stock',
        quantity: nv.stockQuantity,
        referenceType: 'Product',
        referenceId: p._id,
        previousStock: 0,
        newStock: nv.stockQuantity,
        performedBy: req.user._id,
        note: 'New variation',
      });
    }
  }

  ok(res, { product: summarize(p) }, 'Product updated');
});

export const adjustStock = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'product id');

  const { variationId, mode, quantity, note } = req.body;
  const qty = Number(quantity);

  if (
    !Number.isInteger(qty) ||
    qty < 0 ||
    !['add', 'set'].includes(mode)
  ) {
    throw new AppError(
      'Provide a whole number quantity and mode "add" or "set"',
      422
    );
  }

  if (mode === 'add' && qty === 0) {
    throw new AppError('Quantity to add must be greater than 0', 422);
  }

  const p = await Product.findById(req.params.id);
  const v = p?.variations.id(variationId);

  if (!v) {
    throw new AppError('Variation not found', 404);
  }

  const filter = {
    _id: p._id,
    variations: {
      $elemMatch: {
        _id: v._id,
        ...(mode === 'set'
          ? { stockQuantity: v.stockQuantity }
          : {}),
      },
    },
  };

  const update =
    mode === 'add'
      ? { $inc: { 'variations.$.stockQuantity': qty } }
      : { $set: { 'variations.$.stockQuantity': qty } };

  const before = await Product.findOneAndUpdate(
    filter,
    update,
    { new: false }
  );

  if (!before) {
    throw new AppError(
      'Stock changed while you were editing. Please refresh and try again.',
      409
    );
  }

  const prev = before.variations.id(v._id).stockQuantity;
  const next = mode === 'add' ? prev + qty : qty;

  await InventoryMovement.create({
    productId: p._id,
    variationId: v._id,
    productName: p.name,
    size: v.size,
    color: v.color,
    movementType: 'admin_adjustment',
    quantity: next - prev,
    referenceType: 'Manual',
    note: note || (mode === 'add' ? 'Stock added' : 'Stock set'),
    previousStock: prev,
    newStock: next,
    performedBy: req.user._id,
  });

  const fresh = await Product.findById(p._id);

  ok(res, { product: summarize(fresh) }, 'Stock updated');
});

export const getMovements = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'product id');

  const moves = await InventoryMovement.find({
    productId: req.params.id,
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('performedBy', 'fullName role');

  ok(res, { movements: moves });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'product id');

  const p = await Product.findById(req.params.id);

  if (!p) {
    throw new AppError('Product not found', 404);
  }

  const hasHistory = await Order.exists({
    'items.productId': p._id,
  });

  if (hasHistory) {
    p.status = 'inactive';
    await p.save();

    return ok(
      res,
      { product: summarize(p), deactivated: true },
      'This product has order history, so it was deactivated instead of deleted'
    );
  }

  await Product.deleteOne({ _id: p._id });
  await InventoryMovement.deleteMany({ productId: p._id });

  // Cloudinary images are intentionally retained for now.
  ok(res, { deleted: true }, 'Product deleted');
});

export const uploadImages = asyncHandler(async (req, res) => {
  if (!req.files?.length) {
    throw new AppError('No images uploaded', 400);
  }

  ok(
    res,
    { images: req.files.map((file) => file.path) },
    'Images uploaded',
    201
  );
});