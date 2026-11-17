import User from '../models/User.js';
import { AppError, asyncHandler } from '../utils/AppError.js';
import { COOKIE_NAME, verifyJwt } from '../utils/token.js';

async function loadUser(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  let payload;
  try { payload = verifyJwt(token); } catch { return null; }
  const user = await User.findById(payload.sub);
  if (!user || user.accountStatus !== 'active') return null;
  // A password change invalidates tokens issued before it.
  if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000) return null;
  return user;
}

export const protect = asyncHandler(async (req, _res, next) => {
  const user = await loadUser(req);
  if (!user) throw new AppError('Please sign in to continue', 401, undefined, 'UNAUTHENTICATED');
  req.user = user;
  next();
});

export const optionalAuth = asyncHandler(async (req, _res, next) => {
  req.user = (await loadUser(req)) || undefined;
  next();
});

export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new AppError('Please sign in to continue', 401, undefined, 'UNAUTHENTICATED'));
  if (!roles.includes(req.user.role)) return next(new AppError('You do not have permission to perform this action', 403, undefined, 'FORBIDDEN'));
  next();
};
