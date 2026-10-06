import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Clock, History, MapPin, PackageCheck, Phone } from 'lucide-react';
import api, { errMsg } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../lib/hooks';
import { fmtDateTime, qty, timeLeft } from '../../lib/format';
import { COLORS, MapView } from '../../components/MapView';
import { ConfirmModal, EmptyState, ErrorState, FoodImage, PageHeader, Skeleton, StatusBadge } from '../../components/ui';

function ClaimRow({ c, onPickup }) {
  return (
    <article className="card flex flex-col overflow-hidden sm:flex-row">
      <FoodImage src={c.image_url} type={c.food_type} className="h-40 sm:h-auto sm:w-48 sm:shrink-0" />
      <div className="flex-1 space-y-2 p-4">
        <div className="flex items-start justify-between gap-2"><div><h3 className="text-lg font-bold">{qty(c)} · {c.food_name}</h3><p className="text-sm text-ink-500">from {c.donor_name}</p></div><StatusBadge status={c.status} /></div>
        <ul className="space-y-1 text-sm text-ink-600">
          <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-ink-400" />{c.pickup_address}, {c.city}</li>
          <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-ink-400" />{fmtDateTime(c.pickup_start)} – {fmtDateTime(c.pickup_end)}{c.status === 'CLAIMED' && <span className="text-amber-700">({timeLeft(c.pickup_end)})</span>}</li>
          {c.donor_phone && <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-ink-400" /><a className="text-brand-700" href={`tel:${c.donor_phone}`}>{c.donor_phone}</a></li>}
          {c.pickup_at && <li className="flex items-center gap-2"><Check className="h-4 w-4 text-brand-600" />Picked up {fmtDateTime(c.pickup_at)}</li>}
        </ul>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link to={`/ngo/donations/${c.donation_id}`} className="btn-outline">View details</Link>
          {onPickup && <button className="btn-primary" onClick={() => onPickup(c)}><Check className="h-4 w-4" />Mark as picked up</button>}
        </div>
      </div>
    </article>
  );
}

export function NgoClaimed() {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => api.get('/claims', { params: { status: 'CLAIMED' } }).then((r) => r.data.claims), []);
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const pick = async () => {
    setBusy(true);
    try { await api.post(`/claims/${target.id}/verify-pickup`, { code: code.trim() }); toast.success('Pickup verified. Thank you!'); setCode(''); setTarget(null); reload(true); }
    catch (e) { toast.error(errMsg(e)); setTarget(null); reload(true); }
    setBusy(false);
  };
  const markers = (data || []).map((c) => ({ lat: c.latitude, lng: c.longitude, label: c.food_name, color: COLORS.donation }));
  return (
    <>
      <PageHeader title="Claimed donations" subtitle="Collect these during their pickup windows." />
      {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <Skeleton className="h-48 rounded-2xl" />
        : !data.length ? <EmptyState icon={PackageCheck} title="Nothing to collect" text="Claim a donation and its pickup details will appear here." action={<Link to="/ngo/donations" className="btn-primary">Find food</Link>} />
        : <div className="space-y-4">{markers.length > 0 && <MapView markers={markers} height="260px" />}{data.map((c) => <ClaimRow key={c.id} c={c} onPickup={setTarget} />)}</div>}
      <ConfirmModal open={!!target} title="Verify pickup" message={`Ask the donor for the one-time QR pickup code for “${target?.food_name}”, then enter it below.`} confirmText="Verify pickup" loading={busy || code.trim().length < 20} onClose={() => { setTarget(null); setCode(''); }} onConfirm={pick}>
        <label className="label mt-3" htmlFor="claim-pickup-code">Pickup code</label><input id="claim-pickup-code" className="input mt-1 font-mono" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
      </ConfirmModal>
    </>
  );
}

export function NgoHistory() {
  const { data, loading, error, reload } = useFetch(() => api.get('/claims', { params: { status: 'PICKED_UP' } }).then((r) => r.data.claims), []);
  return (
    <>
      <PageHeader title="Pickup history" subtitle={data ? `${data.length} completed pickups` : ' '} />
      {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <Skeleton className="h-48 rounded-2xl" />
        : !data.length ? <EmptyState icon={History} title="No completed pickups yet" text="Once you mark a claimed donation as picked up, it will be listed here." />
        : <div className="space-y-4">{data.map((c) => <ClaimRow key={c.id} c={c} />)}</div>}
    </>
  );
}
