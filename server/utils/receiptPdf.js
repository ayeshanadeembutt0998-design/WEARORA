import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { env } from '../config/env.js';
import { PAYMENT_LABEL, PAY_STATUS_LABEL, fmtDate } from './emailTemplates/layout.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO = path.join(__dirname, '..', 'assets', 'wearora-logo.png');
const fmt = (n) => `${env.store.currencySymbol} ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;

export const verifyUrl = (order) => `${env.clientUrl}/verify-receipt/${encodeURIComponent(order.orderNumber)}?token=${order.verifyToken}`;

export async function buildReceiptPdf(order) {
  const qr = await QRCode.toBuffer(verifyUrl(order), { margin: 1, width: 180 });
  const W = 300;
  const H = 360 + order.items.length * 34 + (order.customerSnapshot?.fullName ? 40 : 0);
  const doc = new PDFDocument({ size: [W, H], margin: 18 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((r) => doc.on('end', () => r(Buffer.concat(chunks))));
  const inner = W - 36;

  if (fs.existsSync(LOGO)) {
    try { doc.image(LOGO, W / 2 - 50, 16, { fit: [100, 44], align: 'center' }); doc.y = 66; } catch { doc.font('Helvetica-Bold').fontSize(18).text('WEARORA', { align: 'center' }); }
  } else doc.font('Helvetica-Bold').fontSize(18).fillColor('#171717').text('WEARORA', { align: 'center', characterSpacing: 3 });
  doc.font('Helvetica').fontSize(8).fillColor('#C69A52').text('Style Your Everyday.', { align: 'center' }).moveDown(0.8);

  const line = () => { doc.moveTo(18, doc.y).lineTo(W - 18, doc.y).strokeColor('#EAE5DC').stroke(); doc.moveDown(0.5); };
  const kv = (k, v) => { const y = doc.y; doc.font('Helvetica').fontSize(8).fillColor('#77716A').text(k, 18, y, { width: 90 }); doc.font('Helvetica-Bold').fillColor('#171717').text(String(v), 108, y, { width: inner - 90, align: 'right' }); doc.moveDown(0.3); };

  line();
  kv('Receipt No.', order.orderNumber);
  kv('Date', fmtDate(order.createdAt, true));
  kv('Cashier', order.cashierName || '-');
  if (order.customerSnapshot?.fullName) kv('Customer', order.customerSnapshot.fullName);
  if (order.customerSnapshot?.mobile) kv('Mobile', order.customerSnapshot.mobile);
  doc.moveDown(0.3); line();

  for (const it of order.items) {
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#171717').text(it.productNameSnapshot, 18, y, { width: inner - 70 });
    doc.font('Helvetica-Bold').text(fmt(it.subtotal), W - 18 - 70, y, { width: 70, align: 'right' });
    doc.font('Helvetica').fontSize(7.5).fillColor('#77716A').text(`${it.size} / ${it.color}  x${it.quantity} @ ${fmt(it.unitPrice)}`, 18, doc.y);
    doc.moveDown(0.5);
  }
  line();
  kv('Subtotal', fmt(order.subtotal));
  if (order.discount > 0) kv('Discount', `- ${fmt(order.discount)}`);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#171717');
  const y = doc.y; doc.text('TOTAL', 18, y); doc.text(fmt(order.total), 108, y, { width: inner - 90, align: 'right' }); doc.moveDown(0.6);
  kv('Payment', PAYMENT_LABEL[order.paymentMethod]);
  kv('Status', PAY_STATUS_LABEL[order.paymentStatus]);
  if (order.paymentMethod === 'cash' && order.amountReceived != null) { kv('Received', fmt(order.amountReceived)); kv('Change', fmt(order.changeDue)); }
  doc.moveDown(0.4); line();
  doc.image(qr, W / 2 - 40, doc.y, { width: 80 });
  doc.y += 86;
  doc.font('Helvetica').fontSize(7).fillColor('#77716A').text('Scan to verify this receipt', { align: 'center' }).moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#171717').text('Thank you for shopping with Wearora!', { align: 'center' });
  doc.end();
  return done;
}
