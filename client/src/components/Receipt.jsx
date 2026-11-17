import { money, fmtDate, PAYMENT_LABEL, PAY_STATUS_LABEL } from '../utils/format';
import Logo from './ui/Logo';

/** Thermal-style POS receipt. Printed via CSS (#receipt-print). */
export default function Receipt({ data }) {
  if (!data) return null;
  const { receipt: r, qrDataUrl, thanks } = data;
  return (
    <div id="receipt-print" className="mx-auto w-full max-w-[320px] rounded-lg border border-line bg-white p-5 font-mono text-[11px] leading-relaxed text-black shadow-soft">
      <div className="flex flex-col items-center border-b border-dashed border-neutral-400 pb-3 text-center">
        <Logo className="h-10" tagline />
      </div>
      <div className="space-y-0.5 border-b border-dashed border-neutral-400 py-3">
        <Row k="Receipt No." v={r.orderNumber} bold />
        <Row k="Date" v={fmtDate(r.createdAt, true)} />
        <Row k="Cashier" v={r.cashierName || '—'} />
        {r.customerSnapshot?.fullName && <Row k="Customer" v={r.customerSnapshot.fullName} />}
        {r.customerSnapshot?.mobile && <Row k="Mobile" v={r.customerSnapshot.mobile} />}
      </div>
      <div className="space-y-2 border-b border-dashed border-neutral-400 py-3">
        {r.items.map((i) => (
          <div key={i._id}>
            <div className="flex justify-between gap-2 font-bold"><span>{i.productNameSnapshot}</span><span>{money(i.subtotal)}</span></div>
            <div className="text-neutral-600">{i.size} / {i.color} · {i.quantity} × {money(i.unitPrice)}</div>
          </div>
        ))}
      </div>
      <div className="space-y-0.5 border-b border-dashed border-neutral-400 py-3">
        <Row k="Subtotal" v={money(r.subtotal)} />
        {r.discount > 0 && <Row k="Discount" v={`- ${money(r.discount)}`} />}
        <div className="flex justify-between pt-1 text-sm font-bold"><span>TOTAL</span><span>{money(r.total)}</span></div>
        <Row k="Payment" v={PAYMENT_LABEL[r.paymentMethod]} />
        <Row k="Status" v={PAY_STATUS_LABEL[r.paymentStatus]} />
        {r.paymentMethod === 'cash' && r.amountReceived != null && (<><Row k="Received" v={money(r.amountReceived)} /><Row k="Change" v={money(r.changeDue)} /></>)}
      </div>
      <div className="flex flex-col items-center pt-3 text-center">
        {qrDataUrl && <img src={qrDataUrl} alt="Receipt verification QR code" className="h-24 w-24" />}
        <p className="mt-1 text-[9px] text-neutral-500">Scan to verify this receipt</p>
        <p className="mt-2 text-xs font-bold">{thanks}</p>
      </div>
    </div>
  );
}
const Row = ({ k, v, bold }) => <div className="flex justify-between gap-3"><span className="text-neutral-600">{k}</span><span className={bold ? 'font-bold' : ''}>{v}</span></div>;
