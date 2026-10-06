import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Flag, Search, Utensils } from 'lucide-react';
import api, { errMsg } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useDebounced, useFetch } from '../../lib/hooks';
import { STATUSES, ago } from '../../lib/format';
import DonationTable from '../../components/DonationTable';
import { ConfirmModal, EmptyState, ErrorState, PageHeader, Skeleton, StatusBadge, cn } from '../../components/ui';

export function AdminDonations() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useFetch(() => api.get('/admin/donations', { params: { status: status || undefined, q: dq || undefined } }).then((r) => r.data.donations), [status, dq]);
  const remove = async () => {
    setBusy(true);
    try { await api.delete(`/donations/${target.id}`); toast.success('Post removed'); setTarget(null); reload(true); } catch (e) { toast.error(errMsg(e)); setTarget(null); }
    setBusy(false);
  };
  return (
    <>
      <PageHeader title="All donations" subtitle="Remove fake or invalid posts" />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-ink-400" /><input className="input pl-9" placeholder="Search food or donor" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" /></div>
        <div className="flex flex-wrap gap-2">{['', ...STATUSES].map((s) => <button key={s} onClick={() => setStatus(s)} aria-pressed={status === s} className={cn('rounded-full border px-3 py-1.5 text-sm', status === s ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white')}>{s ? s.replace('_', ' ') : 'All'}</button>)}</div>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <Skeleton className="h-64 rounded-2xl" /> : !data.length ? <EmptyState icon={Utensils} title="No donations found" />
        : <DonationTable rows={data} base="/admin/donations" party="donor" onDelete={setTarget} />}
      <ConfirmModal open={!!target} danger title="Remove this post?" message={`“${target?.food_name}” will be permanently deleted and the donor notified.`} confirmText="Remove post" loading={busy} onClose={() => setTarget(null)} onConfirm={remove} />
    </>
  );
}

export function AdminReports() {
  const toast = useToast();
  const [status, setStatus] = useState('OPEN');
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useFetch(() => api.get('/admin/reports', { params: { status: status || undefined } }).then((r) => r.data.reports), [status]);

  const setS = async (r, s) => {
    try { await api.put(`/admin/reports/${r.id}`, { status: s }); toast.success(s === 'RESOLVED' ? 'Report resolved' : 'Report dismissed'); reload(true); } catch (e) { toast.error(errMsg(e)); }
  };
  const removePost = async () => {
    setBusy(true);
    try { await api.delete(`/donations/${target.donation_id}`); toast.success('Post removed'); setTarget(null); reload(true); } catch (e) { toast.error(errMsg(e)); setTarget(null); }
    setBusy(false);
  };
  return (
    <>
      <PageHeader title="Reported posts" subtitle="Review what NGOs and donors have flagged" />
      <div className="mb-4 flex gap-2">{[['OPEN', 'Open'], ['RESOLVED', 'Resolved'], ['DISMISSED', 'Dismissed'], ['', 'All']].map(([v, l]) => <button key={l} onClick={() => setStatus(v)} aria-pressed={status === v} className={cn('rounded-full border px-3 py-1.5 text-sm', status === v ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white')}>{l}</button>)}</div>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <Skeleton className="h-48 rounded-2xl" /> : !data.length ? <EmptyState icon={Flag} title="Nothing to review" text="No reports in this view." />
        : (
          <ul className="space-y-3">{data.map((r) => (
            <li key={r.id} className="card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><Link to={`/admin/donations/${r.donation_id}`} className="font-bold text-ink-900 hover:text-brand-700">{r.food_name}</Link><p className="text-sm text-ink-500">by {r.donor_name} · <StatusBadge status={r.donation_status} /></p></div>
                <StatusBadge status={r.status} />
              </div>
              <p className="mt-3 text-sm">“{r.reason}”</p>
              <p className="mt-1 text-xs text-ink-400">Reported by {r.reporter_name} · {ago(r.created_at)}</p>
              {r.status === 'OPEN' && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="btn-danger" onClick={() => setTarget(r)}>Remove post</button>
                  <button className="btn-outline" onClick={() => setS(r, 'RESOLVED')}>Mark resolved</button>
                  <button className="btn-ghost" onClick={() => setS(r, 'DISMISSED')}>Dismiss</button>
                </div>
              )}
            </li>
          ))}</ul>
        )}
      <ConfirmModal open={!!target} danger title="Remove the reported post?" message={`“${target?.food_name}” will be permanently deleted and the donor notified.`} confirmText="Remove post" loading={busy} onClose={() => setTarget(null)} onConfirm={removePost} />
    </>
  );
}
