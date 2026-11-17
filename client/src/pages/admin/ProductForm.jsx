import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import ProductImage from '../../components/ProductImage';
import { Field, Modal, Select, Spinner, TextInput } from '../../components/ui';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { cx } from '../../utils/format';

const blank = { name: '', description: '', category: 'men', price: '', salePrice: '', status: 'active', images: [], variations: [] };
const SIZE_PRESETS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '4Y', '6Y', '8Y', '10Y', '30', '32', '34', '36'];
const genBarcode = () => { const b = '2' + Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join(''); let s = 0; for (let i = 0; i < 12; i++) s += +b[i] * (i % 2 ? 3 : 1); return b + ((10 - (s % 10)) % 10); };

/** Create / edit product. Stock of existing variations is changed through the atomic "Adjust" control. */
export default function ProductForm({ open, onClose, product, onSaved }) {
  const toast = useToast(); const edit = Boolean(product);
  const [f, setF] = useState(blank); const [err, setErr] = useState({}); const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false);
  const [sizes, setSizes] = useState([]); const [colors, setColors] = useState([]); const [cName, setCName] = useState(''); const [cHex, setCHex] = useState('#171717'); const [customSize, setCustomSize] = useState('');
  const [adjust, setAdjust] = useState(null); const file = useRef(null);

  useEffect(() => {
    if (!open) return;
    setErr({}); setAdjust(null); setSizes([]); setColors([]);
    setF(product ? { ...blank, ...product, price: product.price, salePrice: product.salePrice ?? '', variations: product.variations.map((v) => ({ ...v })) } : { ...blank, variations: [] });
  }, [open, product]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggleSize = (s) => setSizes((l) => (l.includes(s) ? l.filter((x) => x !== s) : [...l, s]));
  const addColor = () => { if (!cName.trim() || colors.some((c) => c.name.toLowerCase() === cName.trim().toLowerCase())) return; setColors([...colors, { name: cName.trim(), hex: cHex }]); setCName(''); };

  const generate = () => {
    if (!sizes.length || !colors.length) return toast.error('Select at least one size and add at least one color');
    const exists = new Set(f.variations.map((v) => `${v.size.toLowerCase()}|${v.color.toLowerCase()}`));
    const add = [];
    colors.forEach((c) => sizes.forEach((s) => { if (!exists.has(`${s.toLowerCase()}|${c.name.toLowerCase()}`)) add.push({ size: s, color: c.name, colorHex: c.hex, barcode: genBarcode(), stockQuantity: 0, sku: '', _new: true }); }));
    if (!add.length) return toast.info('Those variations already exist');
    setF({ ...f, variations: [...f.variations, ...add] }); toast.success(`${add.length} variation(s) added`);
  };
  const upVar = (i, patch) => setF({ ...f, variations: f.variations.map((v, x) => (x === i ? { ...v, ...patch } : v)) });
  const rmVar = (i) => setF({ ...f, variations: f.variations.filter((_, x) => x !== i) });

  const upload = async (e) => {
    const files = [...e.target.files]; e.target.value = '';
    if (!files.length) return;
    if (f.images.length + files.length > 5) return toast.error('You can upload up to 5 images');
    const fd = new FormData(); files.forEach((x) => fd.append('images', x));
    setUploading(true);
    try { const r = await api.post('/admin/products/images', fd); setF((cur) => ({ ...cur, images: [...cur.images, ...r.images] })); } catch (ex) { toast.error(ex.message); } finally { setUploading(false); }
  };

  const validate = () => {
    const v = {};
    if (f.name.trim().length < 2) v.name = 'Product name is required';
    if (f.price === '' || Number(f.price) < 0) v.price = 'Enter a valid price';
    if (f.salePrice !== '' && Number(f.salePrice) >= Number(f.price)) v.salePrice = 'Must be lower than the price';
    if (!f.variations.length) v.variations = 'Add at least one variation';
    const bc = f.variations.map((x) => x.barcode).filter(Boolean);
    if (new Set(bc).size !== bc.length) v.variations = 'Barcodes must be unique';
    return v;
  };
  const submit = async () => {
    const v = validate(); setErr(v); if (Object.keys(v).length) return toast.error(Object.values(v)[0]);
    setBusy(true);
    const body = { name: f.name, description: f.description, category: f.category, price: Number(f.price), salePrice: f.salePrice === '' ? null : Number(f.salePrice), status: f.status, images: f.images,
      variations: f.variations.map(({ _new, ...x }) => ({ ...x, stockQuantity: Number(x.stockQuantity) || 0 })) };
    try { if (edit) await api.patch(`/admin/products/${product.id}`, body); else await api.post('/admin/products', body); toast.success(edit ? 'Product updated' : 'Product created'); onSaved(); onClose(); }
    catch (ex) { setErr(ex.errors || {}); toast.error(ex.message); } finally { setBusy(false); }
  };

  const applyAdjust = async () => {
    const { v, mode, qty } = adjust;
    try {
      const r = await api.patch(`/admin/products/${product.id}/stock`, { variationId: v._id, mode, quantity: Number(qty), note: mode === 'add' ? 'Stock added by admin' : 'Stock set by admin' });
      const nv = r.product.variations.find((x) => x._id === v._id);
      setF((cur) => ({ ...cur, variations: cur.variations.map((x) => (x._id === v._id ? { ...x, stockQuantity: nv.stockQuantity } : x)) }));
      toast.success('Stock updated'); setAdjust(null); onSaved(false);
    } catch (ex) { toast.error(ex.message); }
  };

  return (
    <Modal open={open} onClose={onClose} size="xl" title={edit ? `Edit Product – ${product.name}` : 'Add Product'} dismissible={!busy}
      footer={<><button className="btn-outline" onClick={onClose} disabled={busy}>Cancel</button><button className="btn-primary" onClick={submit} disabled={busy || uploading}>{busy && <Spinner className="h-4 w-4" />}{edit ? 'Save changes' : 'Create product'}</button></>}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <Field label="Product Name" error={err.name}>{({ id }) => <TextInput id={id} value={f.name} error={err.name} onChange={set('name')} maxLength={120} />}</Field>
          <Field label="Description">{({ id }) => <textarea id={id} className="input min-h-24" value={f.description} onChange={set('description')} maxLength={2000} />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category"><Select value={f.category} onChange={set('category')}><option value="women">Women</option><option value="men">Men</option><option value="kids">Kids</option></Select></Field>
            <Field label="Status"><Select value={f.status} onChange={set('status')}><option value="active">Active</option><option value="inactive">Inactive</option></Select></Field>
            <Field label="Price (Rs.)" error={err.price}>{({ id }) => <TextInput id={id} type="number" min="0" step="0.01" value={f.price} error={err.price} onChange={set('price')} />}</Field>
            <Field label="Sale Price (optional)" error={err.salePrice}>{({ id }) => <TextInput id={id} type="number" min="0" step="0.01" value={f.salePrice} error={err.salePrice} onChange={set('salePrice')} />}</Field>
          </div>
        </div>
        <div>
          <p className="label">Images <span className="font-normal text-muted">({f.images.length}/5 · JPG, PNG, WEBP · max 5 MB)</span></p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-3 xl:grid-cols-5">
            {f.images.map((src, i) => (
              <div key={src} className="group relative aspect-[4/5] overflow-hidden rounded-lg border border-line"><ProductImage src={src} alt="" className="h-full w-full" />
                {i === 0 && <span className="absolute left-1 top-1 rounded bg-charcoal px-1.5 py-0.5 text-[9px] font-bold text-gold">MAIN</span>}
                <button type="button" onClick={() => setF({ ...f, images: f.images.filter((x) => x !== src) })} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100" aria-label="Remove image"><X className="h-3 w-3" /></button></div>))}
            {f.images.length < 5 && <button type="button" onClick={() => file.current?.click()} disabled={uploading} className="flex aspect-[4/5] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line text-xs text-muted hover:border-gold hover:text-gold-dark">{uploading ? <Spinner /> : <ImagePlus className="h-5 w-5" />}{uploading ? 'Uploading' : 'Add'}</button>}
          </div>
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={upload} />
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-line p-4">
        <h3 className="mb-3 font-bold">Variations</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div><p className="label">Sizes</p><div className="flex flex-wrap gap-1.5">{SIZE_PRESETS.map((s) => <button key={s} type="button" aria-pressed={sizes.includes(s)} onClick={() => toggleSize(s)} className={cx('rounded-md border px-2.5 py-1 text-xs font-semibold', sizes.includes(s) ? 'border-inverse bg-inverse text-on-inverse' : 'border-line hover:border-gold')}>{s}</button>)}
            {sizes.filter((s) => !SIZE_PRESETS.includes(s)).map((s) => <button key={s} type="button" onClick={() => toggleSize(s)} className="rounded-md border border-inverse bg-inverse px-2.5 py-1 text-xs font-semibold text-on-inverse">{s} ×</button>)}</div>
            <div className="mt-2 flex gap-2"><input className="input !py-1.5" placeholder="Custom size" value={customSize} onChange={(e) => setCustomSize(e.target.value)} maxLength={20} aria-label="Custom size" /><button type="button" className="btn-outline btn-sm" onClick={() => { if (customSize.trim()) { setSizes([...new Set([...sizes, customSize.trim()])]); setCustomSize(''); } }}>Add</button></div></div>
          <div><p className="label">Colors</p><div className="mb-2 flex flex-wrap gap-1.5">{colors.map((c) => <button key={c.name} type="button" onClick={() => setColors(colors.filter((x) => x.name !== c.name))} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-semibold hover:border-red-300"><span className="h-3 w-3 rounded-full border border-line" style={{ background: c.hex }} />{c.name} ×</button>)}</div>
            <div className="flex gap-2"><input type="color" value={cHex} onChange={(e) => setCHex(e.target.value)} className="h-9 w-10 cursor-pointer rounded border border-line bg-surface p-0.5" aria-label="Color swatch" /><input className="input !py-1.5" placeholder="Color name (e.g. Navy)" value={cName} onChange={(e) => setCName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addColor())} maxLength={30} aria-label="Color name" /><button type="button" className="btn-outline btn-sm" onClick={addColor}>Add</button></div></div>
        </div>
        <button type="button" className="btn-gold btn-sm mt-4" onClick={generate}><Plus className="h-3.5 w-3.5" /> Generate variations</button>
        {err.variations && <p className="mt-2 text-xs font-medium text-red-600">{err.variations}</p>}

        {f.variations.length > 0 && (
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-left text-xs text-muted"><th className="py-1.5 pr-2">Color</th><th className="pr-2">Size</th><th className="pr-2">Barcode</th><th className="pr-2">Stock</th><th /></tr></thead>
            <tbody className="divide-y divide-line">{f.variations.map((v, i) => (
              <tr key={v._id || `${v.color}-${v.size}`}>
                <td className="py-2 pr-2"><span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-full border border-line" style={{ background: v.colorHex || '#ddd' }} />{v.color}</span></td>
                <td className="pr-2 font-semibold">{v.size}</td>
                <td className="pr-2"><div className="flex gap-1"><input className="input !py-1.5 font-mono text-xs" value={v.barcode} onChange={(e) => upVar(i, { barcode: e.target.value })} placeholder="Auto-generated" aria-label={`Barcode ${v.color} ${v.size}`} /><button type="button" className="btn-ghost btn-sm !px-2" onClick={() => upVar(i, { barcode: genBarcode() })} aria-label="Generate barcode"><RefreshCw className="h-3.5 w-3.5" /></button></div></td>
                <td className="pr-2">{v._id ? (
                  <div className="flex items-center gap-2"><span className="w-8 font-semibold tabular-nums">{v.stockQuantity}</span><button type="button" className="btn-outline btn-sm" onClick={() => setAdjust({ v, mode: 'add', qty: '' })}>Adjust</button></div>
                ) : <input type="number" min="0" className="input !w-24 !py-1.5" value={v.stockQuantity} onChange={(e) => upVar(i, { stockQuantity: e.target.value })} aria-label={`Stock ${v.color} ${v.size}`} />}</td>
                <td className="text-right"><button type="button" className="rounded-md p-1.5 text-red-600 hover:bg-red-50" onClick={() => rmVar(i)} aria-label="Remove variation"><Trash2 className="h-4 w-4" /></button></td>
              </tr>))}</tbody></table></div>)}
      </div>

      <Modal open={Boolean(adjust)} onClose={() => setAdjust(null)} title="Adjust stock" size="sm" footer={<><button className="btn-outline" onClick={() => setAdjust(null)}>Cancel</button><button className="btn-primary" disabled={!adjust || adjust.qty === '' || Number(adjust.qty) < 0 || (adjust.mode === 'add' && Number(adjust.qty) < 1)} onClick={applyAdjust}>Apply</button></>}>
        {adjust && (<div className="space-y-3 text-sm"><p>{adjust.v.color} / {adjust.v.size} — current stock <b>{adjust.v.stockQuantity}</b></p>
          <Select value={adjust.mode} onChange={(e) => setAdjust({ ...adjust, mode: e.target.value })} aria-label="Adjustment type"><option value="add">Add new stock (+)</option><option value="set">Set exact quantity</option></Select>
          <input type="number" min="0" className="input" placeholder={adjust.mode === 'add' ? 'Quantity to add' : 'New quantity'} value={adjust.qty} onChange={(e) => setAdjust({ ...adjust, qty: e.target.value })} autoFocus />
          <p className="text-xs text-muted">Applied immediately and recorded in the inventory history.</p></div>)}
      </Modal>
    </Modal>
  );
}
