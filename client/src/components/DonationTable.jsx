import { Link } from 'react-router-dom';
import { Eye, Pencil, Trash2, XCircle } from 'lucide-react';
import { StatusBadge } from './ui';
import { fmtDateTime, qty } from '../lib/format';

/** One list, two layouts: table on desktop, cards on mobile. */
export default function DonationTable({ rows, base, party = 'ngo', onCancel, onDelete, canEdit }) {
  const partyLabel = party === 'donor' ? 'Donor' : 'NGO';
  const partyName = (d) => (party === 'donor' ? d.donor_name : d.ngo_name) || '—';
  const Actions = ({ d }) => (
    <div className="flex items-center gap-1">
      <Link to={`${base}/${d.id}`} className="btn-ghost px-2.5 py-1.5" title="View"><Eye className="h-4 w-4" /><span className="md:hidden">View</span></Link>
      {canEdit && d.status === 'AVAILABLE' && <Link to={`${base}/${d.id}/edit`} className="btn-ghost px-2.5 py-1.5" title="Edit"><Pencil className="h-4 w-4" /><span className="md:hidden">Edit</span></Link>}
      {onCancel && d.status === 'AVAILABLE' && <button className="btn-ghost px-2.5 py-1.5 text-red-600" onClick={() => onCancel(d)} title="Cancel"><XCircle className="h-4 w-4" /><span className="md:hidden">Cancel</span></button>}
      {onDelete && <button className="btn-ghost px-2.5 py-1.5 text-red-600" onClick={() => onDelete(d)} title="Remove"><Trash2 className="h-4 w-4" /><span className="md:hidden">Remove</span></button>}
    </div>
  );
  return (
    <>
      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-100 bg-ink-50 text-ink-500">
            <tr><th className="px-4 py-3 font-medium">Food</th><th className="px-4 py-3 font-medium">Quantity</th><th className="px-4 py-3 font-medium">Pickup</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">{partyLabel}</th><th className="px-4 py-3 font-medium">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((d) => (
              <tr key={d.id} className="hover:bg-ink-50/60">
                <td className="px-4 py-3"><p className="font-semibold text-ink-900">{d.food_name}</p><p className="text-xs text-ink-500">{d.food_type}</p></td>
                <td className="px-4 py-3">{qty(d)}</td>
                <td className="px-4 py-3 text-ink-600">{fmtDateTime(d.pickup_start)}<br /><span className="text-xs text-ink-400">to {fmtDateTime(d.pickup_end)}</span></td>
                <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                <td className="px-4 py-3">{partyName(d)}</td>
                <td className="px-4 py-3"><Actions d={d} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {rows.map((d) => (
          <div key={d.id} className="card p-4">
            <div className="flex items-start justify-between gap-2"><div><p className="font-semibold text-ink-900">{d.food_name}</p><p className="text-xs text-ink-500">{d.food_type} · {qty(d)}</p></div><StatusBadge status={d.status} /></div>
            <p className="mt-2 text-sm text-ink-600">Pickup {fmtDateTime(d.pickup_start)} – {fmtDateTime(d.pickup_end)}</p>
            <p className="text-sm text-ink-600">{partyLabel}: {partyName(d)}</p>
            <div className="mt-2 border-t border-ink-100 pt-2"><Actions d={d} /></div>
          </div>
        ))}
      </div>
    </>
  );
}
