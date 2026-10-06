import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api, { errMsg } from '../api/client';
import { Field, PageHeader, Spinner, cn } from '../components/ui';
import { LocationPicker } from '../components/MapView';
import { FOOD_TYPES, ORG_TYPES } from '../lib/format';

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setF({ name: user.name, phone: user.phone || '', organization_name: user.organization_name || '', organization_type: user.organization_type || 'Other', contact_person: user.contact_person || '',
      description: user.description || '', address: user.address || '', city: user.city || '', latitude: user.latitude, longitude: user.longitude,
      preferred_food_types: user.preferred_food_types || [], capacity: user.capacity || 100 });
  }, [user]);
  if (!f) return null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const isNgo = user.role === 'NGO';

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...f };
      if (!isNgo) { delete body.preferred_food_types; delete body.capacity; delete body.contact_person; } else delete body.organization_type;
      const { data } = await api.put('/auth/profile', body);
      setUser(data.user);
      toast.success('Profile saved');
    } catch (err) { toast.error(errMsg(err)); }
    setBusy(false);
  };
  const toggle = (t) => setF({ ...f, preferred_food_types: f.preferred_food_types.includes(t) ? f.preferred_food_types.filter((x) => x !== t) : [...f.preferred_food_types, t] });

  return (
    <>
      <PageHeader title="Profile" subtitle={user.email} />
      <form onSubmit={save} className="card max-w-3xl space-y-4 p-5 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name"><input className="input" value={f.name} onChange={set('name')} /></Field>
          <Field label="Phone"><input className="input" value={f.phone} onChange={set('phone')} /></Field>
          <Field label={isNgo ? 'NGO name' : 'Organization name'}><input className="input" value={f.organization_name} onChange={set('organization_name')} /></Field>
          {isNgo ? <Field label="Contact person"><input className="input" value={f.contact_person} onChange={set('contact_person')} /></Field>
            : <Field label="Organization type"><select className="input" value={f.organization_type} onChange={set('organization_type')}>{ORG_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>}
        </div>
        <Field label="About"><textarea className="input" rows="3" value={f.description} onChange={set('description')} /></Field>
        {isNgo && (
          <>
            <Field label="Servings you can collect per pickup" hint="Smart Matching uses this to score donation sizes"><input className="input max-w-xs" type="number" min="1" value={f.capacity} onChange={set('capacity')} /></Field>
            <Field label="Food types you can use" hint="Leave empty to accept anything">
              <div className="flex flex-wrap gap-2">{FOOD_TYPES.map((t) => <button type="button" key={t} aria-pressed={f.preferred_food_types.includes(t)} onClick={() => toggle(t)} className={cn('rounded-full border px-3 py-1.5 text-sm', f.preferred_food_types.includes(t) ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-white')}>{t}</button>)}</div>
            </Field>
          </>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Address" className="sm:col-span-2"><input className="input" value={f.address} onChange={set('address')} /></Field>
          <Field label="City"><input className="input" value={f.city} onChange={set('city')} /></Field>
        </div>
        <Field label="Location"><LocationPicker lat={f.latitude} lng={f.longitude} searchHint={`${f.address} ${f.city}`} onChange={(a, b) => setF((s) => ({ ...s, latitude: a, longitude: b }))} /></Field>
        <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save changes</button>
      </form>
    </>
  );
}
