import { env } from '../../config/env.js';
import {
  layout, h1, p, card, button, infoRows, itemsTable, totalsTable, sectionTitle, otpBox,
  esc, money, fmtDate, PAYMENT_LABEL, STATUS_LABEL, PAY_STATUS_LABEL,
} from './layout.js';

const orderLink = (o) => `${env.clientUrl}/orders/${o._id}`;

const deliveryBlock = (o) => {
  const d = o.deliveryInformation || {};
  if (o.deliveryMethod === 'pickup') {
    return `${sectionTitle('Store Pickup')}${p('You selected <strong>Store Pickup</strong>. We will notify you when your order is ready to collect.')}`;
  }
  return `${sectionTitle('Delivery Address')}${card(
    `<strong>${esc(d.fullName)}</strong><br/>${esc(d.address)}<br/>${esc(d.city)}<br/>${esc(d.mobile)}${d.instructions ? `<br/><span style="color:#77716A;">Note: ${esc(d.instructions)}</span>` : ''}`
  )}`;
};

const estimate = (o) =>
  o.deliveryInformation?.estimatedFrom
    ? o.deliveryMethod === 'pickup'
      ? `Ready for pickup by ${fmtDate(o.deliveryInformation.estimatedTo)}`
      : `${fmtDate(o.deliveryInformation.estimatedFrom)} – ${fmtDate(o.deliveryInformation.estimatedTo)}`
    : null;

const out = (subject, preheader, body, text, hasLogo) => ({ subject, html: layout({ title: subject, preheader, body, hasLogo }), text });

