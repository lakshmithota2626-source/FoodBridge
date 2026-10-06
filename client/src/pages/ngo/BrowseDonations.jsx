import { useState } from 'react';
import { Link } from 'react-router-dom';
import { List, Map as MapIcon, Search, SlidersHorizontal } from 'lucide-react';
import api, { errMsg } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDebounced, useFetch } from '../../lib/hooks';
import { FOOD_TYPES, qty } from '../../lib/format';
import DonationCard from '../../components/DonationCard';
import { COLORS, MapView } from '../../components/MapView';
import { CardSkeletons, ConfirmModal, EmptyState, ErrorState, PageHeader, cn } from '../../components/ui';

const DEFAULTS = { q: '', food_type: '', city: '', max_distance: '', min_qty: '', pickup_by: '', status: 'AVAILABLE', sort: 'match' };

export default function BrowseDonations() {
  const { user } = useAuth();
  const toast = useToast();
  const [f, setF] = useState(DEFAULTS);
  const [view, setView] = useState('list');
  const [showFilters, setShowFilters] = useState(false);
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const df = useDebounced(f);
  const { data, loading, error, reload } = useFetch(() => {
    const params = Object.fromEntries(Object.entries(df).filter(([, v]) => v !== ''));
    if (params.pickup_by) params.pickup_by = new Date(params.pickup_by).toISOString();
    return api.get('/donations', { params }).then((r) => r.data.donations);
  }, [JSON.stringify(df)]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const claim = async () => {
    setBusy(true);
    try { await api.post(`/donations/${target.id}/claim`); toast.success('Donation claimed. Check “Claimed” for pickup details.'); setTarget(null); reload(true); }
    catch (e) { toast.error(errMsg(e)); setTarget(null); reload(true); }
    setBusy(false);
  };

  const markers = [
    ...(user.latitude != null ? [{ lat: user.latitude, lng: user.longitude, label: 'Your NGO', color: COLORS.ngo }] : []),
    ...(data || []).map((d) => ({ lat: d.latitude, lng: d.longitude, label: `${qty(d)} · ${d.food_name}`, color: COLORS.donation,
      action: <div className="mt-1 text-xs"><div>{d.distance_km} km · {d.match?.score}% match</div><Link to={`/ngo/donations/${d.id}`} className="font-semibold text-brand-700">View details</Link></div> })),
  ];

  return (
    <>
      <PageHeader title="Find food" subtitle="Donations near you, ranked by Smart Matching."
        action={<div className="flex rounded-xl border border-ink-200 bg-white p-1">{[['list', List, 'List'], ['map', MapIcon, 'Map']].map(([v, Icon, l]) => <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium', view === v ? 'bg-ink-900 text-white' : 'text-ink-600')}><Icon className="h-4 w-4" />{l}</button>)}</div>} />
      <div className="card mb-5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-ink-400" /><input className="input pl-9" placeholder="Search food, donor or description" value={f.q} onChange={set('q')} aria-label="Search" /></div>
          <select className="input sm:w-48" value={f.sort} onChange={set('sort')} aria-label="Sort by"><option value="match">Best match</option><option value="distance">Nearest</option><option value="expiry">Ending soonest</option><option value="quantity">Largest quantity</option><option value="newest">Newest</option></select>
          <button className="btn-outline" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}><SlidersHorizontal className="h-4 w-4" />Filters</button>
        </div>
        {showFilters && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div><label className="label">Food type</label><select className="input" value={f.food_type} onChange={set('food_type')}><option value="">Any</option>{FOOD_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div><label className="label">City</label><input className="input" value={f.city} onChange={set('city')} placeholder="Any city" /></div>
            <div><label className="label">Within (km)</label><input className="input" type="number" min="1" value={f.max_distance} onChange={set('max_distance')} placeholder="Any distance" /></div>
            <div><label className="label">Minimum quantity</label><input className="input" type="number" min="1" value={f.min_qty} onChange={set('min_qty')} /></div>
            <div><label className="label">Can pick up by</label><input className="input" type="datetime-local" value={f.pickup_by} onChange={set('pickup_by')} /></div>
            <div><label className="label">Status</label><select className="input" value={f.status} onChange={set('status')}><option value="AVAILABLE">Available</option><option value="CLAIMED">Claimed by me</option><option value="PICKED_UP">Picked up by me</option><option value="">All visible</option></select></div>
            <button className="btn-ghost justify-self-start" onClick={() => setF(DEFAULTS)}>Reset filters</button>
          </div>
        )}
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <CardSkeletons n={6} />
        : !data.length ? <EmptyState icon={Search} title="No donations match" text="Try widening the distance or clearing some filters." action={<button className="btn-outline" onClick={() => setF(DEFAULTS)}>Reset filters</button>} />
        : view === 'map' ? <MapView markers={markers} height="520px" />
        : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.map((d) => <DonationCard key={d.id} d={d} to={`/ngo/donations/${d.id}`} onClaim={setTarget} />)}</div>}
      <ConfirmModal open={!!target} title="Claim this donation?" message="Are you sure you want to claim this donation? Other NGOs will no longer be able to claim it." confirmText="Yes, claim it" loading={busy} onClose={() => setTarget(null)} onConfirm={claim}>
        {target && <p className="mt-2 rounded-lg bg-ink-50 p-3 font-semibold text-ink-900">{qty(target)} · {target.food_name}</p>}
      </ConfirmModal>
    </>
  );
}
