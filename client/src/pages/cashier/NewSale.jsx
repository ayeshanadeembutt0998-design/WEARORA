import { useCallback, useEffect, useRef, useState } from 'react';
import { Banknote, CheckCircle2, CreditCard, Download, Mail, Minus, Plus, Printer, ScanLine, Search, SearchX, Trash2, User, UserPlus, Wallet, X } from 'lucide-react';
import ProductImage from '../../components/ProductImage';
import Receipt from '../../components/Receipt';
import VariantPicker from '../../components/VariantPicker';
import { EmptyState, Modal, Pagination, Spinner, ProductCardSkeleton } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { useDebounce } from '../../hooks/useDebounce';
import { useToast } from '../../context/ToastContext';
import { api, downloadBlob, qs } from '../../services/api';
import { CATEGORY_LABEL, cx, money, uuid } from '../../utils/format';

const CATS = [['', 'All'], ['women', 'Women'], ['men', 'Men'], ['kids', 'Kids']];
const METHODS = [['cash', 'Cash', Banknote], ['card', 'Card', CreditCard], ['wallet', 'Wallet', Wallet]];

export default function NewSale() {
  const toast = useToast();
  const { data: cfg } = useAsync(() => api.get('/config'), []);
  const maxDisc = cfg?.store.maxPosDiscountPercent ?? 10;
  const [search, setSearch] = useState(''); const dq = useDebounce(search, 300); const [cat, setCat] = useState(''); const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(() => api.get(`/products${qs({ q: dq, category: cat, page, limit: 12 })}`), [dq, cat, page]);
  const [lines, setLines] = useState([]);
  const [picker, setPicker] = useState(null);
  const [customer, setCustomer] = useState(null); const [manual, setManual] = useState({ fullName: '', mobile: '', email: '' }); const [showManual, setShowManual] = useState(false);
  const [cq, setCq] = useState(''); const dcq = useDebounce(cq, 300); const [found, setFound] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [pay, setPay] = useState(false); const [method, setMethod] = useState('cash'); const [received, setReceived] = useState(''); const [simFail, setSimFail] = useState(false); const [emailReceipt, setEmailReceipt] = useState(true);
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(null);
  const key = useRef(uuid()); const scanRef = useRef(null); const [scanVal, setScanVal] = useState('');

  const focusScan = () => setTimeout(() => scanRef.current?.focus(), 50);
  useEffect(() => { focusScan(); }, []);

  // ---- cart ----
  const addLine = useCallback((product, v, qty = 1) => {
    const stock = v.stockQuantity;
    setLines((cur) => {
      const k = `${product.id}:${v._id}`; const ex = cur.find((l) => l.key === k);
      const next = (ex?.qty || 0) + qty;
      if (stock < 1) { toast.error(`${product.name} (${v.size}/${v.color}) is out of stock`); return cur; }
      if (next > stock) { toast.error(`Only ${stock} in stock for ${product.name} (${v.size}/${v.color})`); return cur; }
      if (ex) return cur.map((l) => (l.key === k ? { ...l, qty: next, stock } : l));
      return [...cur, { key: k, productId: product.id, variationId: v._id, name: product.name, size: v.size, color: v.color, colorHex: v.colorHex, barcode: v.barcode, unitPrice: product.effectivePrice, originalPrice: product.price, image: product.images[0], qty, stock }];
    });
  }, [toast]);
  const setQty = (k, q) => setLines((c) => c.map((l) => (l.key === k ? { ...l, qty: Math.max(1, Math.min(q, l.stock)) } : l)));
  const removeLine = (k) => setLines((c) => c.filter((l) => l.key !== k));

  // ---- barcode ----
  const scan = useCallback(async (code) => {
    code = code.trim(); if (!code) return;
    try { const r = await api.get(`/products/barcode/${encodeURIComponent(code)}`); addLine(r.product, r.variation); toast.success(`${r.product.name} · ${r.variation.size}/${r.variation.color} added`); }
    catch (e) { toast.error(e.code === 'BARCODE_NOT_FOUND' ? `Unknown barcode ${code}` : e.message); }
    setScanVal(''); focusScan();
  }, [addLine, toast]);
  // scanner that types while no field is focused
  useEffect(() => {
    let buf = ''; let last = 0;
    const h = (e) => {
      const tag = e.target.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || picker || pay || done) return;
      const now = Date.now(); if (now - last > 80) buf = ''; last = now;
      if (e.key === 'Enter') { if (buf.length >= 6) scan(buf); buf = ''; } else if (/^\d$/.test(e.key)) buf += e.key;
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [scan, picker, pay, done]);

  // ---- customer lookup ----
  useEffect(() => { if (dcq.trim().length < 3 || customer) { setFound([]); return; } api.get(`/cashier/customers/search${qs({ q: dcq })}`).then((r) => setFound(r.customers)).catch(() => setFound([])); }, [dcq, customer]);
  const effCustomer = customer || (showManual && (manual.fullName || manual.mobile || manual.email) ? manual : null);
  const custEmail = effCustomer?.email;

  // ---- totals (display only; backend recalculates) ----
  const subtotal = lines.reduce((s, l) => s + l.originalPrice * l.qty, 0);
  const sale = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const extra = Math.round(sale * (discount || 0)) / 100;
  const total = Math.round((sale - extra) * 100) / 100;
  const received_n = Number(received) || 0; const change = Math.max(0, Math.round((received_n - total) * 100) / 100);
  const canPay = lines.length > 0 && discount >= 0 && discount <= maxDisc;

  const openPay = () => { setMethod('cash'); setReceived(String(total)); setSimFail(false); setPay(true); };
  const confirm = async () => {
    if (method === 'cash' && received_n < total) return toast.error('Amount received is less than the total');
    setBusy(true);
    try {
      const body = {
        items: lines.map((l) => ({ productId: l.productId, variationId: l.variationId, quantity: l.qty })), discountPercent: Number(discount) || 0, paymentMethod: method,
        amountReceived: method === 'cash' ? received_n : undefined, simulateOutcome: method === 'cash' ? undefined : simFail ? 'failure' : 'success', emailReceipt: Boolean(emailReceipt && custEmail), idempotencyKey: key.current,
        customer: customer ? { userId: customer.userId, fullName: customer.fullName, mobile: customer.mobile, email: customer.email } : effCustomer || undefined,
      };
      if (customer && !customer.userId) body.customer = { fullName: customer.fullName, mobile: customer.mobile, email: customer.email };
      const r = await api.post('/pos/sales', body);
      const rec = await api.get(`/pos/receipts/${r.sale.id}`);
      setPay(false); setDone({ receipt: rec, emailed: r.receiptEmailQueued });
      toast.success('Sale completed');
    } catch (e) { toast.error(e.message); if (e.code === 'STOCK_UNAVAILABLE') { reload(); setPay(false); } }
    finally { setBusy(false); }
  };
  const reset = () => { setLines([]); setCustomer(null); setManual({ fullName: '', mobile: '', email: '' }); setShowManual(false); setCq(''); setDiscount(0); setDone(null); key.current = uuid(); reload(); focusScan(); };

  const emailNow = async () => { try { const r = await api.post(`/pos/receipts/${done.receipt.receipt.id}/email`, {}); toast.success(r.message); } catch (e) { toast.error(e.message); } };
  const pdf = async () => { try { downloadBlob(await api.blob(`/pos/receipts/${done.receipt.receipt.id}/pdf`), `${done.receipt.receipt.orderNumber}.pdf`); } catch (e) { toast.error(e.message); } };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
      {/* ---------- catalogue ---------- */}
      <section className="min-w-0">
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative min-w-52 flex-1"><ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gold-dark" />
            <input ref={scanRef} className="input pl-9" placeholder="Scan barcode and press Enter" value={scanVal} onChange={(e) => setScanVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); scan(scanVal); } }} aria-label="Scan barcode" inputMode="numeric" /></div>
          <div className="relative min-w-52 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="input pl-9" placeholder="Search products by name" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search products" /></div>
        </div>
        <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1" role="tablist">{CATS.map(([v, l]) => <button key={l} role="tab" aria-selected={cat === v} onClick={() => { setCat(v); setPage(1); }} className={cx('flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition', cat === v ? 'bg-inverse text-on-inverse' : 'text-muted hover:text-ink')}>{l}</button>)}</div>
        {error ? <div className="card p-6 text-center text-sm text-red-600">{error} <button className="underline" onClick={reload}>Retry</button></div> : loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}</div>
        ) : data.products.length === 0 ? <EmptyState icon={SearchX} title="No products found" text="Try another name or category." /> : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">{data.products.map((p) => (
              <button key={p.id} disabled={p.totalStock < 1} onClick={() => setPicker(p)} className="card group overflow-hidden text-left transition hover:-translate-y-0.5 hover:border-gold disabled:opacity-60">
                <div className="relative aspect-square bg-surface2"><ProductImage src={p.images[0]} alt={p.name} className="h-full w-full" />{p.totalStock < 1 && <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-bold text-white">SOLD OUT</span>}
                  {p.onSale && <span className="absolute left-2 top-2 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">SALE</span>}</div>
                <div className="p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-gold-dark">{CATEGORY_LABEL[p.category]}</p><p className="line-clamp-1 text-sm font-bold">{p.name}</p><p className="text-sm font-semibold">{money(p.effectivePrice)}</p></div>
              </button>))}</div>
            <Pagination page={data.pagination.page} pages={data.pagination.pages} onChange={setPage} />
          </>)}
      </section>

      {/* ---------- sale panel ---------- */}
      <aside className="card flex h-fit flex-col xl:sticky xl:top-24 xl:max-h-[calc(100vh-7.5rem)]">
        <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="font-heading text-lg font-bold">Current Sale</h2>{lines.length > 0 && <button className="text-xs font-semibold text-red-600 hover:underline" onClick={() => setLines([])}>Clear all</button>}</div>
        <div className="min-h-[120px] flex-1 overflow-y-auto">
          {lines.length === 0 ? <div className="flex flex-col items-center justify-center px-6 py-10 text-center text-sm text-muted"><ScanLine className="mb-2 h-8 w-8 opacity-40" />Scan a barcode or tap a product to start a sale.</div> : (
            <ul className="divide-y divide-line">{lines.map((l) => (
              <li key={l.key} className="flex gap-3 p-3"><div className="h-14 w-12 shrink-0 overflow-hidden rounded-md bg-surface2"><ProductImage src={l.image} alt="" className="h-full w-full" /></div>
                <div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="line-clamp-1 text-sm font-semibold">{l.name}</p><button onClick={() => removeLine(l.key)} className="text-muted hover:text-red-600" aria-label={`Remove ${l.name}`}><Trash2 className="h-4 w-4" /></button></div>
                  <p className="text-xs text-muted">{l.color} · {l.size} · {money(l.unitPrice)}</p>
                  <div className="mt-1.5 flex items-center justify-between"><div className="inline-flex items-center rounded-lg border border-line"><button className="px-2 py-1 hover:bg-surface2" onClick={() => (l.qty > 1 ? setQty(l.key, l.qty - 1) : removeLine(l.key))} aria-label="Decrease"><Minus className="h-3.5 w-3.5" /></button><span className="min-w-7 text-center text-sm font-semibold tabular-nums">{l.qty}</span><button className="px-2 py-1 hover:bg-surface2 disabled:opacity-30" disabled={l.qty >= l.stock} onClick={() => setQty(l.key, l.qty + 1)} aria-label="Increase"><Plus className="h-3.5 w-3.5" /></button></div>
                    <span className="text-sm font-bold">{money(l.unitPrice * l.qty)}</span></div></div></li>))}</ul>)}
        </div>
        <div className="space-y-3 border-t border-line p-4">
          {/* customer */}
          {customer ? (
            <div className="flex items-center justify-between rounded-lg bg-gold-soft/50 px-3 py-2 text-sm dark:bg-gold/10"><div className="flex min-w-0 items-center gap-2"><User className="h-4 w-4 shrink-0 text-gold-dark" /><div className="min-w-0"><p className="truncate font-semibold">{customer.fullName || 'Customer'}</p><p className="truncate text-xs text-muted">{customer.mobile} {customer.email}</p></div></div><button onClick={() => { setCustomer(null); setCq(''); }} aria-label="Remove customer"><X className="h-4 w-4" /></button></div>
          ) : (
            <div className="relative"><div className="relative"><User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="input !py-2 pl-9 text-xs" placeholder="Customer (optional): search mobile or email" value={cq} onChange={(e) => setCq(e.target.value)} aria-label="Search customer" /></div>
              {found.length > 0 && <ul className="absolute bottom-full z-10 mb-1 max-h-48 w-full overflow-y-auto rounded-lg border border-line bg-surface shadow-soft">{found.map((c, i) => <li key={i}><button className="w-full px-3 py-2 text-left text-xs hover:bg-surface2" onClick={() => { setCustomer(c); setFound([]); }}><b>{c.fullName || 'Walk-in'}</b> {c.registered && <span className="text-emerald-600">• registered</span>}<br /><span className="text-muted">{c.mobile} {c.email}</span></button></li>)}</ul>}
              <button type="button" className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-gold-dark hover:underline" onClick={() => setShowManual((s) => !s)}><UserPlus className="h-3.5 w-3.5" />{showManual ? 'Hide' : 'Add'} customer details</button>
              {showManual && <div className="mt-2 grid gap-2"><input className="input !py-2 text-xs" placeholder="Full name" value={manual.fullName} onChange={(e) => setManual({ ...manual, fullName: e.target.value })} aria-label="Customer name" /><div className="grid grid-cols-2 gap-2"><input className="input !py-2 text-xs" placeholder="Mobile" value={manual.mobile} onChange={(e) => setManual({ ...manual, mobile: e.target.value })} aria-label="Customer mobile" /><input className="input !py-2 text-xs" type="email" placeholder="Email (for receipt)" value={manual.email} onChange={(e) => setManual({ ...manual, email: e.target.value })} aria-label="Customer email" /></div></div>}</div>)}
          <div className="flex items-center justify-between gap-3 text-sm"><label htmlFor="disc" className="text-muted">Discount % <span className="text-[11px]">(max {maxDisc})</span></label>
            <input id="disc" type="number" min="0" max={maxDisc} step="1" className={cx('input !w-20 !py-1.5 text-right', discount > maxDisc && 'input-error')} value={discount} onChange={(e) => setDiscount(e.target.value === '' ? 0 : Number(e.target.value))} /></div>
          <dl className="space-y-1 text-sm"><div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{money(subtotal)}</dd></div>
            {subtotal - total > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount</dt><dd>− {money(subtotal - total)}</dd></div>}
            <div className="flex justify-between border-t border-line pt-2 text-xl font-extrabold"><dt>Total</dt><dd>{money(total)}</dd></div></dl>
          <button className="btn-gold btn-lg w-full" disabled={!canPay} onClick={openPay}>Complete Sale</button>
          {discount > maxDisc && <p className="text-center text-xs text-red-600">Discount cannot exceed {maxDisc}%.</p>}
        </div>
      </aside>

      <Modal open={Boolean(picker)} onClose={() => setPicker(null)} title={picker?.name || ''} size="sm">
        {picker && <VariantPicker product={picker} submitLabel="Add to sale" onSubmit={async (v, q) => { addLine(picker, v, q); setPicker(null); focusScan(); }} />}
      </Modal>

      <Modal open={pay} onClose={() => !busy && setPay(false)} title="Payment" dismissible={!busy}
        footer={<><button className="btn-outline" onClick={() => setPay(false)} disabled={busy}>Cancel</button><button className="btn-primary" onClick={confirm} disabled={busy || (method === 'cash' && received_n < total)}>{busy && <Spinner className="h-4 w-4" />} Confirm {money(total)}</button></>}>
        <div className="space-y-4">
          <div className="rounded-xl bg-surface2 p-4 text-center"><p className="text-xs text-muted">Amount due</p><p className="text-3xl font-extrabold">{money(total)}</p></div>
          <div className="grid grid-cols-3 gap-2">{METHODS.map(([v, l, I]) => <button key={v} onClick={() => setMethod(v)} aria-pressed={method === v} className={cx('flex flex-col items-center gap-1 rounded-xl border p-3 text-sm font-semibold transition', method === v ? 'border-gold bg-gold-soft/60 dark:bg-gold/10' : 'border-line hover:border-gold/60')}><I className="h-5 w-5 text-gold-dark" />{l}</button>)}</div>
          {method === 'cash' ? (
            <div className="space-y-3"><div><label className="label" htmlFor="recv">Amount received</label><input id="recv" type="number" min="0" className="input text-lg font-bold" value={received} onChange={(e) => setReceived(e.target.value)} autoFocus /></div>
              <div className="flex flex-wrap gap-2">{[total, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000, Math.ceil(total / 5000) * 5000].filter((v, i, a) => a.indexOf(v) === i).map((v) => <button key={v} className="btn-outline btn-sm" onClick={() => setReceived(String(v))}>{money(v)}</button>)}</div>
              <div className={cx('flex justify-between rounded-lg px-4 py-3 text-sm font-bold', received_n >= total ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300')}><span>{received_n >= total ? 'Change due' : 'Short by'}</span><span>{money(received_n >= total ? change : total - received_n)}</span></div></div>
          ) : (
            <div className="rounded-lg border border-dashed border-gold/60 bg-gold-soft/40 p-4 text-sm dark:bg-gold/10"><p className="font-semibold">Simulated {method === 'card' ? 'card' : 'wallet'} payment</p><p className="mt-1 text-xs text-muted">No real transaction occurs. The payment is approved automatically.</p>
              <label className="mt-3 flex items-center gap-2 text-xs"><input type="checkbox" className="accent-[#C69A52]" checked={simFail} onChange={(e) => setSimFail(e.target.checked)} /> Simulate a failed payment (testing)</label></div>)}
          {custEmail && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[#C69A52]" checked={emailReceipt} onChange={(e) => setEmailReceipt(e.target.checked)} /><Mail className="h-4 w-4 text-gold-dark" /> Email receipt to {custEmail}</label>}
        </div>
      </Modal>

      <Modal open={Boolean(done)} onClose={reset} title="Sale complete" size="md" dismissible={false}
        footer={<><button className="btn-outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</button><button className="btn-outline" onClick={pdf}><Download className="h-4 w-4" /> PDF</button>{done?.receipt.receipt.customerSnapshot?.email && <button className="btn-outline" onClick={emailNow}><Mail className="h-4 w-4" /> Email</button>}<button className="btn-primary" onClick={reset}>New Sale</button></>}>
        {done && (<div className="space-y-4"><div className="flex items-center justify-center gap-2 text-emerald-600"><CheckCircle2 className="h-6 w-6" /><p className="font-bold">Payment received — {money(done.receipt.receipt.total)}</p></div>
          {done.emailed && <p className="text-center text-xs text-muted">Receipt is being emailed to {done.receipt.receipt.customerSnapshot.email}.</p>}
          <Receipt data={done.receipt} /></div>)}
      </Modal>
    </div>
  );
}