export const templates = {
  welcome: ({ user, hasLogo }) =>
    out(
      'Welcome to Wearora',
      'Your account is ready.',
      h1(`Welcome, ${user.fullName.split(' ')[0]}`) +
        p('Thank you for joining Wearora. Your account has been created and you can start exploring our latest collections for women, men and kids.') +
        `<div style="text-align:center;margin:26px 0;">${button(`${env.clientUrl}/products`, 'Start Shopping')}</div>` +
        p('Discover clothing designed to bring comfort, confidence and style to your everyday life.'),
      `Welcome to Wearora, ${user.fullName}! Start shopping: ${env.clientUrl}/products`,
      hasLogo
    ),

  emailVerificationOtp: ({ user, otp, minutes, hasLogo }) =>
    out(
      'Verify your email address – Wearora',
      `Your verification code is ${otp}`,
      h1('Verify Your Email') +
        p(`Hi ${esc(user.fullName.split(' ')[0])}, use the code below to verify your email address for Wearora.`) +
        otpBox(otp) +
        p(`This code expires in <strong>${minutes} minutes</strong> and can only be used once. If you did not request this, you can safely ignore this email.`),
      `Your Wearora verification code is ${otp}. It expires in ${minutes} minutes.`,
      hasLogo
    ),

  passwordResetOtp: ({ user, otp, minutes, hasLogo }) =>
    out(
      'Your Wearora password reset code',
      `Your password reset code is ${otp}`,
      h1('Reset Your Password') +
        p(`Hi ${esc(user.fullName.split(' ')[0])}, we received a request to reset your Wearora password. Enter this code to continue.`) +
        otpBox(otp) +
        p(`This code expires in <strong>${minutes} minutes</strong> and can only be used once. If you did not request a password reset, please ignore this email — your password will not change.`),
      `Your Wearora password reset code is ${otp}. It expires in ${minutes} minutes.`,
      hasLogo
    ),

  orderConfirmation: ({ order, hasLogo }) => {
    const o = order;
    const est = estimate(o);
    const body =
      h1('Thank you for your order') +
      p(`Hi ${esc(o.customerSnapshot?.fullName || 'there')}, we have received your order and will start preparing it shortly.`) +
      card(
        infoRows([
          ['Order number', `<strong>${esc(o.orderNumber)}</strong>`],
          ['Order date', fmtDate(o.createdAt, true)],
          ['Payment method', esc(PAYMENT_LABEL[o.paymentMethod])],
          ['Payment status', esc(PAY_STATUS_LABEL[o.paymentStatus])],
          ['Order status', esc(STATUS_LABEL[o.orderStatus])],
          est ? ['Estimated delivery', esc(est)] : null,
        ])
      ) +
      sectionTitle('Order Summary') + itemsTable(o.items) + totalsTable(o) + deliveryBlock(o) +
      `<div style="text-align:center;margin:28px 0 4px;">${button(orderLink(o), 'View Order')}</div>`;
    return out(`Order confirmed – ${o.orderNumber}`, `Your Wearora order ${o.orderNumber} is confirmed.`, body,
      `Thank you for your order ${o.orderNumber}. Total: ${money(o.total)}. View: ${orderLink(o)}`, hasLogo);
  },

  orderStatusUpdate: ({ order, hasLogo }) => {
    const o = order;
    const label = STATUS_LABEL[o.orderStatus];
    const msg = {
      confirmed: 'Good news — your order has been confirmed.',
      processing: 'Your order is now being prepared.',
      ready_for_pickup: 'Your order is ready. Please visit our store to collect it and bring your order number.',
      pending: 'Your order status has been set back to pending.',
    }[o.orderStatus] || 'Your order status has been updated.';
    const body = h1(`Order ${label}`) + p(msg) +
      card(infoRows([['Order number', `<strong>${esc(o.orderNumber)}</strong>`], ['New status', `<strong>${esc(label)}</strong>`], ['Total', money(o.total)]])) +
      `<div style="text-align:center;margin:24px 0 4px;">${button(orderLink(o), 'Track Order')}</div>`;
    return out(`Order ${o.orderNumber} is ${label.toLowerCase()}`, msg, body, `${msg} Order ${o.orderNumber}: ${label}.`, hasLogo);
  },

  orderShipped: ({ order, hasLogo }) => {
    const o = order; const est = estimate(o);
    const body = h1('Your order is on its way') + p('Your Wearora order has been shipped and is heading to you.') +
      card(infoRows([['Order number', `<strong>${esc(o.orderNumber)}</strong>`], est ? ['Estimated delivery', esc(est)] : null, ['Payment', esc(PAYMENT_LABEL[o.paymentMethod])]])) +
      deliveryBlock(o) + sectionTitle('Items') + itemsTable(o.items) +
      `<div style="text-align:center;margin:24px 0 4px;">${button(orderLink(o), 'Track Order')}</div>`;
    return out(`Your order ${o.orderNumber} has shipped`, 'Your order is on its way.', body, `Your order ${o.orderNumber} has shipped.`, hasLogo);
  },

  orderDelivered: ({ order, hasLogo }) => {
    const o = order;
    const picked = o.deliveryMethod === 'pickup';
    const body = h1(picked ? 'Order collected' : 'Order delivered') +
      p(picked ? 'Thank you for collecting your order from our store.' : 'Your order has been delivered. We hope you love your new pieces.') +
      card(infoRows([['Order number', `<strong>${esc(o.orderNumber)}</strong>`], ['Total', money(o.total)], ['Payment status', esc(PAY_STATUS_LABEL[o.paymentStatus])]])) +
      p('Thank you for shopping with Wearora.') +
      `<div style="text-align:center;margin:24px 0 4px;">${button(`${env.clientUrl}/products`, 'Continue Shopping')}</div>`;
    return out(`Order ${o.orderNumber} ${picked ? 'collected' : 'delivered'}`, 'Thank you for shopping with Wearora.', body, `Order ${o.orderNumber} ${picked ? 'collected' : 'delivered'}.`, hasLogo);
  },

  orderCancelled: ({ order, hasLogo, byCustomer }) => {
    const o = order;
    const refundNote = o.paymentMethod === 'online' && o.paymentStatus !== 'pending'
      ? p('Because you paid online, your simulated payment will be marked as refunded.') : '';
    const body = h1('Order cancelled') +
      p(byCustomer ? 'As requested, your order has been cancelled.' : 'Your order has been cancelled by our team. We apologise for any inconvenience.') +
      card(infoRows([['Order number', `<strong>${esc(o.orderNumber)}</strong>`], ['Total', money(o.total)], ['Status', 'Cancelled']])) + refundNote +
      p('The items from this order have been returned to stock. If you have questions, simply reply to this email or contact our store.') +
      `<div style="text-align:center;margin:24px 0 4px;">${button(`${env.clientUrl}/products`, 'Continue Shopping')}</div>`;
    return out(`Order ${o.orderNumber} cancelled`, 'Your order has been cancelled.', body, `Order ${o.orderNumber} has been cancelled.`, hasLogo);
  },

  returnCompleted: ({ record, order, hasLogo }) => {
    const r = record; const isEx = r.transactionType === 'exchange';
    const lines = (arr) => arr.map((i) => ({ ...i, subtotal: i.amount ?? i.unitPrice * i.quantity }));
    const body = h1(isEx ? 'Exchange completed' : 'Return completed') +
      p(isEx ? 'Your exchange has been processed successfully.' : 'Your return has been processed successfully.') +
      card(infoRows([
        ['Reference', `<strong>${esc(r.referenceNumber)}</strong>`],
        ['Original receipt', esc(order.orderNumber)],
        ['Date', fmtDate(r.createdAt, true)],
        r.refundAmount > 0 ? ['Refund amount', `<strong>${money(r.refundAmount)}</strong> (${esc(PAYMENT_LABEL[r.refundMethod] || r.refundMethod)})`] : null,
        r.additionalPayment > 0 ? ['Additional payment', `<strong>${money(r.additionalPayment)}</strong> (${esc(PAYMENT_LABEL[r.additionalPaymentMethod] || r.additionalPaymentMethod)})`] : null,
      ])) +
      sectionTitle('Returned items') + itemsTable(lines(r.returnedItems)) +
      (isEx ? sectionTitle('Replacement items') + itemsTable(lines(r.replacementItems)) : '') +
      p('Thank you for shopping with Wearora!');
    return out(`${isEx ? 'Exchange' : 'Return'} ${r.referenceNumber} completed`, 'Your request has been processed.', body, `${isEx ? 'Exchange' : 'Return'} ${r.referenceNumber} completed.`, hasLogo);
  },

  posReceipt: ({ order, hasLogo }) => {
    const o = order;
    const body = h1('Your Wearora receipt') + p('Thank you for shopping with Wearora! Your receipt is below and attached as a PDF.') +
      card(infoRows([
        ['Receipt number', `<strong>${esc(o.orderNumber)}</strong>`], ['Date', fmtDate(o.createdAt, true)], ['Cashier', esc(o.cashierName || '—')],
        ['Payment method', esc(PAYMENT_LABEL[o.paymentMethod])], ['Payment status', esc(PAY_STATUS_LABEL[o.paymentStatus])],
      ])) + sectionTitle('Items') + itemsTable(o.items) + totalsTable(o) +
      p('<span style="color:#77716A;font-size:13px;">Returns and exchanges are accepted within ' + env.store.returnWindowDays + ' days with this receipt.</span>');
    return out(`Your Wearora receipt – ${o.orderNumber}`, 'Thank you for shopping with Wearora!', body, `Receipt ${o.orderNumber}. Total ${money(o.total)}.`, hasLogo);
  },

  cashierAccountCreated: ({ user, hasLogo }) =>
    out('Your Wearora cashier account', 'Your cashier account has been created.',
      h1('Cashier account created') + p(`Hi ${esc(user.fullName.split(' ')[0])}, an administrator has created a Wearora cashier account for you.`) +
      card(infoRows([['Sign-in email', esc(user.email)], ['Sign-in page', esc(`${env.clientUrl}/cashier/login`)]])) +
      p('Your administrator will share your initial password with you directly. Please change it after your first sign-in.'),
      `Your Wearora cashier account was created. Sign in at ${env.clientUrl}/cashier/login`, hasLogo),

  cashierTempPassword: ({ user, tempPassword, hasLogo }) =>
    out('Your temporary Wearora password', 'A temporary password was issued for your account.',
      h1('Temporary password issued') + p(`Hi ${esc(user.fullName.split(' ')[0])}, an administrator reset your Wearora cashier password. Use the temporary password below to sign in — you will be asked to change it immediately.`) +
      otpBox(tempPassword).replace('letter-spacing:12px', 'letter-spacing:2px').replace('font-size:34px', 'font-size:22px') +
      `<div style="text-align:center;margin:18px 0;">${button(`${env.clientUrl}/cashier/login`, 'Sign In')}</div>` +
      p('If you did not expect this, contact your administrator.'),
      `Temporary password: ${tempPassword}. Sign in at ${env.clientUrl}/cashier/login and change it immediately.`, hasLogo),
};
