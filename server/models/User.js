import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    mobile: { type: String, trim: true, default: '' },
    passwordHash: { type: String, select: false },
    role: { type: String, enum: ['customer', 'admin', 'cashier'], default: 'customer', required: true },
    accountStatus: { type: String, enum: ['active', 'inactive'], default: 'active' },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    firebaseUid: { type: String, index: { unique: true, sparse: true } },
    address: {
      line1: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
    },
    mustChangePassword: { type: Boolean, default: false },
    passwordChangedAt: { type: Date },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ mobile: 1 });
userSchema.index({ role: 1, createdAt: -1 });

userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    fullName: this.fullName,
    email: this.email,
    mobile: this.mobile,
    role: this.role,
    accountStatus: this.accountStatus,
    authProvider: this.authProvider,
    address: this.address,
    mustChangePassword: this.mustChangePassword,
    profileComplete: this.role !== 'customer' || Boolean(this.mobile),
    createdAt: this.createdAt,
  };
};

export default mongoose.model('User', userSchema);
