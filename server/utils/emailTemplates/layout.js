import { env } from '../../config/env.js';

export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const money = (n) =>
  `${env.store.currencySymbol} ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const fmtDate = (d, withTime = false) =>
  new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });

export const PAYMENT_LABEL = { cod: 'Cash on Delivery', online: 'Online Payment (Simulated)', cash: 'Cash', card: 'Card (Simulated)', wallet: 'Digital Wallet (Simulated)' };
export const STATUS_LABEL = {
  pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing', ready_for_pickup: 'Ready for Pickup',
  shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', completed: 'Completed',
};
export const PAY_STATUS_LABEL = { pending: 'Pending', paid: 'Paid', failed: 'Failed', refunded: 'Refunded', partially_refunded: 'Partially Refunded' };

const C = { charcoal: '#171717', gold: '#C69A52', ivory: '#FAF8F3', beige: '#EAE5DC', gray: '#77716A', white: '#FFFFFF' };

export const logoBlock = (hasLogo) =>
  hasLogo
    ? `<img src="cid:wearora-logo" alt="Wearora" height="48" style="display:block;margin:0 auto;height:48px;width:auto;border:0;" />`
    : `<div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;letter-spacing:6px;color:${C.charcoal};text-align:center;font-weight:600;">WEARORA</div>`;

export const button = (href, label) =>
  `<a href="${esc(href)}" style="display:inline-block;background:${C.charcoal};color:#fff;text-decoration:none;padding:13px 28px;border-radius:6px;font-weight:600;font-size:14px;">${esc(label)}</a>`;

export function infoRows(rows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">${rows
    .filter(Boolean)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:${C.gray};width:42%;vertical-align:top;">${esc(k)}</td><td style="padding:6px 0;color:${C.charcoal};font-weight:500;vertical-align:top;">${v}</td></tr>`
    )
    .join('')}</table>`;
}

export function itemsTable(items) {
  const rows = items
    .map(
      (i) => `<tr>
      <td style="padding:12px 0;border-bottom:1px solid ${C.beige};font-size:14px;color:${C.charcoal};">
        <strong>${esc(i.productNameSnapshot)}</strong><br/>
        <span style="color:${C.gray};font-size:12px;">Size: ${esc(i.size)} &nbsp;|&nbsp; Color: ${esc(i.color)}</span>
      </td>
      <td align="center" style="padding:12px 8px;border-bottom:1px solid ${C.beige};font-size:14px;">${i.quantity}</td>
      <td align="right" style="padding:12px 0;border-bottom:1px solid ${C.beige};font-size:14px;">${money(i.unitPrice)}</td>
      <td align="right" style="padding:12px 0 12px 8px;border-bottom:1px solid ${C.beige};font-size:14px;font-weight:600;">${money(i.subtotal ?? i.unitPrice * i.quantity)}</td>
    </tr>`
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr style="font-size:11px;color:${C.gray};text-transform:uppercase;letter-spacing:1px;">
      <th align="left" style="padding-bottom:8px;border-bottom:2px solid ${C.charcoal};">Item</th>
      <th align="center" style="padding-bottom:8px;border-bottom:2px solid ${C.charcoal};">Qty</th>
      <th align="right" style="padding-bottom:8px;border-bottom:2px solid ${C.charcoal};">Price</th>
      <th align="right" style="padding-bottom:8px;border-bottom:2px solid ${C.charcoal};">Total</th>
    </tr>${rows}</table>`;
}

export function totalsTable(o) {
  const row = (k, v, strong) =>
    `<tr><td style="padding:5px 0;color:${strong ? C.charcoal : C.gray};font-size:${strong ? 16 : 14}px;${strong ? 'font-weight:700;' : ''}">${k}</td><td align="right" style="padding:5px 0;font-size:${strong ? 16 : 14}px;${strong ? 'font-weight:700;color:' + C.charcoal : ''}">${v}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
    ${row('Subtotal', money(o.subtotal))}
    ${o.discount > 0 ? row('Discount', '− ' + money(o.discount)) : ''}
    ${o.orderType === 'online' ? row('Delivery', o.deliveryCharge ? money(o.deliveryCharge) : 'Free') : ''}
    <tr><td colspan="2" style="border-top:1px solid ${C.beige};height:6px;"></td></tr>
    ${row('Total', money(o.total), true)}</table>`;
}

/** Wraps content in the Wearora responsive email shell. */
export function layout({ title, preheader = '', body, hasLogo = false }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="x-apple-disable-message-reformatting"/><title>${esc(title)}</title>
<style>
  @media only screen and (max-width:620px){.wrap{width:100%!important}.pad{padding:24px 18px!important}h1{font-size:22px!important}}
</style></head>
<body style="margin:0;padding:0;background:${C.ivory};font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:${C.charcoal};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.ivory};padding:28px 12px;">
<tr><td align="center">
  <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:${C.white};border:1px solid ${C.beige};border-radius:10px;overflow:hidden;">
    <tr><td style="padding:28px 24px 18px;border-bottom:3px solid ${C.gold};">
      ${logoBlock(hasLogo)}
      <div style="text-align:center;color:${C.gold};font-size:12px;letter-spacing:2px;margin-top:6px;">Style Your Everyday.</div>
    </td></tr>
    <tr><td class="pad" style="padding:32px 36px;">${body}</td></tr>
    <tr><td style="background:${C.charcoal};padding:22px 24px;text-align:center;">
      <div style="color:${C.gold};font-size:13px;letter-spacing:1px;">Style Your Everyday.</div>
      <div style="color:#bdb6aa;font-size:12px;margin-top:8px;">© 2026 Wearora. All rights reserved.</div>
      <div style="color:#8e877c;font-size:11px;margin-top:6px;">You are receiving this email because of activity on your Wearora account.</div>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

export const h1 = (t) => `<h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;color:${C.charcoal};font-family:Georgia,'Times New Roman',serif;">${esc(t)}</h1>`;
export const p = (t) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3b3833;">${t}</p>`;
export const card = (inner) => `<div style="background:${C.ivory};border:1px solid ${C.beige};border-radius:8px;padding:18px 20px;margin:18px 0;">${inner}</div>`;
export const sectionTitle = (t) => `<div style="font-size:12px;letter-spacing:1.5px;color:${C.gold};font-weight:700;margin:22px 0 8px;text-transform:uppercase;">${esc(t)}</div>`;
export const otpBox = (otp) =>
  `<div style="text-align:center;margin:22px 0;"><span style="display:inline-block;font-size:34px;letter-spacing:12px;font-weight:700;color:${C.charcoal};background:${C.ivory};border:1px dashed ${C.gold};border-radius:8px;padding:14px 22px 14px 34px;font-family:'Courier New',monospace;">${esc(otp)}</span></div>`;
export { C as COLORS };
