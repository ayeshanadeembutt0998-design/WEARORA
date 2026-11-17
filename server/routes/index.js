import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { authorize, optionalAuth, protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { productImageUpload } from '../middleware/upload.js';
import * as S from '../utils/validators.js';
import * as auth from '../controllers/authController.js';
import * as users from '../controllers/userController.js';
import * as products from '../controllers/productController.js';
import * as cart from '../controllers/cartController.js';
import * as orders from '../controllers/orderController.js';
import * as aProducts from '../controllers/adminProductController.js';
import * as aOrders from '../controllers/adminOrderController.js';
import * as aCashiers from '../controllers/adminCashierController.js';
import * as pos from '../controllers/posController.js';
import * as returns from '../controllers/returnController.js';

const router = Router();
const limiter = (max, windowMs = 15 * 60 * 1000) => rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, skip: () => env.isTest, message: { success: false, message: 'Too many requests. Please try again later.' } });
const staff = authorize('cashier', 'admin');
const adminOnly = [protect, authorize('admin')];

router.get('/health', (_req, res) => res.json({ success: true, status: 'ok', time: new Date().toISOString() }));
router.get('/config', (_req, res) => res.json({ success: true, store: { ...env.store, pickupEnabled: env.store.pickupEnabled } }));

// ---------- Auth ----------
router.post('/auth/signup', limiter(20), validate(S.signupSchema), auth.signup);
router.post('/auth/signin', limiter(30), validate(S.signinSchema), auth.signin);
router.post('/auth/google', limiter(30), auth.googleAuth);
router.get('/auth/signout', auth.signout);
router.get('/auth/me', optionalAuth, auth.me);
router.post('/auth/forgot-password', limiter(10), validate(S.forgotSchema), auth.forgotPassword);
router.post('/auth/verify-otp', limiter(20), validate(S.verifyOtpSchema), auth.verifyOtp);
router.post('/auth/reset-password', limiter(10), validate(S.resetPasswordSchema), auth.resetPassword);

// ---------- Profile (all signed-in roles) ----------
router.get('/users/profile', protect, users.getProfile);
router.patch('/users/profile', protect, validate(S.profileUpdateSchema), users.updateProfile);
router.patch('/users/change-password', protect, limiter(10), validate(S.changePasswordSchema), users.changePassword);
router.post('/users/email-change', protect, authorize('customer'), limiter(10), users.requestEmailChange);
router.post('/users/email-change/verify', protect, authorize('customer'), limiter(20), users.confirmEmailChange);

// ---------- Catalogue ----------
router.get('/products', optionalAuth, products.listProducts);
router.get('/products/barcode/:barcode', protect, staff, products.getByBarcode);
router.get('/products/:id', optionalAuth, products.getProduct);

// ---------- Cart (customer) ----------
router.post('/cart/price', validate(S.cartPriceSchema), cart.priceGuestCart);
router.post('/cart/merge', protect, authorize('customer'), validate(S.cartPriceSchema), cart.mergeCart);
router.get('/cart', protect, authorize('customer'), cart.getCart);
router.post('/cart', protect, authorize('customer'), validate(S.cartAddSchema), cart.addToCart);
router.delete('/cart', protect, authorize('customer'), cart.clearCart);
router.patch('/cart/:itemId', protect, authorize('customer'), validate(S.cartPatchSchema), cart.updateCartItem);
router.delete('/cart/:itemId', protect, authorize('customer'), cart.removeCartItem);

// ---------- Customer orders ----------
router.post('/orders', protect, authorize('customer'), validate(S.checkoutSchema), orders.createOrder);
router.get('/orders/my-orders', protect, authorize('customer'), orders.myOrders);
router.get('/orders/:id', protect, authorize('customer'), orders.getMyOrder);
router.patch('/orders/:id/cancel', protect, authorize('customer'), orders.cancelMyOrder);

// ---------- Admin ----------
router.post('/admin/products/images', ...adminOnly, productImageUpload.array('images', 5), aProducts.uploadImages);
router.post('/admin/products', ...adminOnly, validate(S.productSchema), aProducts.createProduct);
router.get('/admin/products', ...adminOnly, aProducts.listProducts);
router.get('/admin/products/:id', ...adminOnly, aProducts.getProduct);
router.patch('/admin/products/:id', ...adminOnly, validate(S.productSchema), aProducts.updateProduct);
router.patch('/admin/products/:id/stock', ...adminOnly, aProducts.adjustStock);
router.get('/admin/products/:id/movements', ...adminOnly, aProducts.getMovements);
router.delete('/admin/products/:id', ...adminOnly, aProducts.deleteProduct);

router.get('/admin/orders', ...adminOnly, aOrders.listOrders);
router.get('/admin/orders/:id', ...adminOnly, aOrders.getOrder);
router.patch('/admin/orders/:id/status', ...adminOnly, validate(S.orderStatusSchema), aOrders.updateStatus);

router.post('/admin/cashiers', ...adminOnly, validate(S.cashierCreateSchema), aCashiers.createCashier);
router.get('/admin/cashiers', ...adminOnly, aCashiers.listCashiers);
router.get('/admin/cashiers/:id', ...adminOnly, aCashiers.getCashier);
router.patch('/admin/cashiers/:id', ...adminOnly, validate(S.cashierUpdateSchema), aCashiers.updateCashier);
router.patch('/admin/cashiers/:id/status', ...adminOnly, validate(S.cashierStatusSchema), aCashiers.setStatus);
router.post('/admin/cashiers/:id/reset-password', ...adminOnly, limiter(20), aCashiers.resetPassword);

// ---------- Cashier / POS (admin has administrative access) ----------
const posAccess = [protect, staff];
router.get('/cashier/customers/search', ...posAccess, pos.searchCustomers);
router.get('/cashier/profile', protect, authorize('cashier'), pos.cashierProfile);

router.post('/pos/sales', ...posAccess, validate(S.posSaleSchema), pos.createSale);
router.get('/pos/sales', ...posAccess, pos.listSales);
router.get('/pos/sales/my-sales', ...posAccess, pos.listSales);
router.get('/pos/sales/:id', ...posAccess, pos.getSale);

router.get('/pos/receipts/:id/verify', pos.verifyReceipt); // public (QR target)
router.get('/pos/receipts/:id/pdf', ...posAccess, pos.getReceiptPdf);
router.post('/pos/receipts/:id/email', ...posAccess, limiter(30), pos.emailReceipt);
router.get('/pos/receipts/:id', ...posAccess, pos.getReceipt);

router.get('/pos/returns', ...posAccess, returns.listReturns);
router.get('/pos/returns/receipt/:receiptNumber', ...posAccess, returns.lookupReceipt);
router.post('/pos/returns', ...posAccess, validate(S.returnSchema), returns.processReturn);
router.post('/pos/exchanges', ...posAccess, validate(S.exchangeSchema), returns.processExchange);

export default router;
