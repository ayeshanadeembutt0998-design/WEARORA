import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, PackageX } from 'lucide-react';
import ProductImage from '../../components/ProductImage';
import VariantPicker from '../../components/VariantPicker';
import { Badge, EmptyState, ErrorState, PageLoader } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { api } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { CATEGORY_LABEL, cx, money } from '../../utils/format';

export default function ProductDetails() {
  const { id } = useParams(); const { add } = useCart(); const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => api.get(`/products/${id}`).catch((e) => { if (e.status === 404) return { notFound: true }; throw e; }), [id]);
  const [img, setImg] = useState(0);
  useEffect(() => setImg(0), [id]);
  if (loading) return <PageLoader />;
  if (error) return <div className="mx-auto max-w-3xl p-6"><ErrorState message={error} onRetry={reload} /></div>;
  if (data.notFound) return <div className="mx-auto max-w-3xl p-6"><EmptyState icon={PackageX} title="Product not available" text="This product may have been removed." action={<Link to="/products" className="btn-primary">Back to Products</Link>} /></div>;
  const p = data.product; const imgs = p.images.length ? p.images : [''];
  const go = (d) => setImg((i) => (i + d + imgs.length) % imgs.length);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="mb-6 text-sm text-muted" aria-label="Breadcrumb"><Link to="/products" className="hover:text-gold-dark">Products</Link> / <span className="text-ink">{p.name}</span></nav>
      <div className="grid gap-10 md:grid-cols-2">
        <div className="order-2 md:order-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold-dark">{CATEGORY_LABEL[p.category]}</p>
          <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">{p.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-2xl font-bold">{money(p.effectivePrice)}</span>
            {p.onSale && <><span className="text-lg text-muted line-through">{money(p.price)}</span><Badge tone="red">Sale</Badge></>}
            {p.isNew && <Badge tone="gold">New</Badge>}
          </div>
          <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-muted">{p.description || 'No description available.'}</p>
          <div className="my-6 h-px bg-line" />
          {p.totalStock < 1 ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">This product is currently out of stock.</p>
            : <VariantPicker product={p} onSubmit={async (v, q) => { await add(p.id, v._id, q); toast.success('Added to cart'); }} />}
        </div>
        <div className="order-1 md:order-2">
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-line bg-surface2">
            <ProductImage src={imgs[img]} alt={p.name} className="h-full w-full" />
            {imgs.length > 1 && (<>
              <button onClick={() => go(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-surface/90 p-2 shadow hover:bg-surface" aria-label="Previous image"><ChevronLeft className="h-5 w-5" /></button>
              <button onClick={() => go(1)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-surface/90 p-2 shadow hover:bg-surface" aria-label="Next image"><ChevronRight className="h-5 w-5" /></button>
            </>)}
          </div>
          {imgs.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto">{imgs.map((s, i) => <button key={s} onClick={() => setImg(i)} className={cx('h-16 w-14 shrink-0 overflow-hidden rounded-lg border-2', i === img ? 'border-gold' : 'border-transparent opacity-70 hover:opacity-100')} aria-label={`Image ${i + 1}`}><ProductImage src={s} alt="" className="h-full w-full" /></button>)}</div>}
        </div>
      </div>
    </div>
  );
}
