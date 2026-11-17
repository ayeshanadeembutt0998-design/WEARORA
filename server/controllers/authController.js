import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import { env } from '../config/env.js';
import { getFirebaseAuth } from '../config/firebase.js';
import { AppError, asyncHandler, ok } from '../utils/AppError.js';
import { clearAuthCookie, clearResetCookie, RESET_COOKIE, setAuthCookie, setResetCookie, verifyJwt } from '../utils/token.js';
import { queueEmail, sendTemplateEmail } from '../utils/mailer.js';

const hashPw = (pw) => bcrypt.hash(pw, 12);
const DUMMY_HASH = bcrypt.hashSync('wearora-dummy-password-1', 10);
export const hashOtp = (otp, email) => crypto.createHmac('sha256', env.jwtSecret).update(`${email}:${otp}`).digest('hex');
const otpMeta = () => ({ expiresInSeconds: env.otp.expirySeconds, resendAfterSeconds: env.otp.resendSeconds });

export const signup = asyncHandler(async (req, res) => {
  const { fullName, email, mobile, password } = req.body;
  if (await User.exists({ email })) throw new AppError('An account with this email already exists', 409, { email: 'Email already registered' });
  // role is ALWAYS customer for public registrations – any role in the payload is ignored by the schema.
  const user = await User.create({ fullName, email, mobile, passwordHash: await hashPw(password), role: 'customer', authProvider: 'local' });
  setAuthCookie(res, user);
  queueEmail({ dedupeKey: `welcome:${user._id}`, type: 'welcome', to: user.email, data: { user } });
  ok(res, { user: user.toSafeJSON() }, 'Account created successfully', 201);
});

export const signin = asyncHandler(async (req, res) => {
  const { email, password, remember, portal } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !user.passwordHash || !valid) throw new AppError('Invalid email or password', 401);
  if (user.accountStatus !== 'active') throw new AppError('This account has been deactivated. Please contact the store.', 403);
  // Each interface only accepts its own role (admin may use cashier portal? no – keep strict).
  if (portal && user.role !== portal) throw new AppError('Invalid email or password', 401);
  user.lastLoginAt = new Date();
  await user.save();
  setAuthCookie(res, user, Boolean(remember));
  ok(res, { user: user.toSafeJSON() }, 'Signed in successfully');
});

export const googleAuth = asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  const auth = getFirebaseAuth();
  if (!auth) throw new AppError('Google sign-in is not configured on the server', 503, undefined, 'GOOGLE_NOT_CONFIGURED');
  let decoded;
  try { decoded = await auth.verifyIdToken(idToken); } catch { throw new AppError('Google authentication failed. Please try again.', 401); }
  const email = String(decoded.email || '').toLowerCase();
  if (!email || decoded.email_verified === false) throw new AppError('Your Google account email is not verified', 401);

  let user = await User.findOne({ $or: [{ firebaseUid: decoded.uid }, { email }] });
  let created = false;
  if (user) {
    if (user.role !== 'customer') throw new AppError('Google sign-in is only available for customer accounts', 403);
    if (user.accountStatus !== 'active') throw new AppError('This account has been deactivated. Please contact the store.', 403);
    if (!user.firebaseUid) user.firebaseUid = decoded.uid;
    user.lastLoginAt = new Date();
    await user.save();
  } else {
    user = await User.create({
      fullName: (decoded.name || email.split('@')[0]).slice(0, 80),
      email, firebaseUid: decoded.uid, authProvider: 'google', role: 'customer', mobile: '', lastLoginAt: new Date(),
    });
    created = true;
    queueEmail({ dedupeKey: `welcome:${user._id}`, type: 'welcome', to: user.email, data: { user } });
  }
  setAuthCookie(res, user, true);
  ok(res, { user: user.toSafeJSON(), created }, created ? 'Account created with Google' : 'Signed in with Google');
});

export const signout = (req, res) => {
  clearAuthCookie(res);
  clearResetCookie(res);
  res.json({ success: true, message: 'Signed out successfully' });
};

