import { forwardRef, useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ChevronLeft, ChevronRight, Eye, EyeOff, Loader2, PackageOpen, RefreshCw, X } from 'lucide-react';
import { cx, STATUS_LABEL, PAY_STATUS_LABEL } from '../../utils/format';

export const Spinner = ({ className = 'h-5 w-5' }) => <Loader2 className={cx('animate-spin', className)} aria-label="Loading" />;

export const PageLoader = ({ label = 'Loading…' }) => (
  <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted"><Spinner className="h-8 w-8 text-gold" /><span className="text-sm">{label}</span></div>
);

export const EmptyState = ({ icon: Icon = PackageOpen, title, text, action }) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center">
    <div className="mb-4 rounded-full bg-gold-soft p-4 dark:bg-gold/10"><Icon className="h-7 w-7 text-gold-dark" /></div>
    <h3 className="text-lg font-bold">{title}</h3>
    {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const ErrorState = ({ message, onRetry }) => (
  <div className="flex flex-col items-center rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center dark:border-red-900 dark:bg-red-950/40">
    <AlertTriangle className="mb-3 h-8 w-8 text-red-600" />
    <p className="text-sm font-medium text-red-800 dark:text-red-200">{message || 'Something went wrong'}</p>
    {onRetry && <button className="btn-outline btn-sm mt-4" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5" /> Try again</button>}
  </div>
);

/** Label + control + inline error. Pass a render-prop or a single input child. */
export function Field({ label, error, hint, children, className }) {
  const id = useId();
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="label">{label}</label>}
      {typeof children === 'function' ? children({ id, invalid: Boolean(error) }) : children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-red-600" role="alert">{error}</p>}
    </div>
  );
}

export const TextInput = forwardRef(function TextInput({ icon: Icon, error, className, ...p }, ref) {
  return (
    <div className="relative">
      {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />}
      <input ref={ref} {...p} className={cx('input', Icon && 'pl-10', error && 'input-error', className)} aria-invalid={Boolean(error)} />
    </div>
  );
});

export function PasswordInput({ icon: Icon, error, className, ...p }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />}
      <input {...p} type={show ? 'text' : 'password'} className={cx('input pr-10', Icon && 'pl-10', error && 'input-error', className)} aria-invalid={Boolean(error)} />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export const Select = ({ className, children, error, ...p }) => (
  <select {...p} className={cx('input appearance-none bg-[length:16px] pr-9', error && 'input-error', className)}
    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2377716A' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
    {children}
  </select>
);

const TONES = {
  gray: 'bg-surface2 text-muted border-line',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900',
  amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900',
  red: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900',
  blue: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-900',
  gold: 'bg-gold-soft text-gold-dark border-gold/40 dark:bg-gold/10 dark:text-gold',
  purple: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-900',
};
export const Badge = ({ tone = 'gray', children, className }) => (
  <span className={cx('inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', TONES[tone], className)}>{children}</span>
);
const ORDER_TONE = { pending: 'amber', confirmed: 'blue', processing: 'purple', ready_for_pickup: 'gold', shipped: 'blue', delivered: 'green', completed: 'green', cancelled: 'red' };
const PAY_TONE = { pending: 'amber', paid: 'green', failed: 'red', refunded: 'gray', partially_refunded: 'amber' };
export const OrderStatusBadge = ({ status }) => <Badge tone={ORDER_TONE[status] || 'gray'}>{STATUS_LABEL[status] || status}</Badge>;
export const PayStatusBadge = ({ status }) => <Badge tone={PAY_TONE[status] || 'gray'}>{PAY_STATUS_LABEL[status] || status}</Badge>;

function useLockBody(open) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);
}
function useEsc(open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
}

export function Modal({ open, onClose, title, children, footer, size = 'md', dismissible = true }) {
  useLockBody(open); useEsc(open, dismissible ? onClose : undefined);
  if (!open) return null;
  const w = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={dismissible ? onClose : undefined} />
      <div className={cx('relative flex max-h-[92vh] w-full animate-pop flex-col rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl', w)}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          {dismissible && <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface2 hover:text-ink" aria-label="Close"><X className="h-5 w-5" /></button>}
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>, document.body);
}

