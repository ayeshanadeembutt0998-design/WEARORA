import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    email: { type: String, required: true, lowercase: true, index: true }, // address the OTP was sent to
    purpose: { type: String, enum: ['password_reset', 'email_change'], required: true },
    newEmail: { type: String, lowercase: true }, // for email_change
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    resendAfter: { type: Date, required: true },
    verifiedAt: Date,
    consumedAt: Date,
    invalidatedAt: Date,
  },
  { timestamps: true }
);
// Documents are removed automatically a day after expiry.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model('Otp', otpSchema);
