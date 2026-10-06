import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, HandHeart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { errMsg } from '../api/client';
import { Field, Spinner, cn } from '../components/ui';
import { LocationPicker } from '../components/MapView';
import { FOOD_TYPES, ORG_TYPES, homePath } from '../lib/format';

const Shell = ({ title, subtitle, children }) => (
  <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
    <h1 className="text-3xl font-bold">{title}</h1>
    <p className="mt-1 text-ink-500">{subtitle}</p>
    <div className="card mt-6 p-5 sm:p-8">{children}</div>
  </div>
);

export function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [f, setF] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const u = await login(f.email, f.password);
      toast.success(`Welcome back, ${u.name.split(' ')[0]}!`);
      navigate(homePath(u.role));
    } catch (err) { setError(errMsg(err)); }
    setBusy(false);
  };
  const demo = (email) => setF({ email, password: 'Demo@1234' });

  return (
    <Shell title="Log in" subtitle="Pick up where you left off.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
        <Field label="Email"><input className="input" type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Password"><input className="input" type="password" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <button className="btn-primary w-full" disabled={busy || !f.email || !f.password}>{busy && <Spinner className="h-4 w-4" />}Log in</button>
      </form>
      <p className="mt-5 text-center text-sm text-ink-500">New here? <Link to="/register" className="font-semibold text-brand-700">Create an account</Link></p>
      {import.meta.env.DEV && (
        <div className="mt-6 rounded-xl bg-ink-50 p-4 text-sm">
          <p className="mb-2 font-semibold">Demo accounts (local only)</p>
          <div className="flex flex-wrap gap-2">
            {[['Donor', 'donor@foodbridge.demo'], ['NGO', 'ngo@foodbridge.demo'], ['Admin', 'admin@foodbridge.demo']].map(([l, e]) => <button key={e} type="button" className="btn-outline px-3 py-1.5" onClick={() => demo(e)}>{l}</button>)}
          </div>
        </div>
      )}
    </Shell>
  );
}

export function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [role, setRole] = useState(new URLSearchParams(window.location.search).get('role') === 'NGO' ? 'NGO' : 'DONOR');
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', organization_name: '', organization_type: 'Restaurant', description: '', address: '', city: '', latitude: '', longitude: '', preferred_food_types: [], capacity: 100 });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const validate = () => {
    const e = {};
    if (f.name.trim().length < 2) e.name = 'Enter your name';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Enter a valid email';
    if (f.phone.trim().length < 7) e.phone = 'Enter a valid phone number';
    if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) e.password = 'At least 8 characters, with a letter and a number';
    if (f.organization_name.trim().length < 2) e.organization_name = 'Enter the organization name';
    if (f.address.trim().length < 5) e.address = 'Enter the full address';
    if (f.city.trim().length < 2) e.city = 'Enter the city';
    if (f.latitude === '' || f.longitude === '') e.location = 'Drop a pin on the map so NGOs and donors can find you';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return toast.error('Please fix the highlighted fields');
    setBusy(true);
    try {
      const payload = { ...f, role, contact_person: f.name };
      if (role === 'DONOR') { delete payload.preferred_food_types; delete payload.capacity; } else delete payload.organization_type;
      const u = await register(payload);
      toast.success('Account created. Welcome to FoodBridge!');
      navigate(homePath(u.role));
    } catch (err) { toast.error(errMsg(err)); }
    setBusy(false);
  };

  const toggleType = (t) => setF({ ...f, preferred_food_types: f.preferred_food_types.includes(t) ? f.preferred_food_types.filter((x) => x !== t) : [...f.preferred_food_types, t] });

  return (
    <Shell title="Join FoodBridge" subtitle="Create a free account in a minute.">
      <div className="mb-6 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Account type">
        {[['DONOR', 'I have surplus food', Building2], ['NGO', 'We collect food', HandHeart]].map(([r, l, Icon]) => (
          <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => setRole(r)}
            className={cn('flex items-center gap-3 rounded-xl border-2 p-4 text-left transition', role === r ? 'border-brand-600 bg-brand-50' : 'border-ink-100 hover:border-ink-300')}>
            <Icon className={cn('h-6 w-6', role === r ? 'text-brand-700' : 'text-ink-400')} /><span className="text-sm font-semibold">{l}</span>
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name" error={errors.name}><input className="input" value={f.name} onChange={set('name')} autoComplete="name" /></Field>
          <Field label={role === 'DONOR' ? 'Business / organization name' : 'NGO name'} error={errors.organization_name}><input className="input" value={f.organization_name} onChange={set('organization_name')} /></Field>
          <Field label="Email" error={errors.email}><input className="input" type="email" value={f.email} onChange={set('email')} autoComplete="email" /></Field>
          <Field label="Phone" error={errors.phone}><input className="input" type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" /></Field>
          <Field label="Password" error={errors.password} hint="At least 8 characters, with a letter and a number"><input className="input" type="password" value={f.password} onChange={set('password')} autoComplete="new-password" /></Field>
          {role === 'DONOR' && <Field label="Type of organization"><select className="input" value={f.organization_type} onChange={set('organization_type')}>{ORG_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>}
          {role === 'NGO' && <Field label="Servings you can collect per pickup" hint="Used by Smart Matching"><input className="input" type="number" min="1" value={f.capacity} onChange={set('capacity')} /></Field>}
        </div>
        <Field label="About (optional)"><textarea className="input" rows="2" value={f.description} onChange={set('description')} placeholder={role === 'DONOR' ? 'What kind of food do you usually have left over?' : 'Who do you feed?'} /></Field>
        {role === 'NGO' && (
          <Field label="Food types you can use" hint="Leave empty to accept anything">
            <div className="flex flex-wrap gap-2">{FOOD_TYPES.map((t) => <button type="button" key={t} aria-pressed={f.preferred_food_types.includes(t)} onClick={() => toggleType(t)} className={cn('rounded-full border px-3 py-1.5 text-sm', f.preferred_food_types.includes(t) ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-white')}>{t}</button>)}</div>
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Address" error={errors.address} className="sm:col-span-2"><input className="input" value={f.address} onChange={set('address')} autoComplete="street-address" /></Field>
          <Field label="City" error={errors.city}><input className="input" value={f.city} onChange={set('city')} /></Field>
        </div>
        <Field label="Location on map" error={errors.location}>
          <LocationPicker lat={f.latitude} lng={f.longitude} searchHint={`${f.address} ${f.city}`} onChange={(a, b) => setF((s) => ({ ...s, latitude: a, longitude: b }))} />
        </Field>
        <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Create account</button>
      </form>
      <p className="mt-5 text-center text-sm text-ink-500">Already registered? <Link to="/login" className="font-semibold text-brand-700">Log in</Link></p>
    </Shell>
  );
}
