import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    kind: { type: String, enum: ['payment', 'refund', 'additional_payment'], default: 'payment' },
    method: { type: String, enum: ['cod', 'online', 'cash', 'card', 'wallet'], required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'], required: true },
    transactionReference: { type: String, required: true },
    simulated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('Payment', paymentSchema);
