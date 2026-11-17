import { useState } from 'react';
import { cx } from '../../utils/format';

/** Uses the official logo image when present (public/images/wearora-logo.png); falls back to a wordmark. */
export default function Logo({ className = 'h-9', tagline = false, light = false }) {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return <img src="/images/wearora-logo.png" alt="Wearora – Style Your Everyday." className={cx('w-auto object-contain', className)} onError={() => setFailed(true)} />;
  }
  return (
    <span className="inline-flex flex-col leading-none">
      <span className={cx('font-heading text-xl font-extrabold tracking-[0.22em]', light ? 'text-white' : 'text-ink')}>WEARORA</span>
      {tagline && <span className="mt-1 text-[9px] tracking-[0.18em] text-gold">Style Your Everyday.</span>}
    </span>
  );
}
