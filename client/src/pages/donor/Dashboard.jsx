import { Link } from 'react-router-dom';
import { CheckCircle2, ClipboardList, HandHeart, PackageCheck, Plus, Utensils } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../lib/hooks';
import { fmtNum, greeting } from '../../lib/format';
import DonationTable from '../../components/DonationTable';
import { EmptyState, ErrorState, PageHeader, Skeleton, StatCard } from '../../components/ui';

export default function DonorDashboard() {
  const { user } = useAuth();
  const stats = useFetch(() => api.get('/donor/stats').then((r) => r.data), []);
  const list = useFetch(() => api.get('/donations').then((r) => r.data.donations.slice(0, 6)), []);
  const s = stats.data;
  return (
    <>
      <PageHeader title={`${greeting()}, ${user.name.split(' ')[0]}`} subtitle={user.organization_name}
        action={<Link to="/donor/create-donation" className="btn-primary"><Plus className="h-4 w-4" />Create Donation</Link>} />
      {stats.error ? <ErrorState message={stats.error} onRetry={stats.reload} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.loading ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />) : (
            <>
              <StatCard icon={ClipboardList} label="Total donations" value={fmtNum(s.total)} tone="ink" />
              <StatCard icon={Utensils} label="Available" value={fmtNum(s.available)} />
              <StatCard icon={HandHeart} label="Claimed" value={fmtNum(s.claimed)} tone="amber" />
              <StatCard icon={PackageCheck} label="Picked up" value={fmtNum(s.picked_up)} tone="sky" hint={`${fmtNum(s.meals_donated)} meals donated`} />
            </>
          )}
        </div>
      )}
      <div className="mb-3 mt-10 flex items-center justify-between"><h2 className="text-xl font-bold">Recent donations</h2><Link to="/donor/donations" className="text-sm font-semibold text-brand-700">View all</Link></div>
      {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : list.loading ? <Skeleton className="h-48 rounded-2xl" />
        : !list.data.length ? <EmptyState icon={CheckCircle2} title="Post your first donation" text="Share surplus food and a nearby NGO can claim it within minutes." action={<Link to="/donor/create-donation" className="btn-primary">Create donation</Link>} />
        : <DonationTable rows={list.data} base="/donor/donations" party="ngo" canEdit />}
    </>
  );
}
