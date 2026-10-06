import { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Search } from 'lucide-react';
import { Spinner } from './ui';
import { useToast } from '../context/ToastContext';

export const COLORS = { donation: '#0a9552', ngo: '#2563eb', donor: '#d97706', you: '#2563eb' };
const pin = (color) => L.divIcon({ className: '', html: `<span class="fb-pin" style="background:${color}"></span>`, iconSize: [22, 22], iconAnchor: [4, 22], popupAnchor: [7, -22] });

function Fit({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 15 });
    else if (points.length === 1) map.setView(points[0], 14);
  }, [map, JSON.stringify(points)]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** markers: [{ lat, lng, label, color, action }]  — action is an optional React node rendered in the popup */
export function MapView({ markers = [], height = '320px', className = '' }) {
  const valid = markers.filter((m) => m.lat != null && m.lng != null);
  const points = valid.map((m) => [m.lat, m.lng]);
  return (
    <div className={`overflow-hidden rounded-2xl border border-ink-100 ${className}`} style={{ height }}>
      <MapContainer center={points[0] || [20.59, 78.96]} zoom={points.length ? 13 : 4} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {valid.map((m, i) => (
          <Marker key={i} position={[m.lat, m.lng]} icon={pin(m.color || COLORS.donation)}>
            <Popup><div className="text-sm font-semibold">{m.label}</div>{m.action}</Popup>
          </Marker>
        ))}
        <Fit points={points} />
      </MapContainer>
    </div>
  );
}

function ClickCatcher({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}
function Recenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => { if (lat != null && lng != null) map.setView([lat, lng], Math.max(map.getZoom(), 14)); }, [lat, lng]); // eslint-disable-line
  return null;
}

/** Click the map, use GPS, or search an address (OpenStreetMap Nominatim) to choose coordinates. */
export function LocationPicker({ lat, lng, onChange, searchHint, height = '280px' }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const has = lat !== '' && lat != null && lng !== '' && lng != null;
  const set = (a, b) => onChange(Number(a.toFixed(6)), Number(b.toFixed(6)));

  const search = async () => {
    const query = (q || searchHint || '').trim();
    if (!query) return toast.info('Type a place or address to search');
    setBusy(true);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`);
      const j = await r.json();
      if (!j.length) toast.error('No match found. Try a nearby landmark or click the map.');
      else set(Number(j[0].lat), Number(j[0].lon));
    } catch { toast.error('Address search is unavailable. Click the map instead.'); }
    setBusy(false);
  };
  const gps = () => {
    if (!navigator.geolocation) return toast.error('Location is not supported on this device');
    navigator.geolocation.getCurrentPosition((p) => set(p.coords.latitude, p.coords.longitude), () => toast.error('Could not get your location. Click the map instead.'));
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        <input className="input min-w-0 flex-1" placeholder="Search address or landmark" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), search())} />
        <button type="button" className="btn-outline" onClick={search} disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}Search</button>
        <button type="button" className="btn-outline" onClick={gps}><Crosshair className="h-4 w-4" />Use my location</button>
      </div>
      <div className="overflow-hidden rounded-xl border border-ink-200" style={{ height }}>
        <MapContainer center={has ? [lat, lng] : [12.9716, 77.5946]} zoom={has ? 14 : 11} scrollWheelZoom={false} style={{ height: '100%' }}>
          <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ClickCatcher onPick={set} />
          {has && <><Marker position={[lat, lng]} icon={pin(COLORS.donation)} /><Recenter lat={lat} lng={lng} /></>}
        </MapContainer>
      </div>
      <p className="mt-1.5 text-xs text-ink-500">{has ? `Selected: ${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)} — click the map to adjust` : 'Click the map to drop a pin'}</p>
    </div>
  );
}
