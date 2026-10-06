import api from '../../api/client';
import { useFetch } from '../../lib/hooks';
import { fmtNum } from '../../lib/format';
import Charts from '../../components/Charts';
import { ErrorState, PageHeader, Skeleton, StatCard } from '../../components/ui';
import { CheckCircle2, Clock, Soup, XCircle } from 'lucide-react';

export default function AdminAnalytics() {
  const { data, loading, error, reload } = useFetch(() => api.get('/admin/analytics').then((r) => r.data), []);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) return <Skeleton className="h-96 rounded-2xl" />;
  const t = data.totals;
  const rate = t.total_donations ? Math.round((t.picked_up / t.total_donations) * 100) : 0;
  const waste = t.total_donations ? Math.round((t.expired / t.total_donations) * 100) : 0;
  return (
    <>
      <PageHeader title="Analytics" subtitle="Calculated live from the database" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CheckCircle2} label="Rescue rate" value={`${rate}%`} hint="donations picked up" />
        <StatCard icon={XCircle} label="Expired unclaimed" value={`${waste}%`} tone="red" hint={`${fmtNum(t.expired)} donations`} />
        <StatCard icon={Soup} label="Meals rescued" value={fmtNum(t.meals_rescued)} tone="sky" />
        <StatCard icon={Clock} label="Active now" value={fmtNum(t.active_donations)} tone="amber" />
      </div>
      <Charts charts={data.charts} />
    </>
  );
}
