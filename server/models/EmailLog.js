import mongoose from 'mongoose';

const emailLogSchema = new mongoose.Schema(
  {
    dedupeKey: { type: String, required: true, unique: true },
    type: { type: String, required: true },
    to: { type: String, required: true },
    subject: String,
    status: { type: String, enum: ['pending', 'sent', 'failed', 'skipped'], default: 'pending' },
    attempts: { type: Number, default: 0 },
    error: String,
    sentAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model('EmailLog', emailLogSchema);
