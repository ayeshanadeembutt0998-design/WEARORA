import { useRef, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, CheckCircle2, RefreshCcw, Search, Undo2, X } from 'lucide-react';
import ProductImage from '../../components/ProductImage';
import VariantPicker from '../../components/VariantPicker';
import { Badge, EmptyState, Modal, PageHeader, Select, Spinner, PayStatusBadge } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { useDebounce } from '../../hooks/useDebounce';
import { useToast } from '../../context/ToastContext';
import { api, qs } from '../../services/api';
import { PAYMENT_LABEL, REASON_LABEL, cx, fmtDate, money, uuid } from '../../utils/format';

function ReplacementPicker({ open, onClose, onPick }) {
  const [q, setQ] = useState(''); const dq = useDebounce(q, 300); const [sel, setSel] = useState(null);
  const { data, loading } = useAsync(() => (open ? api.get(`/products${qs({ q: dq, limit: 8 })}`) : Promise.resolve(null)), [open, dq]);
  return (
    <Modal open={open} onClose={() => { setSel(null); onClose(); }} title={sel ? sel.name : 'Choose replacement item'} size="md">
      {sel ? (<div className="space-y-3"><button className="text-xs font-semibold text-gold-dark hover:underline" onClick={() => setSel(null)}>← Back to results</button><VariantPicker product={sel} submitLabel="Use as replacement" onSubmit={async (v, qty) => { onPick(sel, v, qty); setSel(null); onClose(); }} /></div>) : (
        <div className="space-y-3"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="input pl-9" placeholder="Search name or scan barcode" value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="Search replacement" /></div>
          {loading ? <div className="flex justify-center py-8"><Spinner className="text-gold" /></div> : !data?.products.length ? <p className="py-6 text-center text-sm text-muted">No products found.</p> : (
            <ul className="divide-y divide-line rounded-xl border border-line">{data.products.map((p) => <li key={p.id}><button disabled={p.totalStock < 1} className="flex w-full items-center gap-3 p-3 text-left hover:bg-surface2 disabled:opacity-50" onClick={() => setSel(p)}><div className="h-12 w-10 overflow-hidden rounded bg-surface2"><ProductImage src={p.images[0]} alt="" className="h-full w-full" /></div><div className="flex-1"><p className="text-sm font-semibold">{p.name}</p><p className="text-xs text-muted">{p.totalStock < 1 ? 'Sold out' : `${p.totalStock} in stock`}</p></div><b className="text-sm">{money(p.effectivePrice)}</b></button></li>)}</ul>)}</div>)}
    </Modal>
  );
}

