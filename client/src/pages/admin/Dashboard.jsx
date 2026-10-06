import { Link } from 'react-router-dom';
import { Activity, Building2, HandHeart, ListChecks, Soup, Users, Utensils } from 'lucide-react';
import api from '../../api/client';
import { useFetch } from '../../lib/hooks';
import { ago, fmtNum } from '../../lib/format';
import Charts from '../../components/Charts';
import DonationTable from '../../components/DonationTable';
import { ErrorState, PageHeader, Skeleton, StatCard } from '../../components/ui';

export default function AdminDashboard() {
  const { data, loading, error, reload } = useFetch(() => api.get('/admin/analytics').then((r) => r.data), []);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) return <><PageHeader title="Admin dashboard" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div></>;
  const t = data.totals;
  const dot = { DONATED: 'bg-brand-600', CLAIMED: 'bg-amber-500', PICKED_UP: 'bg-sky-500' };
  return (
    <>
      <PageHeader title="Admin dashboard" subtitle="Live platform overview" action={t.open_reports > 0 && <Link to="/admin/reports" className="btn-outline text-amber-700">{t.open_reports} open report{t.open_reports > 1 ? 's' : ''}</Link>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Users} label="Total users" value={fmtNum(t.total_users)} tone="ink" />
        <StatCard icon={Building2} label="Donors" value={fmtNum(t.total_donors)} tone="amber" />
        <StatCard icon={HandHeart} label="NGOs" value={fmtNum(t.total_ngos)} tone="sky" />
        <StatCard icon={Utensils} label="Total donations" value={fmtNum(t.total_donations)} hint={`${t.available} available · ${t.claimed} claimed · ${t.picked_up} picked up · ${t.expired} expired`} />
        <StatCard icon={Soup} label="Meals rescued" value={fmtNum(t.meals_rescued)} />
        <StatCard icon={ListChecks} label="Active donations" value={fmtNum(t.active_donations)} hint={`${t.picked_up} completed pickups`} />
      </div>
      <div className="mt-8"><Charts charts={data.charts} /></div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div><h2 className="mb-3 text-xl font-bold">Recent donations</h2><DonationTable rows={data.recent_donations} base="/admin/donations" party="donor" /></div>
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-xl font-bold"><Activity className="h-5 w-5" />Activity</h2>
          <ul className="card divide-y divide-ink-100">
            {data.activity.map((a, i) => <li key={i} className="flex items-start gap-3 p-3.5 text-sm"><span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot[a.kind]}`} /><span className="flex-1">{a.text}</span><span className="shrink-0 text-xs text-ink-400">{ago(a.at)}</span></li>)}
            {!data.activity.length && <li className="p-4 text-sm text-ink-500">No activity yet.</li>}
          </ul>
          <h2 className="mb-3 mt-6 text-xl font-bold">New users</h2>
          <ul className="card divide-y divide-ink-100">
            {data.recent_users.map((u) => <li key={u.id} className="flex items-center justify-between p-3.5 text-sm"><span><b>{u.organization_name || u.name}</b><br /><span className="text-xs text-ink-500">{u.email}</span></span><span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-semibold">{u.role}</span></li>)}
          </ul>
        </div>
      </div>
    </>
  );
}
