import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Clock, Flag, MapPin, Pencil, Phone, Star, Trash2, XCircle } from 'lucide-react';
import api, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useFetch } from '../lib/hooks';
import { fmtDateTime, qty } from '../lib/format';
import { COLORS, MapView } from '../components/MapView';
import { ConfirmModal, ErrorState, FoodImage, MatchBadge, Modal, Skeleton, Spinner, StatusBadge, cn } from '../components/ui';

function Timeline({ d }) {
  const steps = [['Donation created', d.created_at, true], ['Claimed', d.claimed_at, Boolean(d.claimed_at)], ['Picked up', d.picked_up_at, Boolean(d.picked_up_at)]];
  const dead = ['EXPIRED', 'CANCELLED'].includes(d.status);
  return (
    <ol className="space-y-0">
      {steps.map(([label, at, done], i) => (
        <li key={label} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className={cn('grid h-6 w-6 place-items-center rounded-full', done ? 'bg-brand-600 text-white' : 'border-2 border-ink-200 bg-white')}>{done && <Check className="h-3.5 w-3.5" />}</span>
            {i < steps.length - 1 && <span className={cn('h-8 w-0.5', steps[i + 1][2] ? 'bg-brand-600' : 'bg-ink-200')} />}
          </div>
          <div className="pb-6"><p className={cn('text-sm font-semibold', !done && 'text-ink-400')}>{label}</p>{at && <p className="text-xs text-ink-500">{fmtDateTime(at)}</p>}</div>
        </li>
      ))}
      {dead && <li className="text-sm font-semibold text-red-600">This donation was {d.status.toLowerCase()}.</li>}
    </ol>
  );
}

function ReviewBox({ d }) {
  const toast = useToast();
  const { data, reload } = useFetch(() => api.get(`/reviews/${d.id}`).then((r) => r.data.review), [d.id]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  if (data) return (
    <div className="card p-5"><h3 className="font-bold">Your review</h3>
      <p className="mt-2 flex text-amber-500">{Array.from({ length: data.rating }).map((_, i) => <Star key={i} className="h-5 w-5 fill-current" />)}</p>
      {data.comment && <p className="mt-2 text-sm text-ink-600">{data.comment}</p>}</div>
  );
  const submit = async () => {
    setBusy(true);
    try { await api.post('/reviews', { donation_id: d.id, rating, comment }); toast.success('Thanks for your review'); reload(); } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  return (
    <div className="card p-5">
      <h3 className="font-bold">How was the pickup with {d.ngo_name}?</h3>
      <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => <button key={n} role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(n)}><Star className={cn('h-7 w-7', n <= rating ? 'fill-amber-400 text-amber-400' : 'text-ink-300')} /></button>)}
      </div>
      <textarea className="input mt-3" rows="2" placeholder="Optional comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
      <button className="btn-primary mt-3" onClick={submit} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Submit review</button>
    </div>
  );
}

function PickupCode({ donationId }) {
  const { data, loading, error } = useFetch(() => api.get(`/donations/${donationId}/pickup-code`).then((r) => r.data), [donationId]);
  if (loading) return <div className="card p-5"><Skeleton className="h-40 w-40" /></div>;
  if (error) return <div className="card p-5 text-sm text-ink-600">Pickup code unavailable: {error}</div>;
  return <div className="card p-5 text-center">
    <h2 className="text-lg font-bold">Pickup verification QR</h2>
    <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">Show this only to the collecting NGO. They scan or enter the code to confirm handover.</p>
    <div className="mt-4 inline-block rounded-xl bg-white p-3 shadow-sm"><QRCodeSVG value={data.code} size={180} level="M" includeMargin /></div>
    <p className="mt-3 break-all rounded-lg bg-ink-50 p-2 font-mono text-xs text-ink-700">{data.code}</p>
    <p className="mt-2 text-xs text-ink-500">Valid until {fmtDateTime(data.expires_at)}. One use only.</p>
  </div>;
}