export default function ReturnsExchanges() {
  const toast = useToast();
  const [num, setNum] = useState(''); const [sale, setSale] = useState(null); const [looking, setLooking] = useState(false); const [lookErr, setLookErr] = useState('');
  const [mode, setMode] = useState('return'); const [sel, setSel] = useState({}); const [reason, setReason] = useState('wrong_size'); const [note, setNote] = useState(''); const [method, setMethod] = useState('cash');
  const [repl, setRepl] = useState([]); const [pickerOpen, setPickerOpen] = useState(false); const [simFail, setSimFail] = useState(false);
  const [busy, setBusy] = useState(false); const [result, setResult] = useState(null); const key = useRef(uuid());
  const recent = useAsync(() => api.get('/pos/returns'), []);

  const lookup = async (e) => {
    e?.preventDefault(); if (!num.trim()) return;
    setLooking(true); setLookErr(''); setSale(null); setSel({}); setRepl([]); setResult(null);
    try { const r = await api.get(`/pos/returns/receipt/${encodeURIComponent(num.trim())}`); setSale(r.sale); key.current = uuid(); }
    catch (ex) { setLookErr(ex.message); } finally { setLooking(false); }
  };
  const toggle = (i) => setSel((s) => { const n = { ...s }; if (n[i._id]) delete n[i._id]; else n[i._id] = { qty: 1, resellable: reason !== 'defective' }; return n; });
  const chosen = sale ? sale.items.filter((i) => sel[i._id]) : [];
  const refundValue = chosen.reduce((s, i) => s + i.netUnitPrice * sel[i._id].qty, 0);
  const replValue = repl.reduce((s, r) => s + r.unitPrice * r.qty, 0);
  const diff = Math.round((replValue - refundValue) * 100) / 100;
  const defective = reason === 'defective';

  const submit = async () => {
    if (!chosen.length) return toast.error('Select at least one item');
    if (mode === 'exchange' && !repl.length) return toast.error('Choose a replacement item');
    setBusy(true);
    try {
      const items = chosen.map((i) => ({ orderItemId: i._id, quantity: sel[i._id].qty, resellable: defective ? false : sel[i._id].resellable }));
      const r = mode === 'return'
        ? await api.post('/pos/returns', { orderId: sale._id, items, reason, reasonNote: note, refundMethod: method, idempotencyKey: key.current })
        : await api.post('/pos/exchanges', { orderId: sale._id, items, replacements: repl.map((x) => ({ productId: x.productId, variationId: x.variationId, quantity: x.qty })), reason, reasonNote: note, settlementMethod: method, simulateOutcome: method === 'cash' ? undefined : simFail ? 'failure' : 'success', idempotencyKey: key.current });
      setResult(r.record); setSale(r.sale); setSel({}); setRepl([]); key.current = uuid(); recent.reload(); toast.success(r.message);
    } catch (ex) { toast.error(ex.message); } finally { setBusy(false); }
  };

  const el = sale?.eligibility;
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Returns & Exchanges" subtitle="Look up the original receipt, then process a return or exchange." />
      <form onSubmit={lookup} className="card mb-5 flex flex-wrap gap-3 p-4">
        <div className="relative min-w-60 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="input pl-9 uppercase" placeholder="Enter receipt number, e.g. WR-POS-20261117-0001" value={num} onChange={(e) => setNum(e.target.value)} aria-label="Receipt number" autoFocus /></div>
        <button className="btn-primary" disabled={looking || !num.trim()}>{looking ? <Spinner className="h-4 w-4" /> : 'Find receipt'}</button>
      </form>
      {lookErr && <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertTriangle className="h-4 w-4" />{lookErr}</div>}

      {result && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-5 w-5" /> {result.transactionType === 'exchange' ? 'Exchange' : 'Return'} completed · {result.referenceNumber}</div>
          <div className="mt-2 text-sm">{result.refundAmount > 0 && <p><b>Give customer:</b> {money(result.refundAmount)} ({PAYMENT_LABEL[result.refundMethod]})</p>}{result.additionalPayment > 0 && <p><b>Collect from customer:</b> {money(result.additionalPayment)} ({PAYMENT_LABEL[result.additionalPaymentMethod]})</p>}
            {result.returnedItems.some((i) => !i.resellable) && <p className="text-xs text-muted">Non-resellable items were not added back to stock.</p>}</div>
        </div>)}

      {sale && (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <section className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-heading text-xl font-bold">{sale.orderNumber}</h2><p className="text-xs text-muted">{fmtDate(sale.createdAt, true)} · Cashier {sale.cashierName} · {sale.customer?.fullName || 'Walk-in customer'}</p></div><div className="text-right"><p className="text-lg font-bold">{money(sale.total)}</p><PayStatusBadge status={sale.paymentStatus} /></div></div>
              <p className={cx('mt-3 rounded-lg px-3 py-2 text-xs font-semibold', el.eligible ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300')}>
                {el.eligible ? `Eligible until ${fmtDate(el.deadline)} (${el.windowDays}-day policy)` : el.reason}</p>
            </section>
            {el.eligible && (
              <section className="card divide-y divide-line">
                <div className="flex items-center justify-between p-4"><h3 className="font-bold">Select items</h3>
                  <div className="inline-flex rounded-lg border border-line p-0.5">{[['return', 'Return', Undo2], ['exchange', 'Exchange', ArrowLeftRight]].map(([v, l, I]) => <button key={v} onClick={() => setMode(v)} aria-pressed={mode === v} className={cx('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold', mode === v ? 'bg-inverse text-on-inverse' : 'text-muted')}><I className="h-3.5 w-3.5" />{l}</button>)}</div></div>
                {sale.items.map((i) => { const on = Boolean(sel[i._id]); const done = i.remaining < 1; return (
                  <div key={i._id} className={cx('flex flex-wrap items-center gap-3 p-4', done && 'opacity-50')}>
                    <input type="checkbox" className="h-4 w-4 accent-[#C69A52]" checked={on} disabled={done} onChange={() => toggle(i)} aria-label={`Select ${i.productNameSnapshot}`} />
                    <div className="h-14 w-11 overflow-hidden rounded bg-surface2"><ProductImage src={i.imageSnapshot} alt="" className="h-full w-full" /></div>
                    <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{i.productNameSnapshot}</p><p className="text-xs text-muted">{i.color} · {i.size} · bought {i.quantity} · {money(i.netUnitPrice)} each{i.returnedQty > 0 && <span className="text-amber-600"> · {i.returnedQty} already returned</span>}</p></div>
                    {on && (<div className="flex items-center gap-3"><div className="inline-flex items-center rounded-lg border border-line text-sm"><button className="px-2.5 py-1" disabled={sel[i._id].qty <= 1} onClick={() => setSel({ ...sel, [i._id]: { ...sel[i._id], qty: sel[i._id].qty - 1 } })} aria-label="Less">−</button><span className="min-w-6 text-center font-semibold">{sel[i._id].qty}</span><button className="px-2.5 py-1" disabled={sel[i._id].qty >= i.remaining} onClick={() => setSel({ ...sel, [i._id]: { ...sel[i._id], qty: sel[i._id].qty + 1 } })} aria-label="More">+</button></div>
                      <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" className="accent-[#C69A52]" disabled={defective} checked={defective ? false : sel[i._id].resellable} onChange={(e) => setSel({ ...sel, [i._id]: { ...sel[i._id], resellable: e.target.checked } })} /> Resellable</label></div>)}
                    {done && <Badge tone="gray">Fully returned</Badge>}
                  </div>); })}
              </section>)}
            {el.eligible && mode === 'exchange' && (
              <section className="card p-5"><div className="mb-3 flex items-center justify-between"><h3 className="font-bold">Replacement items</h3><button className="btn-outline btn-sm" onClick={() => setPickerOpen(true)}>+ Add replacement</button></div>
                {repl.length === 0 ? <p className="text-sm text-muted">No replacement selected yet.</p> : <ul className="divide-y divide-line">{repl.map((r, i) => <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm"><div><p className="font-semibold">{r.name}</p><p className="text-xs text-muted">{r.color} · {r.size} × {r.qty}</p></div><div className="flex items-center gap-3"><b>{money(r.unitPrice * r.qty)}</b><button onClick={() => setRepl(repl.filter((_, x) => x !== i))} aria-label="Remove replacement"><X className="h-4 w-4 text-muted hover:text-red-600" /></button></div></li>)}</ul>}</section>)}
          </div>

          {el.eligible && (
            <aside className="card h-fit space-y-4 p-5 lg:sticky lg:top-24">
              <h3 className="font-heading text-lg font-bold">{mode === 'return' ? 'Return' : 'Exchange'} summary</h3>
              <div><label className="label" htmlFor="reason">Reason</label><Select id="reason" value={reason} onChange={(e) => { setReason(e.target.value); if (e.target.value === 'defective') setSel((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { ...v, resellable: false }]))); }}>{Object.entries(REASON_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
                {defective && <p className="mt-1 text-xs text-amber-700">Defective items are never added back to stock.</p>}</div>
              <div><label className="label" htmlFor="note">Note (optional)</label><input id="note" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></div>
              <div><label className="label" htmlFor="meth">{mode === 'return' ? 'Refund method' : diff >= 0 ? 'Payment method' : 'Refund method'}</label><Select id="meth" value={method} onChange={(e) => setMethod(e.target.value)}><option value="cash">Cash</option><option value="card">Card (Simulated)</option><option value="wallet">Wallet (Simulated)</option></Select></div>
              <dl className="space-y-1.5 border-t border-line pt-3 text-sm">
                <div className="flex justify-between"><dt className="text-muted">Returned value</dt><dd>{money(refundValue)}</dd></div>
                {mode === 'exchange' && <div className="flex justify-between"><dt className="text-muted">Replacement value</dt><dd>{money(replValue)}</dd></div>}
                <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
                  {mode === 'return' ? <><dt>Refund</dt><dd>{money(refundValue)}</dd></> : diff > 0 ? <><dt>Customer pays</dt><dd>{money(diff)}</dd></> : diff < 0 ? <><dt>Refund to customer</dt><dd>{money(-diff)}</dd></> : <><dt>Even exchange</dt><dd>{money(0)}</dd></>}</div></dl>
              {mode === 'exchange' && diff > 0 && method !== 'cash' && <label className="flex items-center gap-2 text-xs"><input type="checkbox" className="accent-[#C69A52]" checked={simFail} onChange={(e) => setSimFail(e.target.checked)} /> Simulate failed payment (testing)</label>}
              <button className="btn-gold btn-lg w-full" disabled={busy || !chosen.length || (mode === 'exchange' && !repl.length)} onClick={submit}>{busy ? <Spinner className="h-4 w-4" /> : mode === 'return' ? 'Complete Return' : 'Complete Exchange'}</button>
            </aside>)}
        </div>)}

      {!sale && !lookErr && !looking && <EmptyState icon={RefreshCcw} title="Find a receipt to begin" text="Enter the receipt number printed on the customer’s original in-store receipt." />}

      <section className="mt-8"><h2 className="mb-3 font-heading text-lg font-bold">Recent returns & exchanges</h2>
        {recent.loading ? <div className="flex justify-center py-6"><Spinner className="text-gold" /></div> : !recent.data?.records.length ? <p className="text-sm text-muted">Nothing processed yet.</p> : (
          <div className="card overflow-x-auto"><table className="w-full min-w-[560px]"><thead className="border-b border-line bg-surface2"><tr><th className="th">Reference</th><th className="th">Type</th><th className="th">Receipt</th><th className="th">Reason</th><th className="th">Amount</th><th className="th">Date</th></tr></thead>
            <tbody className="divide-y divide-line">{recent.data.records.map((r) => <tr key={r._id}><td className="td font-semibold">{r.referenceNumber}</td><td className="td"><Badge tone={r.transactionType === 'exchange' ? 'purple' : 'amber'}>{r.transactionType}</Badge></td><td className="td text-xs">{r.originalOrderNumber}</td><td className="td text-xs">{REASON_LABEL[r.returnReason]}</td><td className="td text-xs">{r.refundAmount > 0 ? `Refund ${money(r.refundAmount)}` : r.additionalPayment > 0 ? `Paid ${money(r.additionalPayment)}` : '—'}</td><td className="td text-xs text-muted">{fmtDate(r.createdAt, true)}</td></tr>)}</tbody></table></div>)}</section>
      <ReplacementPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={(p, v, qty) => setRepl((c) => [...c, { productId: p.id, variationId: v._id, name: p.name, size: v.size, color: v.color, unitPrice: p.effectivePrice, qty }])} />
    </div>
  );
}
