import { useState } from 'react';
import { AlertTriangle, Boxes, Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import ProductImage from '../../components/ProductImage';
import { Badge, ConfirmDialog, Drawer, EmptyState, ErrorState, PageHeader, Pagination, Select, TableSkeleton, Spinner } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { useDebounce } from '../../hooks/useDebounce';
import { useToast } from '../../context/ToastContext';
import { api, qs } from '../../services/api';
import { CATEGORY_LABEL, MOVEMENT_LABEL, fmtDate, money } from '../../utils/format';
import ProductForm from './ProductForm';

function ProductView({ id, onClose }) {
  const { data, loading, error } = useAsync(async () => { if (!id) return null; const [p, m] = await Promise.all([api.get(`/admin/products/${id}`), api.get(`/admin/products/${id}/movements`)]); return { product: p.product, movements: m.movements }; }, [id]);
  return (
    <Drawer open={Boolean(id)} onClose={onClose} title="Product Details" width="max-w-2xl">
      {loading ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-gold" /></div> : error ? <ErrorState message={error} /> : data && (() => { const p = data.product; return (
        <div className="space-y-6">
          <div className="flex gap-4"><div className="h-36 w-28 shrink-0 overflow-hidden rounded-xl bg-surface2"><ProductImage src={p.images[0]} alt={p.name} className="h-full w-full" /></div>
            <div><Badge tone={p.status === 'active' ? 'green' : 'gray'}>{p.status}</Badge><h3 className="mt-2 text-xl font-bold">{p.name}</h3><p className="text-sm text-muted">{CATEGORY_LABEL[p.category]}</p>
              <p className="mt-2 font-bold">{money(p.effectivePrice)} {p.salePrice != null && p.salePrice < p.price && <span className="text-sm font-normal text-muted line-through">{money(p.price)}</span>}</p><p className="text-xs text-muted">Total stock: {p.totalStock}</p></div></div>
          {p.description && <p className="text-sm text-muted">{p.description}</p>}
          <div><h4 className="mb-2 font-bold">Variations</h4><div className="overflow-x-auto rounded-lg border border-line"><table className="w-full text-sm"><thead className="bg-surface2"><tr><th className="th">Color</th><th className="th">Size</th><th className="th">Barcode</th><th className="th">Stock</th></tr></thead>
            <tbody className="divide-y divide-line">{p.variations.map((v) => <tr key={v._id}><td className="td"><span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border border-line" style={{ background: v.colorHex || '#ddd' }} />{v.color}</span></td><td className="td">{v.size}</td><td className="td font-mono text-xs">{v.barcode}</td><td className="td"><span className={v.stockQuantity === 0 ? 'font-bold text-red-600' : v.stockQuantity <= 5 ? 'font-bold text-amber-600' : ''}>{v.stockQuantity}</span></td></tr>)}</tbody></table></div></div>
          <div><h4 className="mb-2 font-bold">Inventory history</h4>{data.movements.length === 0 ? <p className="text-sm text-muted">No movements yet.</p> : (
            <ul className="divide-y divide-line rounded-lg border border-line text-sm">{data.movements.slice(0, 30).map((m) => (
              <li key={m._id} className="flex items-center justify-between gap-3 px-3 py-2"><div><p className="font-semibold">{MOVEMENT_LABEL[m.movementType]}</p><p className="text-xs text-muted">{m.color}/{m.size} · {fmtDate(m.createdAt, true)}{m.performedBy ? ` · ${m.performedBy.fullName}` : ''}</p></div>
                <div className="text-right"><p className={m.quantity < 0 ? 'font-bold text-red-600' : 'font-bold text-emerald-600'}>{m.quantity > 0 ? '+' : ''}{m.quantity}</p><p className="text-xs text-muted">{m.previousStock} → {m.newStock}</p></div></li>))}</ul>)}</div>
        </div>); })()}
    </Drawer>
  );
}

