import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, Search, SearchX, X } from 'lucide-react';
import ProductCard from '../../components/ProductCard';
import { EmptyState, ErrorState, Pagination, ProductCardSkeleton, Select } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { useDebounce } from '../../hooks/useDebounce';
import { api, qs } from '../../services/api';

export default function Products() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || ''; const sort = params.get('sort') || ''; const page = Number(params.get('page')) || 1; const urlQ = params.get('q') || '';
  const [search, setSearch] = useState(urlQ); const debounced = useDebounce(search);
  const [showFilters, setShowFilters] = useState(false);

  const update = (patch) => { const n = new URLSearchParams(params); Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); if (!('page' in patch)) n.delete('page'); setParams(n, { replace: true }); };
  useEffect(() => { if (debounced !== urlQ) update({ q: debounced }); }, [debounced]); // eslint-disable-line
  useEffect(() => { setSearch(urlQ); }, [urlQ]);

  const { data, loading, error, reload } = useAsync(() => api.get(`/products${qs({ q: urlQ, category, sort, page, limit: 12 })}`), [urlQ, category, sort, page]);
  const clear = () => { setSearch(''); setParams({}, { replace: true }); };
  const hasFilters = urlQ || category || sort;

  const filters = (
    <div className="space-y-5">
      <div><label className="label" htmlFor="f-search">Search Title</label>
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input id="f-search" className="input pl-9" placeholder="Search products" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
      <div><label className="label" htmlFor="f-cat">Category</label>
        <Select id="f-cat" value={category} onChange={(e) => update({ category: e.target.value })}><option value="">All</option><option value="women">Women</option><option value="men">Men</option><option value="kids">Kids</option></Select></div>
      <div><label className="label" htmlFor="f-price">Price</label>
        <Select id="f-price" value={sort} onChange={(e) => update({ sort: e.target.value })}><option value="">Latest</option><option value="price_asc">Low to High</option><option value="price_desc">High to Low</option></Select></div>
      <button className="btn-primary w-full" onClick={clear} disabled={!hasFilters}>Clear Filter</button>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-5 flex items-center justify-between lg:hidden">
        <h1 className="text-2xl font-extrabold">Products</h1>
        <button className="btn-outline btn-sm" onClick={() => setShowFilters(true)}><Filter className="h-4 w-4" /> Filters{hasFilters ? ' •' : ''}</button>
      </div>
      <div className="grid gap-8 lg:grid-cols-[250px_1fr]">
        <aside className="hidden lg:block"><div className="card sticky top-24 p-5"><h2 className="mb-4 text-lg font-bold">Filters</h2>{filters}</div></aside>
        {showFilters && (
          <div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-black/50" onClick={() => setShowFilters(false)} />
            <div className="absolute inset-x-0 bottom-0 animate-pop rounded-t-2xl bg-surface p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">Filters</h2><button onClick={() => setShowFilters(false)} aria-label="Close"><X className="h-5 w-5" /></button></div>{filters}<button className="btn-gold mt-4 w-full" onClick={() => setShowFilters(false)}>Show results</button></div></div>
        )}
        <section aria-live="polite">
          <h1 className="mb-5 hidden text-3xl font-extrabold lg:block">Products</h1>
          {error ? <ErrorState message={error} onRetry={reload} /> : loading ? (
            <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}</div>
          ) : data.products.length === 0 ? (
            <EmptyState icon={SearchX} title="No products found" text="Try a different search term or clear your filters." action={hasFilters && <button className="btn-primary" onClick={clear}>Clear Filter</button>} />
          ) : (
            <>
              <p className="mb-4 text-sm text-muted">{data.pagination.total} product{data.pagination.total === 1 ? '' : 's'}</p>
              <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">{data.products.map((p) => <ProductCard key={p.id} product={p} />)}</div>
              <Pagination page={data.pagination.page} pages={data.pagination.pages} onChange={(n) => { update({ page: n > 1 ? String(n) : '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
