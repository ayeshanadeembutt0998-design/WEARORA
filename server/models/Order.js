import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productNameSnapshot: { type: String, required: true },
  imageSnapshot: { type: String, default: '' },
  variationId: { type: mongoose.Schema.Types.ObjectId, required: true },
  size: String,
  color: String,
  barcode: String,
  quantity: { type: Number, required: true, min: 1 },
  originalUnitPrice: { type: Number, required: true },
  unitPrice: { type: Number, required: true }, // after product sale price
  netUnitPrice: { type: Number, required: true }, // after order-level discount (used for refunds)
  subtotal: { type: Number, required: true }, // unitPrice * quantity
  returnedQty: { type: Number, default: 0 },
});

const statusHistorySchema = new mongoose.Schema(
  {
    status: String,
    note: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    orderType: { type: String, enum: ['online', 'pos'], required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    customerSnapshot: {
      fullName: String,
      mobile: String,
      email: String,
    },
    cashierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cashierName: String,
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    deliveryCharge: { type: Number, default: 0 },
    total: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['cod', 'online', 'cash', 'card', 'wallet'], required: true },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'],
      default: 'pending',
    },
    orderStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'ready_for_pickup', 'shipped', 'delivered', 'cancelled', 'completed'],
      default: 'pending',
    },
    deliveryMethod: { type: String, enum: ['home', 'pickup', 'in_store'], default: 'home' },
    deliveryInformation: {
      fullName: String,
      mobile: String,
      email: String,
      city: String,
      address: String,
      instructions: String,
      estimatedFrom: Date,
      estimatedTo: Date,
    },
    // POS cash handling
    amountReceived: Number,
    changeDue: Number,
    posDiscountPercent: { type: Number, default: 0 },
    verifyToken: { type: String },
    idempotencyKey: { type: String },
    statusHistory: { type: [statusHistorySchema], default: [] },
    transactionReference: String,
  },
  { timestamps: true }
);

orderSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ cashierId: 1, createdAt: -1 });
orderSchema.index({ orderType: 1, createdAt: -1 });

export default mongoose.model('Order', orderSchema);
