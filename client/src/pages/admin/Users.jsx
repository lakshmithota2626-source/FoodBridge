import { useState } from 'react';
import { BadgeCheck, Search, UserX, UserCheck } from 'lucide-react';
import api, { errMsg } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useDebounced, useFetch } from '../../lib/hooks';
import { fmtDate } from '../../lib/format';
import { ConfirmModal, EmptyState, ErrorState, PageHeader, Skeleton, cn } from '../../components/ui';

export default function AdminUsers() {
  const toast = useToast();
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useFetch(() => api.get('/admin/users', { params: { role: role || undefined, q: dq || undefined } }).then((r) => r.data.users), [role, dq]);

  const toggle = async () => {
    setBusy(true);
    try { await api.put(`/admin/users/${target.id}/status`, { is_active: !target.is_active }); toast.success(target.is_active ? 'User deactivated' : 'User reactivated'); setTarget(null); reload(true); }
    catch (e) { toast.error(errMsg(e)); setTarget(null); }
    setBusy(false);
  };
  const verify = async (u) => {
    setBusy(true);
    try { await api.put(`/admin/users/${u.id}/verification`, { verification_status: u.verification_status === 'VERIFIED' ? 'UNVERIFIED' : 'VERIFIED' }); toast.success(u.verification_status === 'VERIFIED' ? 'Verification removed' : 'User verified'); reload(true); }
    catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  const Btn = ({ u }) => u.role === 'ADMIN' ? null : (
    <div className="flex flex-wrap gap-1"><button className="btn-ghost px-2.5 py-1.5 text-brand-700" disabled={busy} onClick={() => verify(u)}><BadgeCheck className="h-4 w-4" />{u.verification_status === 'VERIFIED' ? 'Unverify' : 'Verify'}</button><button className={cn('btn-ghost px-2.5 py-1.5', u.is_active ? 'text-red-600' : 'text-brand-700')} onClick={() => setTarget(u)}>
      {u.is_active ? <><UserX className="h-4 w-4" />Deactivate</> : <><UserCheck className="h-4 w-4" />Reactivate</>}
    </button></div>
  );
  return (
    <>
      <PageHeader title="Users" subtitle="Donors, NGOs and administrators" />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-ink-400" /><input className="input pl-9" placeholder="Search name, email or organization" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" /></div>
        <div className="flex gap-2">{[['', 'All'], ['DONOR', 'Donors'], ['NGO', 'NGOs'], ['ADMIN', 'Admins']].map(([v, l]) => <button key={v} onClick={() => setRole(v)} aria-pressed={role === v} className={cn('rounded-full border px-3 py-1.5 text-sm', role === v ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white')}>{l}</button>)}</div>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <Skeleton className="h-64 rounded-2xl" /> : !data.length ? <EmptyState title="No users found" /> : (
        <>
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink-100 bg-ink-50 text-ink-500"><tr>{['Organization / name', 'Email', 'Role', 'City', 'Joined', 'Status', ''].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-ink-100">{data.map((u) => (
                <tr key={u.id}><td className="px-4 py-3"><p className="font-semibold">{u.organization_name || u.name}</p>{u.organization_name && <p className="text-xs text-ink-500">{u.name}</p>}</td><td className="px-4 py-3">{u.email}</td><td className="px-4 py-3">{u.role}</td><td className="px-4 py-3">{u.city || '—'}</td><td className="px-4 py-3">{fmtDate(u.created_at)}</td>
                  <td className="px-4 py-3"><span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', u.is_active ? 'bg-brand-50 text-brand-800' : 'bg-red-50 text-red-700')}>{u.is_active ? 'Active' : 'Deactivated'}</span></td><td className="px-4 py-3"><Btn u={u} /></td></tr>
              ))}</tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">{data.map((u) => (
            <div key={u.id} className="card p-4"><div className="flex justify-between"><p className="font-semibold">{u.organization_name || u.name}</p><span className="text-xs font-semibold text-ink-500">{u.role}</span></div><p className="text-sm text-ink-500">{u.email}</p><p className="text-sm text-ink-500">{u.city || '—'} · joined {fmtDate(u.created_at)}</p><div className="mt-2"><Btn u={u} /></div></div>
          ))}</div>
        </>
      )}
      <ConfirmModal open={!!target} danger={target?.is_active} title={target?.is_active ? 'Deactivate this user?' : 'Reactivate this user?'} message={target?.is_active ? `${target?.email} will be signed out and unable to log in.` : `${target?.email} will be able to log in again.`}
        confirmText={target?.is_active ? 'Deactivate' : 'Reactivate'} loading={busy} onClose={() => setTarget(null)} onConfirm={toggle} />
    </>
  );
}
