import mongoose from 'mongoose';

export const MOVEMENT_TYPES = [
  'online_sale',
  'pos_sale',
  'customer_return',
  'pos_return',
  'exchange',
  'admin_adjustment',
  'order_cancellation',
  'initial_stock',
];

const movementSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    variationId: { type: mongoose.Schema.Types.ObjectId, required: true },
    productName: String,
    size: String,
    color: String,
    movementType: { type: String, enum: MOVEMENT_TYPES, required: true },
    quantity: { type: Number, required: true }, // signed: negative = stock out
    referenceType: { type: String, enum: ['Order', 'ReturnExchange', 'Product', 'Manual'], default: 'Manual' },
    referenceId: mongoose.Schema.Types.ObjectId,
    note: String,
    previousStock: Number,
    newStock: Number,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
movementSchema.index({ createdAt: -1 });

export default mongoose.model('InventoryMovement', movementSchema);
