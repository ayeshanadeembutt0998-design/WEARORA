import dotenv from 'dotenv';
dotenv.config();

const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));
const bool = (v, d) => (v === undefined || v === '' ? d : String(v).toLowerCase() === 'true');

export const env = {
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: num(process.env.PORT, 5000),
  clientUrl: (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, ''),
  serverPublicUrl: (process.env.SERVER_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, ''),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  jwtRememberExpiresIn: process.env.JWT_REMEMBER_EXPIRES_IN || '30d',
  cookieSameSite: process.env.COOKIE_SAMESITE || 'lax',
  admin: {
    name: process.env.ADMIN_NAME || 'Wearora Admin',
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    mobile: process.env.ADMIN_MOBILE || '03000000000',
  },
  otp: {
    expirySeconds: num(process.env.OTP_EXPIRY_SECONDS, 120),
    resendSeconds: num(process.env.OTP_RESEND_SECONDS, 60),
    maxAttempts: num(process.env.OTP_MAX_ATTEMPTS, 5),
  },
  store: {
    currency: process.env.CURRENCY || 'PKR',
    currencySymbol: process.env.CURRENCY_SYMBOL || 'Rs.',
    deliveryCharge: num(process.env.DELIVERY_CHARGE, 250),
    freeDeliveryThreshold: num(process.env.FREE_DELIVERY_THRESHOLD, 5000),
    pickupEnabled: bool(process.env.STORE_PICKUP_ENABLED, true),
    lowStockThreshold: num(process.env.LOW_STOCK_THRESHOLD, 5),
    maxPosDiscountPercent: num(process.env.MAX_POS_DISCOUNT_PERCENT, 10),
    returnWindowDays: num(process.env.RETURN_WINDOW_DAYS, 14),
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: num(process.env.SMTP_PORT, 587),
    secure: bool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'Wearora <no-reply@wearora.com>',
    transport: process.env.EMAIL_TRANSPORT, // "json" for tests
  },
};

export function assertEnv() {
  const missing = [];
  if (!env.mongoUri) missing.push('MONGODB_URI');
  if (!env.jwtSecret || env.jwtSecret.length < 16) missing.push('JWT_SECRET (min 16 chars)');
  if (missing.length) {
    throw new Error(`Missing/invalid environment variables: ${missing.join(', ')}`);
  }
}
