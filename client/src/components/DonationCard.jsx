import { Link } from 'react-router-dom';
import { Clock, MapPin, Package } from 'lucide-react';
import { FoodImage, MatchBadge, StatusBadge } from './ui';
import { fmtTime, qty, timeLeft } from '../lib/format';

export default function DonationCard({ d, to, onClaim, claiming }) {
  return (
    <article className="card flex flex-col overflow-hidden transition hover:shadow-md">
      <Link to={to} className="block"><FoodImage src={d.image_url} type={d.food_type} className="h-40" /></Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold">{qty(d)} · {d.food_name}</h3>
            <p className="truncate text-sm text-ink-500">{d.food_type} · {d.donor_name}</p>
          </div>
          <StatusBadge status={d.status} />
        </div>
        <ul className="space-y-1 text-sm text-ink-600">
          {d.distance_km != null && <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-ink-400" />{d.distance_km} km away · {d.city}</li>}
          <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-ink-400" />Pickup before {fmtTime(d.pickup_end)} <span className="text-ink-400">({timeLeft(d.pickup_end)})</span></li>
          <li className="flex items-center gap-2"><Package className="h-4 w-4 text-ink-400" />{d.pickup_address}</li>
        </ul>
        {d.match && <MatchBadge match={d.match} />}
        <div className="mt-auto flex gap-2 pt-1">
          <Link to={to} className="btn-outline flex-1">View details</Link>
          {onClaim && d.status === 'AVAILABLE' && <button className="btn-primary flex-1" disabled={claiming} onClick={() => onClaim(d)}>Claim</button>}
        </div>
      </div>
    </article>
  );
}
