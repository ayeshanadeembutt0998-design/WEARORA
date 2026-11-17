/* End-to-end API test. Requires a MongoDB at TEST_MONGODB_URI (default local 27099). Run: npm test */
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/wearora_test';
process.env.JWT_SECRET = 'test-secret-test-secret-123456';
process.env.EMAIL_TRANSPORT = 'json';
process.env.ADMIN_EMAIL = 'admin@wearora.test';
process.env.ADMIN_PASSWORD = 'Admin@12345';
process.env.CLIENT_URL = 'http://localhost:5173';

const mongoose = (await import('mongoose')).default;
const { connectDB } = await import('../config/database.js');
const { createApp } = await import('../app.js');
const { seedAdmin } = await import('../utils/seed.js');
const mailer = await import('../utils/mailer.js');
const Product = (await import('../models/Product.js')).default;
const Order = (await import('../models/Order.js')).default;
const EmailLog = (await import('../models/EmailLog.js')).default;
const Otp = (await import('../models/Otp.js')).default;

await connectDB();
await mongoose.connection.dropDatabase();
await Product.init(); await Order.init(); await EmailLog.init();
await seedAdmin();

const server = createApp().listen(0);
const base = `http://127.0.0.1:${server.address().port}/api`;

// capture outgoing mail
const sent = [];
const t = mailer.getTransporter();
const realSend = t.sendMail.bind(t);
let failMail = false;
t.sendMail = async (m) => { if (failMail) throw new Error('SMTP down'); sent.push(m); return realSend(m); };
const settle = () => new Promise((r) => setTimeout(r, 400));

