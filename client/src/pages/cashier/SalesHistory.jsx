import { useState } from 'react';
import { Download, Eye, Mail, Printer, Receipt as ReceiptIcon, Search } from 'lucide-react';
import Receipt from '../../components/Receipt';
import { EmptyState, ErrorState, Modal, PageHeader, Pagination, PayStatusBadge, Spinner, TableSkeleton } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { useDebounce } from '../../hooks/useDebounce';
import { useToast } from '../../context/ToastContext';
import { api, downloadBlob, qs } from '../../services/api';
import { PAYMENT_LABEL, fmtDate, money } from '../../utils/format';

export default function SalesHistory() {
  const toast = useToast();
  const [q, setQ] = useState(''); const dq = useDebounce(q); const [date, setDate] = useState(''); const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(() => api.get(`/pos/sales/my-sales${qs({ q: dq, date, page, limit: 12 })}`), [dq, date, page]);
  const [open, setOpen] = useState(null); const [rec, setRec] = useState(null); const [busy, setBusy] = useState(false);
  const view = async (s) => { setOpen(s); setRec(null); setBusy(true); try { setRec(await api.get(`/pos/receipts/${s.id}`)); } catch (e) { toast.error(e.message); setOpen(null); } finally { setBusy(false); } };
  const pdf = async () => { try { downloadBlob(await api.blob(`/pos/receipts/${open.id}/pdf`), `${open.orderNumber}.pdf`); } catch (e) { toast.error(e.message); } };
  const mail = async () => { let email = rec.receipt.customerSnapshot?.email; if (!email) email = window.prompt('Email address to send the receipt to:'); if (!email) return; try { const r = await api.post(`/pos/receipts/${open.id}/email`, { email }); toast.success(r.message); } catch (e) { toast.error(e.message); } };
  return (
    <div>
      <PageHeader title="Sales History" subtitle="Your completed in-store sales." />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="input pl-9" placeholder="Search by receipt number" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search receipts" /></div>
        <input type="date" className="input w-44" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} aria-label="Filter by date" />
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="card overflow-x-auto">
          {loading ? <TableSkeleton cols={6} /> : data.sales.length === 0 ? <div className="p-6"><EmptyState icon={ReceiptIcon} title="No sales found" text="Completed sales will appear here." /></div> : (
            <table className="w-full min-w-[720px]"><thead className="border-b border-line bg-surface2"><tr><th className="th">Receipt</th><th className="th">Date</th><th className="th">Customer</th><th className="th">Items</th><th className="th">Payment</th><th className="th">Total</th><th className="th text-right">View</th></tr></thead>
              <tbody className="divide-y divide-line">{data.sales.map((s) => (
                <tr key={s.id} className="cursor-pointer hover:bg-surface2/60" onClick={() => view(s)}>
                  <td className="td font-semibold">{s.orderNumber}</td><td className="td text-xs">{fmtDate(s.createdAt, true)}</td><td className="td text-xs">{s.customerSnapshot?.fullName || <span className="text-muted">Walk-in</span>}</td>
                  <td className="td">{s.itemCount}</td><td className="td"><PayStatusBadge status={s.paymentStatus} /><p className="mt-0.5 text-[11px] text-muted">{PAYMENT_LABEL[s.paymentMethod]}</p></td><td className="td font-semibold">{money(s.total)}</td>
                  <td className="td text-right"><button className="rounded-lg p-2 text-muted hover:bg-surface2" aria-label={`View ${s.orderNumber}`}><Eye className="h-4 w-4" /></button></td></tr>))}</tbody></table>)}
        </div>)}
      {data && <Pagination page={data.pagination.page} pages={data.pagination.pages} onChange={setPage} />}
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={open?.orderNumber || ''} footer={rec && <><button className="btn-outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</button><button className="btn-outline" onClick={pdf}><Download className="h-4 w-4" /> PDF</button><button className="btn-outline" onClick={mail}><Mail className="h-4 w-4" /> Email</button></>}>
        {busy || !rec ? <div className="flex justify-center py-10"><Spinner className="h-7 w-7 text-gold" /></div> : <Receipt data={rec} />}
      </Modal>
    </div>
  );
}
