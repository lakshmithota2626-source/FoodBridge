import { AlertTriangle, Apple, Beef, Carrot, Inbox, Loader2, Package, Salad, Soup, UtensilsCrossed, Wheat, X } from 'lucide-react';

export const cn = (...a) => a.filter(Boolean).join(' ');

const STATUS_STYLE = {
  AVAILABLE: 'bg-brand-50 text-brand-800 ring-brand-200',
  CLAIMED: 'bg-amber-50 text-amber-800 ring-amber-200',
  PICKED_UP: 'bg-sky-50 text-sky-800 ring-sky-200',
  EXPIRED: 'bg-ink-100 text-ink-600 ring-ink-200',
  CANCELLED: 'bg-red-50 text-red-700 ring-red-200',
  OPEN: 'bg-amber-50 text-amber-800 ring-amber-200',
  RESOLVED: 'bg-brand-50 text-brand-800 ring-brand-200',
  DISMISSED: 'bg-ink-100 text-ink-600 ring-ink-200',
};
export const StatusBadge = ({ status }) => (
  <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', STATUS_STYLE[status] || STATUS_STYLE.EXPIRED)}>
    {String(status).replace('_', ' ')}
  </span>
);

export const Spinner = ({ className = 'h-5 w-5' }) => <Loader2 className={cn('animate-spin', className)} aria-label="Loading" />;

export const Skeleton = ({ className = 'h-4 w-full' }) => <div className={cn('animate-pulse rounded-lg bg-ink-100', className)} />;
export const CardSkeletons = ({ n = 3 }) => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {Array.from({ length: n }).map((_, i) => (
      <div key={i} className="card overflow-hidden"><Skeleton className="h-40 rounded-none" /><div className="space-y-3 p-4"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-9 w-full" /></div></div>
    ))}
  </div>
);

export function StatCard({ icon: Icon, label, value, hint, tone = 'brand' }) {
  const tones = { brand: 'bg-brand-50 text-brand-700', amber: 'bg-amber-50 text-amber-700', sky: 'bg-sky-50 text-sky-700', ink: 'bg-ink-100 text-ink-700', red: 'bg-red-50 text-red-700' };
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-xl', tones[tone])}>{Icon && <Icon className="h-6 w-6" />}</div>
      <div className="min-w-0">
        <p className="truncate text-sm text-ink-500">{label}</p>
        <p className="font-display text-2xl font-bold text-ink-900">{value}</p>
        {hint && <p className="text-xs text-ink-400">{hint}</p>}
      </div>
    </div>
  );
}

export const PageHeader = ({ title, subtitle, action }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div><h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>{subtitle && <p className="mt-1 text-ink-500">{subtitle}</p>}</div>
    {action}
  </div>
);

export const EmptyState = ({ icon: Icon = Inbox, title, text, action }) => (
  <div className="card flex flex-col items-center px-6 py-14 text-center">
    <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-ink-100"><Icon className="h-7 w-7 text-ink-400" /></div>
    <h3 className="text-lg font-semibold">{title}</h3>
    {text && <p className="mt-1 max-w-md text-sm text-ink-500">{text}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const ErrorState = ({ message, onRetry }) => (
  <div className="card flex flex-col items-center px-6 py-12 text-center" role="alert">
    <AlertTriangle className="mb-3 h-9 w-9 text-red-500" />
    <h3 className="text-lg font-semibold">We couldn’t load this</h3>
    <p className="mt-1 text-sm text-ink-500">{message}</p>
    {onRetry && <button className="btn-outline mt-5" onClick={() => onRetry()}>Try again</button>}
  </div>
);

export function Modal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink-900/50" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-ink-400 hover:text-ink-700"><X className="h-5 w-5" /></button>
        <h2 className="pr-8 text-xl font-bold">{title}</h2>
        <div className="mt-3 text-sm text-ink-600">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}

export const ConfirmModal = ({ open, title, message, confirmText = 'Confirm', danger, loading, onConfirm, onClose, children }) => (
  <Modal open={open} title={title} onClose={onClose}
    footer={<>
      <button className="btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
      <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={loading}>{loading && <Spinner className="h-4 w-4" />}{confirmText}</button>
    </>}>
    <p>{message}</p>{children}
  </Modal>
);

export const Field = ({ label, error, hint, children, className }) => (
  <div className={className}>
    {label && <label className="label">{label}</label>}
    {children}
    {hint && !error && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    {error && <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>}
  </div>
);

const ART = {
  Vegetarian: [Salad, 'bg-brand-100 text-brand-700'], 'Non-Vegetarian': [Beef, 'bg-red-100 text-red-700'], Bread: [Wheat, 'bg-amber-100 text-amber-700'],
  Fruits: [Apple, 'bg-rose-100 text-rose-700'], Vegetables: [Carrot, 'bg-orange-100 text-orange-700'], 'Packaged Food': [Package, 'bg-sky-100 text-sky-700'],
  Meals: [Soup, 'bg-yellow-100 text-yellow-700'], Other: [UtensilsCrossed, 'bg-ink-100 text-ink-600'],
};
/** Photo if we have one, otherwise a tinted illustration for the food type. */
export function FoodImage({ src, type, className = 'h-40' }) {
  if (src) return <img src={src} alt="" loading="lazy" className={cn('w-full object-cover', className)} />;
  const [Icon, tone] = ART[type] || ART.Other;
  return <div className={cn('grid w-full place-items-center', tone, className)}><Icon className="h-12 w-12 opacity-80" /></div>;
}

export const MatchBadge = ({ match }) => match && (
  <div className="flex items-center gap-2">
    <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', match.score >= 80 ? 'bg-brand-600 text-white' : match.score >= 60 ? 'bg-amber-100 text-amber-800' : 'bg-ink-100 text-ink-600')}>{match.score}% match</span>
    {match.recommended && <span className="text-xs font-semibold text-brand-700">★ Recommended</span>}
  </div>
);
