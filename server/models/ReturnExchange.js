import mongoose from 'mongoose';

const lineSchema = new mongoose.Schema({
  orderItemId: mongoose.Schema.Types.ObjectId,
  productId: mongoose.Schema.Types.ObjectId,
  variationId: mongoose.Schema.Types.ObjectId,
  productNameSnapshot: String,
  size: String,
  color: String,
  barcode: String,
  quantity: Number,
  unitPrice: Number,
  amount: Number,
  resellable: Boolean,
});

const returnExchangeSchema = new mongoose.Schema(
  {
    originalOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    originalOrderNumber: String,
    referenceNumber: { type: String, required: true, unique: true },
    cashierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    transactionType: { type: String, enum: ['return', 'exchange'], required: true },
    returnedItems: [lineSchema],
    replacementItems: [lineSchema],
    returnReason: { type: String, enum: ['wrong_size', 'defective', 'wrong_product', 'other'], required: true },
    reasonNote: String,
    refundAmount: { type: Number, default: 0 },
    additionalPayment: { type: Number, default: 0 },
    refundMethod: { type: String, enum: ['cash', 'card', 'wallet', 'none'], default: 'none' },
    additionalPaymentMethod: { type: String, enum: ['cash', 'card', 'wallet', 'none'], default: 'none' },
    transactionStatus: { type: String, enum: ['completed', 'failed'], default: 'completed' },
    idempotencyKey: String,
  },
  { timestamps: true }
);
returnExchangeSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

export default mongoose.model('ReturnExchange', returnExchangeSchema);
