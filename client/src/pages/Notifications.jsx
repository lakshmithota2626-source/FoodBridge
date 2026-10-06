import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import api, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useFetch } from '../lib/hooks';
import { ago } from '../lib/format';
import { EmptyState, ErrorState, PageHeader, Skeleton, cn } from '../components/ui';

export default function Notifications() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => api.get('/notifications').then((r) => r.data), []);
  const refreshBell = () => window.dispatchEvent(new Event('fb:notifications'));
  const base = `/${user.role.toLowerCase()}/donations`;

  const read = async (n) => {
    if (n.is_read) return;
    try { await api.put(`/notifications/${n.id}/read`); await reload(true); refreshBell(); } catch (e) { toast.error(errMsg(e)); }
  };
  const readAll = async () => {
    try { await api.put('/notifications/read-all'); await reload(true); refreshBell(); } catch (e) { toast.error(errMsg(e)); }
  };

  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <>
      <PageHeader title="Notifications" subtitle={data ? `${data.unread_count} unread` : ' '}
        action={data?.unread_count > 0 && <button className="btn-outline" onClick={readAll}><CheckCheck className="h-4 w-4" />Mark all as read</button>} />
      {loading ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
        : !data.notifications.length ? <EmptyState icon={Bell} title="You’re all caught up" text="Claims, pickups and reminders will show up here." />
        : (
          <ul className="space-y-3">
            {data.notifications.map((n) => (
              <li key={n.id} className={cn('card flex items-start gap-3 p-4', !n.is_read && 'border-brand-200 bg-brand-50/50')}>
                <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', n.is_read ? 'bg-ink-200' : 'bg-brand-600')} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink-900">{n.title}</p>
                  <p className="text-sm text-ink-600">{n.message}</p>
                  <p className="mt-1 text-xs text-ink-400">{ago(n.created_at)}</p>
                  <div className="mt-2 flex gap-3 text-sm font-semibold">
                    {n.donation_id && user.role !== 'ADMIN' && <Link to={`${base}/${n.donation_id}`} className="text-brand-700" onClick={() => read(n)}>View donation</Link>}
                    {!n.is_read && <button className="text-ink-500 hover:text-ink-800" onClick={() => read(n)}>Mark as read</button>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
    </>
  );
}
