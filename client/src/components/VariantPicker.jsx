import { useMemo, useState } from 'react';
import { Minus, Plus, ShoppingBag } from 'lucide-react';
import { Qty, Spinner, Swatch } from './ui';
import { cx } from '../utils/format';

/** Color + size + quantity selection. `onSubmit(variation, qty)` may be async. */
export default function VariantPicker({ product, onSubmit, submitLabel = 'Add To Cart', compact = false }) {
  const colors = useMemo(() => [...new Map(product.variations.map((v) => [v.color, v.colorHex])).entries()].map(([name, hex]) => ({ name, hex })), [product]);
  const sizes = useMemo(() => [...new Set(product.variations.map((v) => v.size))], [product]);
  const firstAvail = product.variations.find((v) => v.stockQuantity > 0);
  const [color, setColor] = useState(firstAvail?.color || colors[0]?.name);
  const [size, setSize] = useState(firstAvail?.size || null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const variation = product.variations.find((v) => v.color === color && v.size === size);
  const stock = variation?.stockQuantity ?? 0;
  const colorHasStock = (c) => product.variations.some((v) => v.color === c && v.stockQuantity > 0);
  const sizeStock = (s) => product.variations.find((v) => v.color === color && v.size === s)?.stockQuantity || 0;

  const pickColor = (c) => {
    setColor(c); setQty(1); setError('');
    const cur = product.variations.find((v) => v.color === c && v.size === size);
    if (!cur || cur.stockQuantity < 1) setSize(product.variations.find((v) => v.color === c && v.stockQuantity > 0)?.size || null);
  };

  const submit = async () => {
    if (!variation) return setError('Please select a size and color');
    if (stock < 1) return setError('This variation is out of stock');
    setBusy(true); setError('');
    try { await onSubmit(variation, qty); setQty(1); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="label">Color: <span className="font-normal text-muted">{color}</span></p>
        <div className="flex flex-wrap gap-2.5">{colors.map((c) => <Swatch key={c.name} hex={c.hex} title={`${c.name}${colorHasStock(c.name) ? '' : ' (sold out)'}`} selected={color === c.name} disabled={!colorHasStock(c.name)} onClick={() => pickColor(c.name)} />)}</div>
      </div>
      <div>
        <p className="label">Size {size && <span className="font-normal text-muted">: {size}</span>}</p>
        <div className="flex flex-wrap gap-2">
          {sizes.map((s) => {
            const st = sizeStock(s); const exists = product.variations.some((v) => v.color === color && v.size === s);
            return (
              <button key={s} type="button" disabled={!exists || st < 1} onClick={() => { setSize(s); setQty(1); setError(''); }} aria-pressed={size === s}
                className={cx('h-10 min-w-11 rounded-lg border px-3 text-sm font-semibold transition', size === s ? 'border-inverse bg-inverse text-on-inverse' : 'border-line bg-surface hover:border-gold', (!exists || st < 1) && 'cursor-not-allowed opacity-40 line-through')}>{s}</button>
            );
          })}
        </div>
      </div>
      {variation && (
        <p className={cx('text-xs font-semibold', stock < 1 ? 'text-red-600' : stock <= 5 ? 'text-amber-600' : 'text-emerald-600')}>
          {stock < 1 ? 'Out of stock' : stock <= 5 ? `Only ${stock} left in stock` : `In stock (${stock} available)`}
        </p>
      )}
      <div className={cx('flex items-center gap-3', compact && 'flex-wrap')}>
        <Qty value={qty} max={Math.max(1, stock)} disabled={!variation || stock < 1} onChange={setQty} />
        <button className="btn-primary flex-1" onClick={submit} disabled={busy || !variation || stock < 1}>{busy ? <Spinner className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}{submitLabel}</button>
      </div>
      {error && <p className="text-sm font-medium text-red-600" role="alert">{error}</p>}
    </div>
  );
}
