import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HandHeart, MapPin, PackageCheck, Soup, Sparkles } from 'lucide-react';
import api, { errMsg } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../lib/hooks';
import { fmtNum } from '../../lib/format';
import DonationCard from '../../components/DonationCard';
import { CardSkeletons, ConfirmModal, EmptyState, ErrorState, PageHeader, Skeleton, StatCard } from '../../components/ui';

export default function NgoDashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const stats = useFetch(() => api.get('/ngo/stats').then((r) => r.data), []);
  const recs = useFetch(() => api.get('/ngo/recommendations').then((r) => r.data.donations), []);
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const s = stats.data;

  const claim = async () => {
    setBusy(true);
    try { await api.post(`/donations/${target.id}/claim`); toast.success('Donation claimed. Check “Claimed” for pickup details.'); setTarget(null); stats.reload(true); recs.reload(true); }
    catch (e) { toast.error(errMsg(e)); setTarget(null); recs.reload(true); }
    setBusy(false);
  };

  return (
    <>
      <PageHeader title={`Welcome, ${user.organization_name || user.name}`} subtitle="Here’s what’s available around you." />
      {stats.error ? <ErrorState message={stats.error} onRetry={stats.reload} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.loading ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />) : (
            <>
              <StatCard icon={MapPin} label="Available nearby" value={fmtNum(s.available_nearby)} hint="within 10 km" />
              <StatCard icon={HandHeart} label="Claimed" value={fmtNum(s.claimed)} tone="amber" />
              <StatCard icon={PackageCheck} label="Picked up" value={fmtNum(s.picked_up)} tone="sky" />
              <StatCard icon={Soup} label="Meals rescued" value={fmtNum(s.meals_rescued)} />
            </>
          )}
        </div>
      )}
      <div className="mb-4 mt-10 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-bold"><Sparkles className="h-5 w-5 text-brand-600" />Recommended donations near you</h2>
        <Link to="/ngo/donations" className="text-sm font-semibold text-brand-700">Browse all</Link>
      </div>
      {recs.error ? <ErrorState message={recs.error} onRetry={recs.reload} /> : recs.loading ? <CardSkeletons />
        : !recs.data.length ? <EmptyState icon={MapPin} title="No donations available right now" text="New food is posted throughout the day. We’ll notify you when something is claimable." action={<Link to="/ngo/donations" className="btn-outline">Open the full list</Link>} />
        : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{recs.data.map((d) => <DonationCard key={d.id} d={d} to={`/ngo/donations/${d.id}`} onClaim={setTarget} />)}</div>}
      <ConfirmModal open={!!target} title="Claim this donation?" message="Are you sure you want to claim this donation? Other NGOs will no longer be able to claim it." confirmText="Yes, claim it" loading={busy} onClose={() => setTarget(null)} onConfirm={claim} />
    </>
  );
}
