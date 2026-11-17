/* Seeds the admin account (always) and optional demo catalogue: `npm run seed -- --demo` */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { assertEnv, env } from '../config/env.js';
import { connectDB } from '../config/database.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import InventoryMovement from '../models/InventoryMovement.js';
import { generateBarcode } from './helpers.js';
import { UPLOAD_ROOT } from '../middleware/upload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function seedAdmin() {
  if (!env.admin.email || !env.admin.password) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env');
  }

  const email = env.admin.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(env.admin.password, 12);

  let admin = await User.findOne({ email });

  if (admin) {
    admin.fullName = env.admin.name;
    admin.mobile = env.admin.mobile;
    admin.passwordHash = passwordHash;
    admin.role = 'admin';
    admin.authProvider = 'local';
    admin.accountStatus = 'active';

    await admin.save();

    console.log(`Admin updated: ${email}`);
    return admin;
  }

  admin = await User.create({
    fullName: env.admin.name,
    email,
    mobile: env.admin.mobile,
    passwordHash,
    role: 'admin',
    authProvider: 'local',
    accountStatus: 'active'
  });

  console.log(`Admin created: ${email}`);
  return admin;
}

const garment = (kind, hex) => {
  const shapes = {
    tee: '<path d="M150 90l-70 30 20 50 30-12v150h140V158l30 12 20-50-70-30c-8 18-26 28-50 28s-42-10-50-28z"/>',
    shirt: '<path d="M150 90l-70 30 20 50 30-12v150h140V158l30 12 20-50-70-30-50 36z"/><path d="M200 126v182" stroke="#0002" stroke-width="3" fill="none"/>',
    dress: '<path d="M170 80h60l14 70-24 20 52 170H128l52-170-24-20z"/>',
    pants: '<path d="M140 90h120l14 220h-52l-22-120-22 120h-52z"/>',
    hoodie: '<path d="M140 84l-60 36 18 56 30-12v150h144V164l30 12 18-56-60-36c-6 22-28 34-60 34s-54-12-60-34z"/>',
    kids: '<path d="M158 120l-52 24 14 40 24-10v110h112V174l24 10 14-40-52-24c-6 14-20 22-40 22s-34-8-40-22z"/>',
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#FAF8F3"/><circle cx="200" cy="210" r="150" fill="#EAE5DC" opacity=".6"/><g fill="${hex}" stroke="#17171722" stroke-width="2">${shapes[kind]}</g></svg>`;
};

export async function seedDemoProducts(adminId) {
  if (await Product.countDocuments()) { console.log('Products already exist – skipping demo catalogue'); return; }
  const dir = path.join(UPLOAD_ROOT, 'products'); fs.mkdirSync(dir, { recursive: true });
  const colors = { Black: '#171717', White: '#F4F1EA', Navy: '#1F2A44', Sand: '#CDB891', Olive: '#6B705C', Rose: '#C98B8B', Sky: '#8FB3D9' };
  const defs = [
    ['Essential Cotton Tee', 'men', 'tee', 2499, null, ['Black', 'White', 'Navy'], ['S', 'M', 'L', 'XL']],
    ['Oxford Button-Down Shirt', 'men', 'shirt', 4999, 3999, ['White', 'Sky'], ['M', 'L', 'XL']],
    ['Tailored Chino Trousers', 'men', 'pants', 5499, null, ['Sand', 'Navy', 'Olive'], ['30', '32', '34', '36']],
    ['Heritage Zip Hoodie', 'men', 'hoodie', 6999, null, ['Black', 'Olive'], ['M', 'L', 'XL']],
    ['Linen Summer Dress', 'women', 'dress', 7499, 5999, ['Sand', 'Rose'], ['XS', 'S', 'M', 'L']],
    ['Wrap Midi Dress', 'women', 'dress', 8999, null, ['Black', 'Navy'], ['S', 'M', 'L']],
    ['Relaxed Linen Shirt', 'women', 'shirt', 4299, null, ['White', 'Sand', 'Sky'], ['XS', 'S', 'M', 'L']],
    ['High-Rise Wide Trousers', 'women', 'pants', 5999, null, ['Black', 'Sand'], ['XS', 'S', 'M', 'L']],
    ['Soft Fleece Hoodie', 'women', 'hoodie', 5499, 4699, ['Rose', 'White', 'Black'], ['S', 'M', 'L']],
    ['Everyday Crew Tee', 'women', 'tee', 2299, null, ['White', 'Black', 'Rose'], ['XS', 'S', 'M', 'L']],
    ['Kids Play Tee', 'kids', 'kids', 1499, null, ['Sky', 'Sand'], ['4Y', '6Y', '8Y', '10Y']],
    ['Kids Cozy Hoodie', 'kids', 'hoodie', 3299, 2799, ['Navy', 'Rose'], ['4Y', '6Y', '8Y']],
    ['Kids Everyday Pants', 'kids', 'pants', 2499, null, ['Olive', 'Navy'], ['4Y', '6Y', '8Y', '10Y']],
    ['Kids Party Dress', 'kids', 'dress', 3499, null, ['Rose', 'Sky'], ['4Y', '6Y', '8Y']],
  ];
  let n = 0;
  for (const [name, category, kind, price, salePrice, cols, sizes] of defs) {
    const images = [];
    for (const c of cols.slice(0, 3)) {
      const f = `seed-${n}-${c.toLowerCase()}.svg`;
      fs.writeFileSync(path.join(dir, f), garment(kind, colors[c]));
      images.push(`/uploads/products/${f}`);
    }
    const variations = cols.flatMap((c) => sizes.map((s) => ({ size: s, color: c, colorHex: colors[c], barcode: generateBarcode(), stockQuantity: 5 + Math.floor(Math.random() * 20), sku: `${name.slice(0, 3).toUpperCase()}-${c.slice(0, 2).toUpperCase()}-${s}` })));
    const p = await Product.create({ name, description: `${name} — thoughtfully cut from quality fabric for comfort and everyday confidence.`, category, price, salePrice, images, variations, status: 'active' });
    await InventoryMovement.insertMany(p.variations.map((v) => ({ productId: p._id, variationId: v._id, productName: p.name, size: v.size, color: v.color, movementType: 'initial_stock', quantity: v.stockQuantity, referenceType: 'Product', referenceId: p._id, previousStock: 0, newStock: v.stockQuantity, performedBy: adminId, note: 'Seed data' })));
    n += 1;
  }
  console.log(`Seeded ${n} demo products`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    assertEnv();
    await connectDB();
    await Product.init();
    const admin = await seedAdmin();
    if (process.argv.includes('--demo')) await seedDemoProducts(admin._id);
    process.exit(0);
  })().catch((e) => { console.error(e.message); process.exit(1); });
}