export default function ProductsManagement() {
  const toast = useToast();
  const [q, setQ] = useState(''); const dq = useDebounce(q); const [category, setCategory] = useState(''); const [status, setStatus] = useState(''); const [stock, setStock] = useState(''); const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(() => api.get(`/admin/products${qs({ q: dq, category, status, stock, page, limit: 10 })}`), [dq, category, status, stock, page]);
  const [form, setForm] = useState({ open: false, product: null }); const [viewId, setViewId] = useState(null); const [del, setDel] = useState(null); const [busy, setBusy] = useState(false);
  const f = (setter) => (e) => { setter(e.target.value); setPage(1); };
  const remove = async () => { setBusy(true); try { const r = await api.del(`/admin/products/${del.id}`); toast.success(r.message); setDel(null); reload(); } catch (e) { toast.error(e.message); } finally { setBusy(false); } };
  const ic = 'rounded-lg p-2 text-muted hover:bg-surface2 hover:text-ink';
  return (
    <div>
      <PageHeader title="Products Management" subtitle="Manage the shared catalogue and inventory used by the store and POS." actions={<button className="btn-primary" onClick={() => setForm({ open: true, product: null })}><Plus className="h-4 w-4" /> Add Product</button>} />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-60 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="input pl-9" placeholder="Search by name or barcode" value={q} onChange={f(setQ)} aria-label="Search products" /></div>
        <Select className="w-36" value={category} onChange={f(setCategory)} aria-label="Category"><option value="">All categories</option><option value="women">Women</option><option value="men">Men</option><option value="kids">Kids</option></Select>
        <Select className="w-36" value={status} onChange={f(setStatus)} aria-label="Status"><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></Select>
        <Select className="w-40" value={stock} onChange={f(setStock)} aria-label="Stock"><option value="">All stock levels</option><option value="low">Low / out of stock</option></Select>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="card overflow-x-auto">
          {loading ? <TableSkeleton cols={6} /> : data.products.length === 0 ? <div className="p-6"><EmptyState icon={Boxes} title="No products found" text="Add your first product or adjust the filters." /></div> : (
            <table className="w-full min-w-[820px]"><thead className="border-b border-line bg-surface2"><tr><th className="th">Product</th><th className="th">Category</th><th className="th">Price</th><th className="th">Stock</th><th className="th">Status</th><th className="th text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-line">{data.products.map((p) => (
                <tr key={p.id} className="hover:bg-surface2/60">
                  <td className="td"><div className="flex items-center gap-3"><div className="h-12 w-10 shrink-0 overflow-hidden rounded-md bg-surface2"><ProductImage src={p.images[0]} alt="" className="h-full w-full" /></div><div><p className="font-semibold">{p.name}</p><p className="text-xs text-muted">{p.variations.length} variation{p.variations.length === 1 ? '' : 's'}</p></div></div></td>
                  <td className="td">{CATEGORY_LABEL[p.category]}</td>
                  <td className="td font-semibold">{money(p.effectivePrice)}{p.salePrice != null && p.salePrice < p.price && <span className="ml-1 text-xs font-normal text-muted line-through">{money(p.price)}</span>}</td>
                  <td className="td"><span className="font-semibold tabular-nums">{p.totalStock}</span>{p.outOfStock ? <Badge tone="red" className="ml-2">Out of stock</Badge> : p.lowStock && <Badge tone="amber" className="ml-2"><AlertTriangle className="mr-1 h-3 w-3" />Low</Badge>}</td>
                  <td className="td"><Badge tone={p.status === 'active' ? 'green' : 'gray'}>{p.status === 'active' ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="td"><div className="flex justify-end gap-1"><button className={ic} title="View" aria-label={`View ${p.name}`} onClick={() => setViewId(p.id)}><Eye className="h-4 w-4" /></button><button className={ic} title="Edit" aria-label={`Edit ${p.name}`} onClick={() => setForm({ open: true, product: p })}><Pencil className="h-4 w-4" /></button><button className={ic} title="Delete" aria-label={`Delete ${p.name}`} onClick={() => setDel(p)}><Trash2 className="h-4 w-4 text-red-600" /></button></div></td>
                </tr>))}</tbody></table>)}
        </div>)}
      {data && <Pagination page={data.pagination.page} pages={data.pagination.pages} onChange={setPage} />}
      <ProductForm open={form.open} product={form.product} onClose={() => setForm({ open: false, product: null })} onSaved={(close = true) => reload()} />
      <ProductView id={viewId} onClose={() => setViewId(null)} />
      <ConfirmDialog open={Boolean(del)} danger loading={busy} title="Delete product?" confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={remove} message={`“${del?.name}” will be removed from the store. Products that already appear in orders are deactivated instead, so history is preserved.`} />
    </div>
  );
}
