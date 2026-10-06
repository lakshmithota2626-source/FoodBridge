import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, Plus, Search } from 'lucide-react';
import api, { errMsg } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useDebounced, useFetch } from '../../lib/hooks';
import { STATUSES } from '../../lib/format';
import DonationTable from '../../components/DonationTable';
import { ConfirmModal, EmptyState, ErrorState, PageHeader, Skeleton, cn } from '../../components/ui';

export function DonorDonations() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useFetch(() => api.get('/donations', { params: { status: status || undefined, q: dq || undefined } }).then((r) => r.data.donations), [status, dq]);

  const cancel = async () => {
    setBusy(true);
    try { await api.delete(`/donations/${target.id}`); toast.success('Donation cancelled'); setTarget(null); reload(true); } catch (e) { toast.error(errMsg(e)); setTarget(null); reload(true); }
    setBusy(false);
  };
  return (
    <>
      <PageHeader title="My donations" action={<Link to="/donor/create-donation" className="btn-primary"><Plus className="h-4 w-4" />Create Donation</Link>} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-ink-400" /><input className="input pl-9" placeholder="Search by food name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search donations" /></div>
        <div className="flex flex-wrap gap-2">{['', ...STATUSES].map((s) => <button key={s} onClick={() => setStatus(s)} aria-pressed={status === s} className={cn('rounded-full border px-3 py-1.5 text-sm', status === s ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white')}>{s ? s.replace('_', ' ') : 'All'}</button>)}</div>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <Skeleton className="h-64 rounded-2xl" />
        : !data.length ? <EmptyState icon={Inbox} title="No donations found" text="Try a different filter, or post a new donation." action={<Link to="/donor/create-donation" className="btn-primary">Create donation</Link>} />
        : <DonationTable rows={data} base="/donor/donations" party="ngo" canEdit onCancel={setTarget} />}
      <ConfirmModal open={!!target} danger title="Cancel this donation?" message={`“${target?.food_name}” will no longer be visible to NGOs.`} confirmText="Cancel donation" loading={busy} onClose={() => setTarget(null)} onConfirm={cancel} />
    </>
  );
}

export function DonorHistory() {
  const { data, loading, error, reload } = useFetch(() => api.get('/donations').then((r) => r.data.donations.filter((d) => ['PICKED_UP', 'EXPIRED', 'CANCELLED'].includes(d.status))), []);
  return (
    <>
      <PageHeader title="Donation history" subtitle="Completed, expired and cancelled donations" />
      {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <Skeleton className="h-64 rounded-2xl" />
        : !data.length ? <EmptyState icon={Inbox} title="No history yet" text="Finished donations will appear here." />
        : <DonationTable rows={data} base="/donor/donations" party="ngo" />}
    </>
  );
}