export function Drawer({ open, onClose, title, children, width = 'max-w-xl' }) {
  useLockBody(open); useEsc(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className={cx('absolute right-0 top-0 flex h-full w-full animate-slideIn flex-col border-l border-line bg-surface shadow-2xl', width)}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface2 hover:text-ink" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>, document.body);
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, loading, onConfirm, onClose }) {
  return (
    <Modal open={open} onClose={loading ? undefined : onClose} title={title} size="sm"
      footer={<><button className="btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={loading}>{loading && <Spinner className="h-4 w-4" />}{confirmLabel}</button></>}>
      <p className="text-sm text-muted">{message}</p>
    </Modal>
  );
}

export function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  const nums = []; const add = (n) => nums.push(n);
  for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - page) <= 1) add(i); else if (nums[nums.length - 1] !== '…') add('…');
  return (
    <nav className="mt-8 flex items-center justify-center gap-1" aria-label="Pagination">
      <button className="btn-outline btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
      {nums.map((n, i) => n === '…' ? <span key={`e${i}`} className="px-2 text-muted">…</span> : (
        <button key={n} onClick={() => onChange(n)} aria-current={n === page ? 'page' : undefined}
          className={cx('h-8 min-w-8 rounded-lg px-2 text-xs font-semibold transition', n === page ? 'bg-inverse text-on-inverse' : 'text-muted hover:bg-surface2')}>{n}</button>
      ))}
      <button className="btn-outline btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
    </nav>
  );
}

export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div><h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>{subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}</div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const ProductCardSkeleton = () => (
  <div className="card overflow-hidden"><div className="skeleton aspect-[4/5] rounded-none" /><div className="space-y-2 p-4"><div className="skeleton h-4 w-3/4" /><div className="skeleton h-4 w-1/3" /><div className="skeleton h-9 w-full" /></div></div>
);
export const TableSkeleton = ({ rows = 6, cols = 5 }) => (
  <div className="divide-y divide-line">{Array.from({ length: rows }).map((_, r) => (
    <div key={r} className="flex gap-4 px-4 py-4">{Array.from({ length: cols }).map((__, c) => <div key={c} className="skeleton h-4 flex-1" />)}</div>
  ))}</div>
);

export const Qty = ({ value, min = 1, max = 99, onChange, disabled, size = 'md' }) => (
  <div className={cx('inline-flex items-center rounded-lg border border-line bg-surface', size === 'sm' && 'text-xs')}>
    <button type="button" className="px-2.5 py-1.5 text-muted hover:text-ink disabled:opacity-40" disabled={disabled || value <= min} onClick={() => onChange(value - 1)} aria-label="Decrease quantity">−</button>
    <span className="min-w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">{value}</span>
    <button type="button" className="px-2.5 py-1.5 text-muted hover:text-ink disabled:opacity-40" disabled={disabled || value >= max} onClick={() => onChange(value + 1)} aria-label="Increase quantity">+</button>
  </div>
);

export const Swatch = ({ hex, selected, disabled, title, onClick }) => (
  <button type="button" title={title} onClick={onClick} disabled={disabled} aria-pressed={selected}
    className={cx('relative h-8 w-8 rounded-full border transition', selected ? 'ring-2 ring-gold ring-offset-2 ring-offset-surface' : 'hover:scale-105', disabled && 'opacity-40')}
    style={{ background: hex || '#ddd', borderColor: 'rgb(var(--line))' }}>
    {disabled && <span className="absolute inset-0 flex items-center justify-center text-xs text-red-600">╱</span>}
  </button>
);

export const Stat = ({ icon: Icon, label, value, tone = 'gold' }) => (
  <div className="card flex items-center gap-4 p-4"><div className="rounded-lg bg-gold-soft p-3 dark:bg-gold/10"><Icon className="h-5 w-5 text-gold-dark" /></div><div><p className="text-xs text-muted">{label}</p><p className="text-xl font-bold">{value}</p></div></div>
);
