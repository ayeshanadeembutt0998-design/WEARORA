import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const COOKIE_NAME = 'wearora_token';
export const RESET_COOKIE = 'wearora_reset';

const baseCookie = () => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.cookieSameSite,
  path: '/',
});

const toMs = (s) => {
  const m = /^(\d+)([smhd])$/.exec(s);
  if (!m) return 24 * 3600 * 1000;
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2]];
  return Number(m[1]) * mult;
};

export function signAuthToken(user, remember = false) {
  const expiresIn = remember ? env.jwtRememberExpiresIn : env.jwtExpiresIn;
  const token = jwt.sign({ sub: String(user._id), role: user.role }, env.jwtSecret, { expiresIn });
  return { token, maxAge: toMs(expiresIn) };
}

export function setAuthCookie(res, user, remember = false) {
  const { token, maxAge } = signAuthToken(user, remember);
  res.cookie(COOKIE_NAME, token, { ...baseCookie(), maxAge });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, baseCookie());
}

export function setResetCookie(res, otpId, userId) {
  const token = jwt.sign({ otp: String(otpId), sub: String(userId), purpose: 'reset' }, env.jwtSecret, { expiresIn: '10m' });
  res.cookie(RESET_COOKIE, token, { ...baseCookie(), maxAge: 10 * 60 * 1000 });
}
export const clearResetCookie = (res) => res.clearCookie(RESET_COOKIE, baseCookie());
export const verifyJwt = (t) => jwt.verify(t, env.jwtSecret);