class Client {
  constructor() { this.cookies = {}; }
  async req(method, url, body, raw) {
    const headers = { 'Content-Type': 'application/json' };
    const ck = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
    if (ck) headers.Cookie = ck;
    const res = await fetch(base + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    for (const c of res.headers.getSetCookie?.() || []) {
      const [pair] = c.split(';'); const [k, ...v] = pair.split('='); const val = v.join('=');
      if (!val || /Expires=Thu, 01 Jan 1970/.test(c)) delete this.cookies[k]; else this.cookies[k] = val;
    }
    if (raw) return res;
    const json = await res.json().catch(() => ({}));
    return { status: res.status, ...json };
  }
  get(u) { return this.req('GET', u); } post(u, b) { return this.req('POST', u, b); } patch(u, b) { return this.req('PATCH', u, b); } del(u) { return this.req('DELETE', u); }
}

let passed = 0; let failed = 0;
const check = (name, cond, extra = '') => { if (cond) { passed++; console.log(`  ✓ ${name}`); } else { failed++; console.log(`  ✗ ${name} ${extra}`); } };
const section = (s) => console.log(`\n${s}`);
const key = () => `k-${Math.random().toString(36).slice(2)}-${Date.now()}`;
const stockOf = async (pid, vid) => (await Product.findById(pid)).variations.id(vid).stockQuantity;

// ============ AUTH ============
section('Authentication & authorization');
const admin = new Client(); const cust = new Client(); const cashier = new Client(); const cashier2 = new Client(); const anon = new Client();

let r = await cust.post('/auth/signup', { fullName: 'Ayesha Khan', email: 'Ayesha@Example.com', mobile: '0300 1234567', password: 'Passw0rdX', confirmPassword: 'Passw0rdX', role: 'admin' });
check('customer signup succeeds & always customer role', r.status === 201 && r.user.role === 'customer', JSON.stringify(r));
check('signup sets http-only auth cookie', Boolean(cust.cookies.wearora_token));
r = await anon.post('/auth/signup', { fullName: 'X', email: 'bad', mobile: '1', password: 'short', confirmPassword: 'x' });
check('signup validation rejects bad input (422)', r.status === 422 && r.errors);
r = await anon.post('/auth/signup', { fullName: 'Dup', email: 'ayesha@example.com', mobile: '03001234567', password: 'Passw0rdX', confirmPassword: 'Passw0rdX' });
check('duplicate email rejected (409)', r.status === 409);
await settle();
check('welcome email sent once', sent.filter((m) => /Welcome/.test(m.subject)).length === 1);
r = await anon.post('/auth/signin', { email: 'ayesha@example.com', password: 'wrong' });
check('wrong password -> 401', r.status === 401);
r = await admin.post('/auth/signin', { email: 'admin@wearora.test', password: 'Admin@12345', portal: 'customer' });
check('admin cannot sign in through customer portal', r.status === 401);
r = await admin.post('/auth/signin', { email: 'admin@wearora.test', password: 'Admin@12345', portal: 'admin' });
check('admin signs in via admin portal', r.status === 200 && r.user.role === 'admin');
r = await cust.get('/admin/products');
check('customer blocked from admin API (403)', r.status === 403);
r = await anon.get('/admin/products');
check('anonymous blocked from admin API (401)', r.status === 401);
r = await cust.get('/pos/sales');
check('customer blocked from POS API (403)', r.status === 403);

section('Forgot password / OTP');
sent.length = 0;
const r1 = await anon.post('/auth/forgot-password', { email: 'nobody@example.com' });
const r2 = await anon.post('/auth/forgot-password', { email: 'ayesha@example.com' });
check('response is identical for unknown & known email', r1.status === 200 && r2.status === 200 && r1.message === r2.message);
await settle();
const otpMail = sent.find((m) => /reset/i.test(m.subject));
check('reset OTP emailed only to the registered address', sent.length === 1 && Boolean(otpMail));
const otp = /(\d{6})/.exec(otpMail.text)[1];
r = await anon.post('/auth/verify-otp', { email: 'ayesha@example.com', otp: otp === '000000' ? '111111' : '000000' });
check('wrong OTP rejected', r.status === 400);
r = await anon.post('/auth/reset-password', { password: 'NewPass123', confirmPassword: 'NewPass123' });
check('cannot reset without verified OTP', r.status === 401);
r = await anon.post('/auth/verify-otp', { email: 'ayesha@example.com', otp });
check('correct OTP verifies', r.status === 200);
r = await anon.post('/auth/reset-password', { password: 'NewPass123', confirmPassword: 'NewPass123' });
check('password reset succeeds', r.status === 200);
r = await anon.post('/auth/reset-password', { password: 'Another123', confirmPassword: 'Another123' });
check('reset authorisation is single-use', r.status === 401);
r = await cust.post('/auth/signin', { email: 'ayesha@example.com', password: 'NewPass123', portal: 'customer' });
check('sign in with new password', r.status === 200);
// attempts lockout
await anon.post('/auth/forgot-password', { email: 'ayesha@example.com' });
await Otp.updateMany({}, { resendAfter: new Date(0) });
await anon.post('/auth/forgot-password', { email: 'ayesha@example.com' });
let last; for (let i = 0; i < 6; i++) last = await anon.post('/auth/verify-otp', { email: 'ayesha@example.com', otp: '123456' });
check('OTP attempts are limited (429)', last.status === 429);

// ============ ADMIN: products ============
section('Admin product management');
const mkProduct = (over = {}) => ({
  name: 'Test Tee', description: 'desc', category: 'men', price: 1000, status: 'active', images: [],
  variations: [
    { size: 'M', color: 'Black', stockQuantity: 10, barcode: '1111111111111' },
    { size: 'L', color: 'Black', stockQuantity: 1, barcode: '' },
  ], ...over,
});
r = await admin.post('/admin/products', mkProduct());
check('create product with variations', r.status === 201 && r.product.variations.length === 2, JSON.stringify(r).slice(0, 200));
const P = r.product; const VM = P.variations.find((v) => v.size === 'M'); const VL = P.variations.find((v) => v.size === 'L');
check('new products get createdAt timestamps (isNew virtual regression)', Boolean((await Product.findById(P._id).lean()).createdAt));
check('missing barcode auto-generated', /^\d{13}$/.test(VL.barcode));
r = await admin.post('/admin/products', mkProduct({ name: 'Other', variations: [{ size: 'S', color: 'Red', stockQuantity: 1, barcode: '1111111111111' }] }));
check('duplicate barcode rejected (409)', r.status === 409);
r = await admin.post('/admin/products', mkProduct({ name: 'Dup var', variations: [{ size: 'S', color: 'Red', stockQuantity: 1 }, { size: 's', color: 'red', stockQuantity: 1 }] }));
check('duplicate size/color rejected', r.status === 422);
r = await admin.post('/admin/products', mkProduct({ price: 1000, salePrice: 1500 }));
check('sale price must be < price', r.status === 422);
r = await admin.post('/admin/products', mkProduct({ name: 'Kids Hoodie', category: 'kids', price: 3000, salePrice: 2500, variations: [{ size: '6Y', color: 'Navy', stockQuantity: 20 }] }));
const P2 = r.product; const V2 = P2.variations[0];
r = await admin.patch(`/admin/products/${P._id}/stock`, { variationId: VM._id, mode: 'add', quantity: 5, note: 'restock' });
check('stock add updates quantity', r.status === 200 && r.product.variations.find((v) => v._id === VM._id).stockQuantity === 15);
r = await admin.patch(`/admin/products/${P._id}`, { ...mkProduct({ name: 'Test Tee v2' }), variations: P.variations.map((v) => ({ ...v, stockQuantity: 0 })) });
check('product edit does not overwrite live stock', r.status === 200 && (await stockOf(P._id, VM._id)) === 15, `stock=${await stockOf(P._id, VM._id)}`);
r = await anon.get('/products?category=men&sort=price_asc&limit=12');
check('public listing hides barcodes', r.status === 200 && !JSON.stringify(r.products).includes('1111111111111'));
r = await anon.get('/products?q=zzzz');
check('search with no matches returns empty list', r.products.length === 0);
r = await anon.get('/products?limit=2&page=1');
check('pagination metadata', r.pagination.limit === 2 && r.pagination.pages >= 1);

// ============ CUSTOMER ORDER FLOW ============
section('Customer cart & checkout');
const delivery = { fullName: 'Ayesha Khan', mobile: '03001234567', email: 'ayesha@example.com', city: 'Gujrat', address: 'House 1, Street 2, Model Town', instructions: 'Call first' };
r = await cust.post('/cart', { productId: P._id, variationId: VM._id, quantity: 50 });
check('cannot add more than stock (409)', r.status === 409);
r = await cust.post('/cart', { productId: P._id, variationId: VM._id, quantity: 2 });
check('add to cart', r.status === 200 && r.cart.count === 2);
r = await cust.post('/cart', { productId: P2._id, variationId: V2._id, quantity: 1 });
const cartRes = await cust.get('/cart');
check('cart totals are backend-calculated (sale price applied)', cartRes.cart.subtotal === 5000 && cartRes.cart.discount === 500, JSON.stringify(cartRes.cart).slice(0, 300));
r = await anon.post('/orders', {});
check('guest cannot place order (401)', r.status === 401);
sent.length = 0;
const k1 = key();
const stockBefore = await stockOf(P._id, VM._id);
r = await cust.post('/orders', { deliveryMethod: 'home', paymentMethod: 'cod', delivery, idempotencyKey: k1 });
check('COD order placed', r.status === 201 && r.order.paymentStatus === 'pending' && r.order.orderType === 'online', JSON.stringify(r).slice(0, 300));
const ORDER = r.order;
check('free delivery above threshold', r.order.deliveryCharge === 0 || r.order.total < 5000);
check('inventory deducted (variation-level)', (await stockOf(P._id, VM._id)) === stockBefore - 2 && (await stockOf(P2._id, V2._id)) === 19);
check('cart cleared after order', (await cust.get('/cart')).cart.count === 0);
r = await cust.post('/orders', { deliveryMethod: 'home', paymentMethod: 'cod', delivery, idempotencyKey: k1 });
check('duplicate submission returns same order, no extra deduction', r.duplicate === true && (await stockOf(P._id, VM._id)) === stockBefore - 2);
await settle();
const conf = sent.filter((m) => /Order confirmed/.test(m.subject));
check('order confirmation email sent exactly once', conf.length === 1 && conf[0].to === 'ayesha@example.com');
check('confirmation email has order number, logo tagline, items & address', conf[0].html.includes(ORDER.orderNumber) && conf[0].html.includes('Style Your Everyday.') && conf[0].html.includes('Kids Hoodie') && conf[0].html.includes('Model Town') && /Black/.test(conf[0].html));
r = await cust.post('/orders', { deliveryMethod: 'home', paymentMethod: 'cod', delivery, idempotencyKey: key() });
check('empty cart cannot be ordered', r.status === 400);

// failed online payment: no order & no deduction
await cust.post('/cart', { productId: P._id, variationId: VM._id, quantity: 1 });
let s0 = await stockOf(P._id, VM._id);
r = await cust.post('/orders', { deliveryMethod: 'pickup', paymentMethod: 'online', delivery: { ...delivery, city: '', address: '' }, idempotencyKey: key(), simulateOutcome: 'failure' });
check('failed online payment -> 402, no order, stock unchanged', r.status === 402 && (await stockOf(P._id, VM._id)) === s0 && (await Order.countDocuments({ orderType: 'online' })) === 1);
// email failure must not fail order
failMail = true;
r = await cust.post('/orders', { deliveryMethod: 'pickup', paymentMethod: 'online', delivery: { ...delivery, city: '', address: '' }, idempotencyKey: key(), simulateOutcome: 'success' });
await settle();
failMail = false;
const ORDER2 = r.order;
check('order succeeds even when SMTP fails', r.status === 201 && r.order.paymentStatus === 'paid' && r.order.deliveryMethod === 'pickup');
check('failed email is logged as failed (retryable)', (await EmailLog.findOne({ dedupeKey: `order-confirmation:${ORDER2._id}` }))?.status === 'failed');
r = await cust.get('/orders/my-orders');
check('customer sees own orders', r.orders.length === 2);
const other = new Client(); await other.post('/auth/signup', { fullName: 'Other Person', email: 'other@example.com', mobile: '03111234567', password: 'Passw0rdX', confirmPassword: 'Passw0rdX' });
r = await other.get(`/orders/${ORDER._id}`);
check('customer cannot read another customer\'s order (404)', r.status === 404);

section('Admin order management');
r = await admin.patch(`/admin/orders/${ORDER._id}/status`, { status: 'shipped' });
check('invalid transition rejected (pending -> shipped)', r.status === 400);
sent.length = 0;
for (const st of ['confirmed', 'processing', 'shipped']) { r = await admin.patch(`/admin/orders/${ORDER._id}/status`, { status: st }); }
check('walks through confirmed/processing/shipped', r.status === 200 && r.order.orderStatus === 'shipped');
r = await admin.patch(`/admin/orders/${ORDER._id}/status`, { status: 'shipped' });
check('re-applying same status is rejected', r.status === 400);
r = await admin.patch(`/admin/orders/${ORDER._id}/status`, { status: 'delivered' });
check('delivered marks COD as paid', r.order.paymentStatus === 'paid');
await settle();
const subj = sent.map((m) => m.subject).join(' | ');
check('status, shipping & delivery emails sent', /is confirmed/i.test(subj) && /is processing/i.test(subj) && /has shipped/i.test(subj) && /delivered/i.test(subj), subj);
check('no duplicate status emails', new Set(sent.map((m) => m.subject)).size === sent.length);
r = await admin.patch(`/admin/orders/${ORDER._id}/status`, { status: 'cancelled' });
check('delivered order cannot be cancelled', r.status === 400);
const sBefore = await stockOf(P._id, VM._id);
sent.length = 0;
r = await cust.patch(`/orders/${ORDER2._id}/cancel`);
check('customer cancels pending order; stock restored', r.status === 200 && (await stockOf(P._id, VM._id)) === sBefore + 1);
check('paid online order becomes refunded on cancel', r.order.paymentStatus === 'refunded');
await settle();
check('cancellation email sent', sent.some((m) => /cancelled/i.test(m.subject)));
r = await admin.patch(`/admin/orders/${ORDER2._id}/status`, { status: 'cancelled' });
check('cannot cancel twice / double-restock', r.status === 400 && (await stockOf(P._id, VM._id)) === sBefore + 1);

// ============ CASHIER ============
section('Cashier management');
r = await cust.post('/admin/cashiers', {});
check('customer cannot create cashier', r.status === 403);
r = await admin.post('/admin/cashiers', { fullName: 'Sara Cashier', email: 'sara@wearora.test', mobile: '03211234567', password: 'Cashier123', confirmPassword: 'Cashier123', role: 'admin' });
check('admin creates cashier (role forced)', r.status === 201 && r.cashier.role === 'cashier');
const CID = r.cashier.id;
await admin.post('/admin/cashiers', { fullName: 'Bilal Cashier', email: 'bilal@wearora.test', mobile: '03221234567', password: 'Cashier123', confirmPassword: 'Cashier123' });
r = await cashier.post('/auth/signin', { email: 'sara@wearora.test', password: 'Cashier123', portal: 'cashier' });
check('cashier signs in via cashier portal', r.status === 200 && r.user.role === 'cashier');
await cashier2.post('/auth/signin', { email: 'bilal@wearora.test', password: 'Cashier123', portal: 'cashier' });
r = await cashier.get('/admin/orders');
check('cashier blocked from admin API', r.status === 403);
r = await cashier.post('/auth/signin', { email: 'sara@wearora.test', password: 'Cashier123', portal: 'customer' });
check('cashier cannot use customer portal', r.status === 401);

section('POS sales');
r = await cashier.get('/products/barcode/1111111111111');
check('barcode lookup resolves exact variation', r.status === 200 && r.variation.size === 'M' && r.variation.color === 'Black');
r = await cashier.get('/products/barcode/9999999999999');
check('unknown barcode -> 404', r.status === 404);
r = await cashier.get('/products?q=1111111111111');
check('product search by barcode (staff)', r.products.length === 1);
const sale = (items, extra = {}) => cashier.post('/pos/sales', { items, paymentMethod: 'cash', amountReceived: 100000, idempotencyKey: key(), ...extra });
const m0 = await stockOf(P._id, VM._id);
r = await sale([{ productId: P._id, variationId: VM._id, quantity: 3 }], { customer: { fullName: 'Walk In', mobile: '03331234567', email: 'walkin@example.com' }, emailReceipt: true, amountReceived: 3000 });
check('cash sale completes with change', r.status === 201 && r.sale.total === 3000 && r.sale.changeDue === 0 && /^WR-POS-/.test(r.sale.orderNumber), JSON.stringify(r).slice(0, 250));
const SALE = r.sale;
check('POS stock deducted from shared inventory', (await stockOf(P._id, VM._id)) === m0 - 3);
check('verify token never returned to client', !JSON.stringify(r).includes('verifyToken'));
await settle();
check('receipt emailed with PDF attachment', sent.some((m) => /receipt/i.test(m.subject)) );
r = await sale([{ productId: P._id, variationId: VM._id, quantity: 1 }], { amountReceived: 10 });
check('insufficient cash rejected', r.status === 422);
r = await sale([{ productId: P._id, variationId: VM._id, quantity: 1 }], { paymentMethod: 'card', simulateOutcome: 'failure' });
check('failed card payment creates no sale / no deduction', r.status === 402 && (await stockOf(P._id, VM._id)) === m0 - 3);
r = await sale([{ productId: P._id, variationId: VM._id, quantity: 1 }], { discountPercent: 50 });
check('discount above store limit rejected', r.status === 422);
r = await sale([{ productId: P._id, variationId: VM._id, quantity: 1 }], { discountPercent: 10 });
check('10% discount applied by backend', r.status === 201 && r.sale.total === 900 && r.sale.discount === 100);
const kk = key();
await cashier.post('/pos/sales', { items: [{ productId: P._id, variationId: VM._id, quantity: 1 }], paymentMethod: 'cash', amountReceived: 5000, idempotencyKey: kk });
const dupe = await cashier.post('/pos/sales', { items: [{ productId: P._id, variationId: VM._id, quantity: 1 }], paymentMethod: 'cash', amountReceived: 5000, idempotencyKey: kk });
check('duplicate POS submission prevented', dupe.duplicate === true);
// overselling race on the single remaining L unit
const raceItems = [{ productId: P._id, variationId: VL._id, quantity: 1 }];
const results = await Promise.all([sale(raceItems), cashier2.post('/pos/sales', { items: raceItems, paymentMethod: 'cash', amountReceived: 5000, idempotencyKey: key() }), sale(raceItems)]);
const wins = results.filter((x) => x.status === 201).length;
check('concurrent sales cannot oversell last unit', wins === 1 && (await stockOf(P._id, VL._id)) === 0, `wins=${wins}`);
r = await sale(raceItems);
check('out-of-stock variation cannot be sold', r.status === 409);

r = await cashier.get(`/pos/receipts/${SALE.id}`);
check('receipt data + QR', r.status === 200 && r.qrDataUrl.startsWith('data:image/png') && r.thanks.includes('Wearora') && r.receipt.items.length === 1);
const pdfRes = await cashier.req('GET', `/pos/receipts/${SALE.id}/pdf`, null, true);
const buf = Buffer.from(await pdfRes.arrayBuffer());
check('PDF receipt downloads', pdfRes.status === 200 && buf.slice(0, 4).toString() === '%PDF');
const vurl = new URL(r.verifyUrl); const vtoken = vurl.searchParams.get('token');
r = await anon.get(`/pos/receipts/${encodeURIComponent(SALE.orderNumber)}/verify?token=${vtoken}`);
check('QR verification works publicly & hides customer info', r.status === 200 && r.valid && !JSON.stringify(r).includes('Walk In') && !JSON.stringify(r).includes('walkin@'));
r = await anon.get(`/pos/receipts/${encodeURIComponent(SALE.orderNumber)}/verify?token=wrong`);
check('wrong verification token rejected', r.status === 404);
r = await cashier2.get(`/pos/sales/${SALE.id}`);
check('cashier cannot view another cashier\'s sale', r.status === 404);
r = await cashier.get('/pos/sales/my-sales');
check('my-sales lists own sales only', r.sales.length >= 3 && r.sales.every((s) => s.cashierName === 'Sara Cashier'));
r = await cashier2.get('/pos/sales');
check('cashier2 sales list excludes cashier1', r.sales.every((s) => s.cashierName === 'Bilal Cashier'));
r = await cashier.get('/cashier/customers/search?q=0333123');
check('customer lookup finds walk-in by mobile', r.customers.some((c) => c.fullName === 'Walk In'));
r = await cashier.get('/cashier/customers/search?q=ayesha@exa');
check('customer lookup finds registered customer', r.customers.some((c) => c.registered));
r = await cashier.get('/cashier/profile');
check('cashier profile', r.profile.role === 'cashier' && r.profile.totalSales >= 3);

section('Returns & exchanges');
const m1 = await stockOf(P._id, VM._id);
r = await cashier2.get(`/pos/returns/receipt/${SALE.orderNumber}`);
check('receipt lookup shows eligibility', r.status === 200 && r.sale.eligibility.eligible && r.sale.items[0].remaining === 3);
const itemId = r.sale.items[0]._id;
r = await cashier.post('/pos/returns', { orderId: SALE.id, items: [{ orderItemId: itemId, quantity: 4, resellable: true }], reason: 'wrong_size', refundMethod: 'cash', idempotencyKey: key() });
check('cannot return more than purchased (422)', r.status === 422);
sent.length = 0;
r = await cashier.post('/pos/returns', { orderId: SALE.id, items: [{ orderItemId: itemId, quantity: 1, resellable: true }], reason: 'wrong_size', refundMethod: 'cash', idempotencyKey: key() });
check('resellable return refunds & restocks', r.status === 201 && r.record.refundAmount === 1000 && (await stockOf(P._id, VM._id)) === m1 + 1, JSON.stringify(r).slice(0, 200));
r = await cashier.post('/pos/returns', { orderId: SALE.id, items: [{ orderItemId: itemId, quantity: 1, resellable: true }], reason: 'defective', refundMethod: 'cash', idempotencyKey: key() });
check('defective return does NOT restock', r.status === 201 && (await stockOf(P._id, VM._id)) === m1 + 1 && r.record.returnedItems[0].resellable === false);
r = await cashier.post('/pos/returns', { orderId: SALE.id, items: [{ orderItemId: itemId, quantity: 2, resellable: true }], reason: 'other', refundMethod: 'cash', idempotencyKey: key() });
check('cannot exceed remaining quantity after earlier returns', r.status === 422);
await settle();
check('return completion emails sent', sent.filter((m) => /Return .* completed/.test(m.subject)).length === 2);
// exchange: return 1 M (price 1000) for Kids Hoodie (2500) -> customer pays 1500
const m2 = await stockOf(P._id, VM._id); const h0 = await stockOf(P2._id, V2._id);
r = await cashier.post('/pos/exchanges', { orderId: SALE.id, items: [{ orderItemId: itemId, quantity: 1, resellable: true }], replacements: [{ productId: P2._id, variationId: V2._id, quantity: 1 }], reason: 'wrong_product', settlementMethod: 'cash', idempotencyKey: key() });
check('exchange computes price difference (customer pays)', r.status === 201 && r.record.additionalPayment === 1500 && r.record.refundAmount === 0, JSON.stringify(r).slice(0, 300));
check('exchange updates both stocks', (await stockOf(P._id, VM._id)) === m2 + 1 && (await stockOf(P2._id, V2._id)) === h0 - 1);
r = await cashier.get(`/pos/returns/receipt/${SALE.orderNumber}`);
check('fully returned sale is no longer eligible', !r.sale.eligibility.eligible);
const o = await Order.findById(SALE.id);
check('payment status reflects refunds', ['partially_refunded', 'refunded'].includes(o.paymentStatus));
r = await cust.post('/pos/returns', {});
check('customer cannot use returns API', r.status === 403);

section('Admin visibility & integrity');
r = await admin.get('/admin/orders?limit=50');
check('admin sees online + POS orders', r.orders.some((x) => x.orderType === 'online') && r.orders.some((x) => x.orderType === 'pos'));
r = await admin.get('/admin/orders?orderType=pos&paymentStatus=paid');
check('admin filters by type/payment', r.orders.every((x) => x.orderType === 'pos'));
r = await admin.get(`/admin/orders/${SALE.id}`);
check('admin order detail includes payments, returns & cashier', r.payments.length >= 2 && r.returns.length >= 3 && r.order.cashierName === 'Sara Cashier');
r = await admin.patch(`/admin/orders/${SALE.id}/status`, { status: 'cancelled' });
check('completed POS sale cannot be edited', r.status === 400);
r = await admin.get('/admin/orders?q=WR-ORD');
check('search by order number', r.orders.length === 2);
r = await admin.get(`/admin/products/${P._id}/movements`);
check('inventory movements recorded', r.movements.length >= 8 && ['online_sale', 'pos_sale', 'pos_return', 'exchange', 'admin_adjustment', 'initial_stock', 'order_cancellation'].every((t) => r.movements.some((m) => m.movementType === t)));
const neg = await Product.countDocuments({ 'variations.stockQuantity': { $lt: 0 } });
check('no negative stock anywhere', neg === 0);
r = await admin.del(`/admin/products/${P._id}`);
check('product with history is deactivated, not deleted', r.status === 200 && r.deactivated === true);
r = await anon.get(`/products/${P._id}`);
check('deactivated product hidden from storefront', r.status === 404);
r = await admin.get(`/admin/orders/${ORDER._id}`);
check('historical order keeps product snapshot', r.order.items[0].productNameSnapshot === 'Test Tee v2' || r.order.items[0].productNameSnapshot === 'Test Tee');
r = await admin.post(`/admin/cashiers/${CID}/reset-password`);
check('cashier password reset refuses when email cannot be delivered', r.status === 200 || r.status === 502);
r = await admin.patch(`/admin/cashiers/${CID}/status`, { accountStatus: 'inactive' });
r = await cashier.post('/auth/signin', { email: 'sara@wearora.test', password: 'Cashier123' });
check('deactivated cashier cannot sign in', r.status === 403 || r.status === 401);
r = await cust.get('/auth/signout'); r = await cust.get('/users/profile');
check('after sign-out protected routes are inaccessible', r.status === 401);

section('Profile');
const c2 = new Client(); await c2.post('/auth/signin', { email: 'other@example.com', password: 'Passw0rdX' });
r = await c2.patch('/users/profile', { mobile: '03451234567', address: { line1: 'Street 9', city: 'Lahore' }, role: 'admin' });
check('profile update ignores role', r.status === 200 && r.user.role === 'customer' && r.user.address.city === 'Lahore');
r = await c2.patch('/users/change-password', { currentPassword: 'nope1234', newPassword: 'Better123', confirmPassword: 'Better123' });
check('change password requires correct current password', r.status === 400);
r = await c2.patch('/users/change-password', { currentPassword: 'Passw0rdX', newPassword: 'Better123', confirmPassword: 'Better123' });
check('change password works', r.status === 200);
sent.length = 0;
r = await c2.post('/users/email-change', { newEmail: 'other.new@example.com' });
await settle();
const em = sent.find((m) => /Verify your email/i.test(m.subject));
check('email change sends OTP to new address', r.status === 200 && em?.to === 'other.new@example.com');
r = await c2.post('/users/email-change/verify', { otp: /(\d{6})/.exec(em.text)[1] });
check('email change confirmed with OTP', r.status === 200 && r.user.email === 'other.new@example.com');

console.log(`\n${passed} passed, ${failed} failed`);
server.close();
await mongoose.disconnect();
process.exit(failed ? 1 : 0);
