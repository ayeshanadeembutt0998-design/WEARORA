import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import ProductImage from './ProductImage';
import VariantPicker from './VariantPicker';
import { Badge, Modal } from './ui';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { money, CATEGORY_LABEL } from '../utils/format';

export default function ProductCard({ product: p }) {
  const { add } = useCart(); const toast = useToast();
  const [open, setOpen] = useState(false);
  const soldOut = p.totalStock < 1;
  const submit = async (v, q) => { await add(p.id, v._id, q); toast.success(`${p.name} added to cart`); setOpen(false); };
  return (
    <article className="group card flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link to={`/products/${p.id}`} className="relative block aspect-[4/5] overflow-hidden bg-surface2" aria-label={p.name}>
        <ProductImage src={p.images[0]} alt={p.name} className="h-full w-full transition duration-500 group-hover:scale-105" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          {p.isNew && <Badge tone="gold" className="bg-charcoal !text-gold !border-charcoal">New</Badge>}
          {p.onSale && <Badge tone="red">Sale</Badge>}
        </div>
        {soldOut && <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-sm font-bold tracking-wide text-white">SOLD OUT</div>}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gold-dark">{CATEGORY_LABEL[p.category]}</p>
        <Link to={`/products/${p.id}`} className="mt-0.5 line-clamp-1 font-heading text-base font-bold hover:text-gold-dark">{p.name}</Link>
        <div className="mt-1 flex items-baseline gap-2"><span className="font-bold">{money(p.effectivePrice)}</span>{p.onSale && <span className="text-xs text-muted line-through">{money(p.price)}</span>}</div>
        <div className="mt-4 grid grid-cols-2 gap-2 pt-1">
          <Link to={`/products/${p.id}`} className="btn-outline btn-sm">View</Link>
          <button className="btn-primary btn-sm" disabled={soldOut} onClick={() => setOpen(true)}><ShoppingBag className="h-3.5 w-3.5" /> Add</button>
        </div>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={p.name} size="sm"><VariantPicker product={p} onSubmit={submit} compact /></Modal>
    </article>
  );
}
