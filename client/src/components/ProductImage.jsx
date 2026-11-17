import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { imgUrl, cx } from '../utils/format';

export default function ProductImage({ src, alt, className }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) return <div className={cx('flex items-center justify-center bg-surface2 text-muted', className)}><ImageOff className="h-8 w-8 opacity-50" /></div>;
  return <img src={imgUrl(src)} alt={alt} loading="lazy" onError={() => setBad(true)} className={cx('object-cover', className)} />;
}
