import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import { env } from '../config/env.js';
import { AppError, asyncHandler, ok } from '../utils/AppError.js';
import { hashOtp } from './authController.js';
import { queueEmail } from '../utils/mailer.js';
import { setAuthCookie } from '../utils/token.js';
import { emailSchema } from '../utils/validators.js';

export const getProfile = asyncHandler(async (req, res) => ok(res, { user: req.user.toSafeJSON() }));

export const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, mobile, address } = req.body;
  const u = req.user;
  if (fullName) u.fullName = fullName;
  if (mobile) u.mobile = mobile;
  if (address) u.address = { line1: address.line1 ?? u.address?.line1 ?? '', city: address.city ?? u.address?.city ?? '' };
  await u.save();
  ok(res, { user: u.toSafeJSON() }, 'Profile updated');
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (user.passwordHash) {
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw new AppError('Current password is incorrect', 400, { currentPassword: 'Incorrect password' });
    if (await bcrypt.compare(newPassword, user.passwordHash)) throw new AppError('New password must be different from the current password', 400);
  }
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.passwordChangedAt = new Date();
  user.mustChangePassword = false;
  await user.save();
  setAuthCookie(res, user); // re-issue session (old tokens are now invalid)
  ok(res, { user: user.toSafeJSON() }, 'Password changed successfully');
});

/** Email change requires OTP verification sent to the NEW address. */
export const requestEmailChange = asyncHandler(async (req, res) => {
  const parsed = emailSchema.safeParse(req.body.newEmail);
  if (!parsed.success) throw new AppError('Enter a valid email address', 422);
  const newEmail = parsed.data;
  if (newEmail === req.user.email) throw new AppError('That is already your email address', 400);
  if (await User.exists({ email: newEmail })) throw new AppError('This email is already in use', 409);
  const last = await Otp.findOne({ userId: req.user._id, purpose: 'email_change', consumedAt: null, invalidatedAt: null }).sort({ createdAt: -1 });
  if (last && last.resendAfter > new Date()) throw new AppError('Please wait before requesting another code', 429);
  await Otp.updateMany({ userId: req.user._id, purpose: 'email_change', consumedAt: null }, { invalidatedAt: new Date() });
  const otp = String(crypto.randomInt(100000, 1000000));
  const rec = await Otp.create({
    userId: req.user._id, email: newEmail, newEmail, purpose: 'email_change', otpHash: hashOtp(otp, newEmail),
    expiresAt: new Date(Date.now() + env.otp.expirySeconds * 1000), resendAfter: new Date(Date.now() + env.otp.resendSeconds * 1000),
  });
  queueEmail({ dedupeKey: `otp:${rec._id}`, type: 'emailVerificationOtp', to: newEmail, data: { user: req.user, otp, minutes: Math.ceil(env.otp.expirySeconds / 60) } });
  ok(res, { expiresInSeconds: env.otp.expirySeconds, resendAfterSeconds: env.otp.resendSeconds }, 'Verification code sent to your new email');
});

export const confirmEmailChange = asyncHandler(async (req, res) => {
  const otp = String(req.body.otp || '');
  if (!/^\d{6}$/.test(otp)) throw new AppError('Enter the 6-digit code', 422);
  const rec = await Otp.findOne({ userId: req.user._id, purpose: 'email_change', consumedAt: null, invalidatedAt: null }).sort({ createdAt: -1 });
  if (!rec || rec.expiresAt < new Date()) throw new AppError('Invalid or expired verification code', 400);
  if (rec.attempts >= env.otp.maxAttempts) throw new AppError('Too many incorrect attempts. Request a new code.', 429);
  if (hashOtp(otp, rec.email) !== rec.otpHash) {
    rec.attempts += 1; await rec.save();
    throw new AppError('Incorrect verification code', 400);
  }
  const claimed = await Otp.findOneAndUpdate({ _id: rec._id, consumedAt: null }, { consumedAt: new Date(), verifiedAt: new Date() });
  if (!claimed) throw new AppError('Invalid or expired verification code', 400);
  if (await User.exists({ email: rec.newEmail })) throw new AppError('This email is already in use', 409);
  req.user.email = rec.newEmail;
  await req.user.save();
  ok(res, { user: req.user.toSafeJSON() }, 'Email updated successfully');
});