/** Session probe: 200 with user:null for guests (avoids noisy 401s in the browser console). */
export const me = asyncHandler(async (req, res) => ok(res, { user: req.user ? req.user.toSafeJSON() : null }));

/** Always responds identically so registered emails cannot be enumerated. */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const generic = () => ok(res, { ...otpMeta() }, 'If this email is registered, a verification code has been sent.');
  const user = await User.findOne({ email, role: 'customer', accountStatus: 'active' });
  if (!user) return generic();

  const last = await Otp.findOne({ userId: user._id, purpose: 'password_reset', invalidatedAt: null, consumedAt: null }).sort({ createdAt: -1 });
  if (last && last.resendAfter > new Date()) return generic(); // cooldown – silently ignore

  await Otp.updateMany({ userId: user._id, purpose: 'password_reset', consumedAt: null, invalidatedAt: null }, { invalidatedAt: new Date() });
  const otp = String(crypto.randomInt(100000, 1000000));
  const rec = await Otp.create({
    userId: user._id, email, purpose: 'password_reset', otpHash: hashOtp(otp, email),
    expiresAt: new Date(Date.now() + env.otp.expirySeconds * 1000),
    resendAfter: new Date(Date.now() + env.otp.resendSeconds * 1000),
  });
  queueEmail({ dedupeKey: `otp:${rec._id}`, type: 'passwordResetOtp', to: email, data: { user, otp, minutes: Math.ceil(env.otp.expirySeconds / 60) } });
  generic();
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const invalid = () => new AppError('Invalid or expired verification code', 400, undefined, 'OTP_INVALID');
  const user = await User.findOne({ email, role: 'customer' });
  if (!user) throw invalid();
  const rec = await Otp.findOne({ userId: user._id, purpose: 'password_reset', consumedAt: null, invalidatedAt: null }).sort({ createdAt: -1 });
  if (!rec || rec.expiresAt < new Date()) throw invalid();
  if (rec.attempts >= env.otp.maxAttempts) throw new AppError('Too many incorrect attempts. Please request a new code.', 429, undefined, 'OTP_LOCKED');

  const good = crypto.timingSafeEqual(Buffer.from(hashOtp(otp, email)), Buffer.from(rec.otpHash));
  if (!good) {
    rec.attempts += 1;
    await rec.save();
    const left = env.otp.maxAttempts - rec.attempts;
    throw new AppError(left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} remaining.` : 'Too many incorrect attempts. Please request a new code.', left > 0 ? 400 : 429, undefined, left > 0 ? 'OTP_INVALID' : 'OTP_LOCKED');
  }
  rec.verifiedAt = new Date();
  await rec.save();
  setResetCookie(res, rec._id, user._id);
  ok(res, {}, 'Email verified');
});

export const resetPassword = asyncHandler(async (req, res) => {
  const token = req.cookies?.[RESET_COOKIE];
  const denied = () => new AppError('Your verification has expired. Please start again.', 401, undefined, 'RESET_UNAUTHORIZED');
  if (!token) throw denied();
  let payload;
  try { payload = verifyJwt(token); } catch { throw denied(); }
  if (payload.purpose !== 'reset') throw denied();
  const rec = await Otp.findOne({ _id: payload.otp, userId: payload.sub, purpose: 'password_reset', consumedAt: null, invalidatedAt: null });
  if (!rec || !rec.verifiedAt || Date.now() - rec.verifiedAt.getTime() > 10 * 60 * 1000) throw denied();

  // Consume atomically so the OTP is single-use even under concurrent requests.
  const consumed = await Otp.findOneAndUpdate({ _id: rec._id, consumedAt: null }, { consumedAt: new Date() });
  if (!consumed) throw denied();
  const user = await User.findById(payload.sub);
  if (!user) throw denied();
  user.passwordHash = await hashPw(req.body.password);
  user.passwordChangedAt = new Date();
  await user.save();
  await Otp.updateMany({ userId: user._id, consumedAt: null }, { invalidatedAt: new Date() });
  clearResetCookie(res);
  clearAuthCookie(res);
  ok(res, {}, 'Password updated successfully');
});

// re-export for users controller
export { sendTemplateEmail };
