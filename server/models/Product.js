import mongoose from 'mongoose';

const variationSchema = new mongoose.Schema({
  size: { type: String, required: true, trim: true },
  color: { type: String, required: true, trim: true },
  colorHex: { type: String, trim: true, default: '' },
  barcode: { type: String, required: true, trim: true },
  stockQuantity: { type: Number, required: true, min: 0, default: 0 },
  sku: { type: String, trim: true, default: '' },
});

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, default: '' },
    category: { type: String, enum: ['women', 'men', 'kids'], required: true },
    images: { type: [String], default: [] },
    price: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, min: 0, default: null },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    variations: { type: [variationSchema], default: [] },
  },
  { timestamps: true }
);

// Barcode must be unique across every variation of every product.
productSchema.index({ 'variations.barcode': 1 }, { unique: true });
productSchema.index({ name: 'text' });
productSchema.index({ status: 1, category: 1, price: 1 });

productSchema.virtual('effectivePrice').get(function () {
  return this.salePrice != null && this.salePrice < this.price ? this.salePrice : this.price;
});
productSchema.virtual('totalStock').get(function () {
  return this.variations.reduce((s, v) => s + v.stockQuantity, 0);
});
productSchema.virtual('isNewArrival').get(function () {
  return Date.now() - new Date(this.createdAt).getTime() < 14 * 24 * 3600 * 1000;
});
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

export default mongoose.model('Product', productSchema);