export default function DonationDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useFetch(() => api.get(`/donations/${id}`).then((r) => r.data), [id]);
  const [modal, setModal] = useState(null); // claim | pickup | cancel | remove | report
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [pickupCode, setPickupCode] = useState('');
  const role = user.role;
  const back = `/${role.toLowerCase()}/${role === 'ADMIN' ? 'donations' : 'donations'}`;

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) return <div className="space-y-4"><Skeleton className="h-72 rounded-2xl" /><Skeleton className="h-8 w-1/2" /><Skeleton className="h-40" /></div>;
  const d = data.donation;
  const mine = d.ngo_id === user.id;

  const act = async (fn, okMsg, after) => {
    setBusy(true);
    try { await fn(); toast.success(okMsg); setModal(null); window.dispatchEvent(new Event('fb:notifications')); after ? after() : reload(true); } catch (e) { toast.error(errMsg(e)); setModal(null); reload(true); }
    setBusy(false);
  };

  const markers = [{ lat: d.latitude, lng: d.longitude, label: `${d.food_name} — pickup`, color: COLORS.donation }];
  if (role === 'NGO' && user.latitude != null) markers.push({ lat: user.latitude, lng: user.longitude, label: 'Your NGO', color: COLORS.ngo });

  return (
    <div>
      <Link to={back} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-ink-900"><ArrowLeft className="h-4 w-4" />Back</Link>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <div className="card overflow-hidden">
            <FoodImage src={d.image_url} type={d.food_type} className="h-64 sm:h-80" />
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h1 className="text-2xl font-bold sm:text-3xl">{qty(d)} · {d.food_name}</h1><p className="text-ink-500">{d.food_type} · posted by {d.donor_name}</p></div>
                <StatusBadge status={d.status} />
              </div>
              {d.description && <p className="mt-4 text-ink-700">{d.description}</p>}
              <dl className="mt-5 grid gap-4 sm:grid-cols-2 text-sm">
                <div><dt className="text-ink-500">Pickup window</dt><dd className="font-semibold">{fmtDateTime(d.pickup_start)} – {fmtDateTime(d.pickup_end)}</dd></div>
                <div><dt className="text-ink-500">Consume before</dt><dd className="font-semibold">{fmtDateTime(d.consume_before)}</dd></div>
                <div className="sm:col-span-2"><dt className="text-ink-500">Pickup location</dt><dd className="font-semibold">{d.pickup_address}, {d.city}</dd></div>
                {d.distance_km != null && <div><dt className="text-ink-500">Distance</dt><dd className="font-semibold">{d.distance_km} km away</dd></div>}
                {d.donor_phone && <div><dt className="text-ink-500">Donor contact</dt><dd className="font-semibold"><a href={`tel:${d.donor_phone}`} className="inline-flex items-center gap-1 text-brand-700"><Phone className="h-4 w-4" />{d.donor_phone}</a></dd></div>}
              </dl>
            </div>
          </div>

          <div><h2 className="mb-3 text-lg font-bold">Location</h2><MapView markers={markers} height="300px" /></div>

          {role === 'NGO' && d.match && (
            <div className="card p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">Why this match score?</h2><MatchBadge match={d.match} /></div>
              <p className="mt-1 text-sm text-ink-500">A rule-based score — not machine learning. Each rule is shown below.</p>
              <div className="mt-4 space-y-3">
                {Object.entries(d.match.breakdown).map(([k, v]) => (
                  <div key={k}>
                    <div className="flex justify-between text-sm"><span className="font-medium">{{ distance: 'Distance', foodType: 'Food type', quantity: 'Quantity', time: 'Pickup time' }[k]} <span className="text-ink-400">({v.weight}%)</span></span><span>{v.score}%</span></div>
                    <div className="mt-1 h-2 rounded-full bg-ink-100"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${v.score}%` }} /></div>
                    <p className="mt-0.5 text-xs text-ink-500">{v.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="card p-5">
            <h2 className="mb-4 text-lg font-bold">Status</h2>
            <Timeline d={d} />
            {d.ngo_name && <div className="mt-2 rounded-xl bg-ink-50 p-3 text-sm"><p className="text-ink-500">Claimed by</p><p className="font-semibold">{d.ngo_name}</p>{d.ngo_phone && <a href={`tel:${d.ngo_phone}`} className="mt-1 inline-flex items-center gap-1 text-brand-700"><Phone className="h-4 w-4" />{d.ngo_phone}</a>}</div>}
          </div>

          <div className="card space-y-3 p-5">
            <h2 className="text-lg font-bold">Actions</h2>
            {role === 'NGO' && d.status === 'AVAILABLE' && <button className="btn-primary w-full" onClick={() => setModal('claim')}>Claim donation</button>}
            {role === 'NGO' && d.status === 'CLAIMED' && mine && (
              <>
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><Clock className="mt-0.5 h-4 w-4 shrink-0" />Collect between {fmtDateTime(d.pickup_start)} and {fmtDateTime(d.pickup_end)} at {d.pickup_address}.</div>
                <button className="btn-primary w-full" onClick={() => setModal('pickup')}><Check className="h-4 w-4" />Mark as picked up</button>
              </>
            )}
            {role === 'DONOR' && d.status === 'AVAILABLE' && (
              <>
                <Link to={`/donor/donations/${d.id}/edit`} className="btn-outline w-full"><Pencil className="h-4 w-4" />Edit donation</Link>
                <button className="btn-outline w-full text-red-600" onClick={() => setModal('cancel')}><XCircle className="h-4 w-4" />Cancel donation</button>
              </>
            )}
            {role === 'ADMIN' && <button className="btn-danger w-full" onClick={() => setModal('remove')}><Trash2 className="h-4 w-4" />Remove post</button>}
            {role !== 'ADMIN' && role !== 'DONOR' && <button className="btn-ghost w-full" onClick={() => setModal('report')}><Flag className="h-4 w-4" />Report this post</button>}
            {!['NGO', 'DONOR', 'ADMIN'].includes(role) && null}
            {((role === 'NGO' && d.status !== 'AVAILABLE' && !(d.status === 'CLAIMED' && mine)) || (role === 'DONOR' && d.status !== 'AVAILABLE')) && <p className="text-sm text-ink-500">No actions available for a {d.status.toLowerCase().replace('_', ' ')} donation.</p>}
          </div>

          {role === 'DONOR' && d.status === 'CLAIMED' && <PickupCode donationId={d.id} />}
          {role === 'DONOR' && d.status === 'PICKED_UP' && <ReviewBox d={d} />}
          {role === 'ADMIN' && data.reports?.length > 0 && (
            <div className="card p-5"><h2 className="mb-3 text-lg font-bold">Reports ({data.reports.length})</h2>
              <ul className="space-y-3 text-sm">{data.reports.map((r) => <li key={r.id}><p>{r.reason}</p><p className="text-xs text-ink-400">by {r.reporter} · <StatusBadge status={r.status} /></p></li>)}</ul></div>
          )}
        </aside>
      </div>

      <ConfirmModal open={modal === 'claim'} title="Claim this donation?" message="Are you sure you want to claim this donation? Other NGOs will no longer be able to claim it, and the donor will be notified." confirmText="Yes, claim it" loading={busy} onClose={() => setModal(null)}
        onConfirm={() => act(() => api.post(`/donations/${d.id}/claim`), 'Donation claimed. Please collect it during the pickup window.')} />
      <Modal open={modal === 'pickup'} title="Verify pickup" onClose={() => setModal(null)} footer={<><button className="btn-outline" onClick={() => setModal(null)}>Cancel</button><button className="btn-primary" disabled={busy || pickupCode.trim().length < 20} onClick={() => act(() => api.post(`/claims/${d.claim_id}/verify-pickup`, { code: pickupCode.trim() }), 'Pickup verified. Thank you!', () => { setPickupCode(''); reload(true); })}>Verify pickup</button></>}>
        <p className="mb-3 text-sm text-ink-600">Ask the donor to show their one-time pickup QR code, then scan it with your device or enter the code below.</p>
        <label className="label" htmlFor="pickup-code">Pickup code</label><input id="pickup-code" className="input font-mono" value={pickupCode} onChange={(e) => setPickupCode(e.target.value)} autoComplete="off" />
      </Modal>
      <ConfirmModal open={modal === 'cancel'} danger title="Cancel this donation?" message="It will no longer be visible to NGOs. This can’t be undone." confirmText="Cancel donation" loading={busy} onClose={() => setModal(null)}
        onConfirm={() => act(() => api.delete(`/donations/${d.id}`), 'Donation cancelled')} />
      <ConfirmModal open={modal === 'remove'} danger title="Remove this post?" message="The post will be permanently deleted and the donor will be notified." confirmText="Remove post" loading={busy} onClose={() => setModal(null)}
        onConfirm={() => act(() => api.delete(`/donations/${d.id}`), 'Post removed', () => navigate('/admin/donations'))} />
      <Modal open={modal === 'report'} title="Report this post" onClose={() => setModal(null)}
        footer={<><button className="btn-outline" onClick={() => setModal(null)}>Cancel</button><button className="btn-primary" disabled={busy || reason.trim().length < 10}
          onClick={() => act(() => api.post('/reports', { donation_id: d.id, reason }), 'Report sent to the admins', () => { setReason(''); reload(true); })}>Send report</button></>}>
        <p className="mb-2">What’s wrong with this post? (fake, unsafe, wrong details…)</p>
        <textarea className="input" rows="3" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      </Modal>
    </div>
  );
}
