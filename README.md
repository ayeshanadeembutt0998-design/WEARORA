# Wearora – Integrated Fashion Retail Management System (POS + E‑commerce)

MERN application with three interfaces on one backend, one database and one shared inventory:

| Interface | URL | Who |
|---|---|---|
| Customer storefront | `/products` | customers (guests can browse & build a cart) |
| Admin panel | `/admin/login` | admin |
| Cashier POS | `/cashier/login` | cashiers |

Stack: React + Vite + Tailwind · Node/Express · MongoDB Atlas (Mongoose) · JWT in HTTP‑only cookies · Firebase Auth (Google) · Nodemailer (SMTP) · Lucide icons.

## Quick start

```bash
npm run install:all

# server
cp server/.env.example server/.env     # fill MONGODB_URI, JWT_SECRET, SMTP_*, FIREBASE_*, ADMIN_*
npm run seed            # creates the admin account from ADMIN_* in .env
npm run seed:demo       # (optional) admin + 14 demo products with stock & barcodes

# client
cp client/.env.example client/.env     # Firebase web config (VITE_FIREBASE_*)

npm run dev:server      # http://localhost:5000
npm run dev:client      # http://localhost:5173  (proxies /api and /uploads to the server)
```

Create cashier accounts from **Admin → Cashier Management** (there is no public cashier sign‑up).

### Logo
The official logo file was not part of the upload. Put it at
`client/public/images/wearora-logo.png` **and** `server/assets/wearora-logo.png`
(the second is used in e‑mails and PDF receipts). Until then a text wordmark is shown.

### Google sign‑in (Firebase)
1. Firebase console → Authentication → enable **Google**.
2. Web app config → `client/.env` (`VITE_FIREBASE_*`).
3. Project settings → Service accounts → generate key → `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` in `server/.env`.
The server verifies the Firebase ID token itself; Google accounts without a mobile number are sent to *Complete profile* before checkout.

### E‑mail (Nodemailer)
Set `SMTP_*` and `EMAIL_FROM`. With Gmail use an App Password. If SMTP isn't configured the app keeps working and e‑mails are logged as `skipped` in the `emaillogs` collection.

### Production notes
* Serve client and API on the same site (reverse proxy `/api` + `/uploads`), or set `COOKIE_SAMESITE=none`, `NODE_ENV=production` and `VITE_API_URL`.
* Uploaded product images live in `server/uploads` – mount persistent storage (or move to S3/Cloudinary).
* Never commit `.env`.

## E‑mails implemented
Welcome · email‑change verification OTP · password‑reset OTP · order confirmation (logo, tagline, order no./date, items with size/colour/qty, prices, total, payment method & status, address, estimated delivery) · status updates (confirmed/processing/ready for pickup) · shipped · delivered · cancelled · return/exchange completed · POS receipt (PDF attached) · cashier account/temporary password.
Every send is claimed in `EmailLog` with a unique `dedupeKey` (no duplicates, failed sends can be retried) and runs **after** the business transaction commits, so an e‑mail failure never fails an order.

## Business rules worth knowing
* **Inventory** is per variation (size+colour). Stock is deducted with atomic conditional updates (`$gte` guard) so concurrent sales can never oversell, with rollback if order creation fails. Every change writes an `InventoryMovement`.
* Failed (simulated) payments create **no** order/sale and touch **no** stock. Checkout/POS submissions carry an idempotency key – double‑clicks return the same order.
* Totals are always recalculated on the server. Product sale price + optional POS discount (capped by `MAX_POS_DISCOUNT_PERCENT`).
* Online status flow: Home delivery `pending → confirmed → processing → shipped → delivered`; Pickup `… → ready_for_pickup → delivered`; cancel allowed until shipped/ready. Cancelling restores stock once (guarded). COD becomes *paid* on delivery.
* POS sales are immutable records. Returns/exchanges: configurable window (`RETURN_WINDOW_DAYS`, default 14), per‑item remaining quantity enforced atomically, defective items are never restocked, exchange computes the price difference (customer pays / refund).
* Cashiers see only their own sales; any cashier can process a return from a presented receipt number. Admin has full access.
* Receipts: thermal‑style print layout, PDF download, QR code linking to a public verification page that shows no customer data.
* Passwords: bcrypt (12). Password reset/OTP: HMAC‑hashed, single use, expiry, resend cool‑down, attempt limit, non‑enumerating responses. Rate limits on auth endpoints. Roles are enforced by the backend on every route.

## Tests
```bash
# needs a MongoDB reachable at TEST_MONGODB_URI (default mongodb://127.0.0.1:27099/wearora_test)
npm test
```
117 API checks cover auth/roles, OTP, product/barcode rules, cart/checkout, idempotency, failed payments, e‑mail dedupe & failure isolation, status workflow, cancellation/restock, concurrent oversell, POS, receipts/QR, returns/exchanges and inventory history.

## Project layout
```
server/  config/ models/ middleware/ controllers/ routes/ utils/ (mailer, email templates, pricing, inventory, receipt PDF, seed) tests/
client/  src/ components/ context/ hooks/ layouts/ pages/{customer,admin,cashier}/ routes/ services/ utils/
```
