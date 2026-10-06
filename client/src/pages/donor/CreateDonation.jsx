import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ImagePlus, X } from 'lucide-react';
import api, { errMsg } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { FOOD_TYPES, UNITS, inHours, toISO, toLocalInput } from '../../lib/format';
import { LocationPicker } from '../../components/MapView';
import { Field, PageHeader, Skeleton, Spinner } from '../../components/ui';

const Section = ({ title, children }) => <section className="card p-5 sm:p-6"><h2 className="mb-4 text-lg font-bold">{title}</h2><div className="space-y-4">{children}</div></section>;

export default function CreateDonation() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const fileRef = useRef();
  const [f, setF] = useState({ food_name: '', food_type: 'Vegetarian', description: '', quantity: '', unit: 'meals', pickup_address: user.address || '', city: user.city || '',
    latitude: user.latitude ?? '', longitude: user.longitude ?? '', pickup_start: inHours(0.5), pickup_end: inHours(4), consume_before: inHours(5) });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(editing);

  useEffect(() => {
    if (!editing) return;
    api.get(`/donations/${id}`).then(({ data }) => {
      const d = data.donation;
      if (d.status !== 'AVAILABLE') { toast.error('Only available donations can be edited'); return navigate(`/donor/donations/${id}`); }
      setF({ food_name: d.food_name, food_type: d.food_type, description: d.description || '', quantity: d.quantity, unit: d.unit, pickup_address: d.pickup_address, city: d.city,
        latitude: d.latitude, longitude: d.longitude, pickup_start: toLocalInput(d.pickup_start), pickup_end: toLocalInput(d.pickup_end), consume_before: toLocalInput(d.consume_before) });
      setPreview(d.image_url);
    }).catch((e) => { toast.error(errMsg(e)); navigate('/donor/donations'); }).finally(() => setLoading(false));
  }, [id]); // eslint-disable-line

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const pickFile = (e) => {
    const x = e.target.files[0];
    if (!x) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(x.type)) { setErrors((s) => ({ ...s, image: 'Use a JPG, PNG or WEBP image' })); return; }
    if (x.size > 5 * 1024 * 1024) { setErrors((s) => ({ ...s, image: 'Image must be 5 MB or smaller' })); return; }
    setErrors((s) => ({ ...s, image: undefined }));
    setFile(x); setPreview(URL.createObjectURL(x));
  };

  const validate = () => {
    const e = {};
    if (f.food_name.trim().length < 2) e.food_name = 'Enter what you’re donating';
    if (!(Number(f.quantity) > 0)) e.quantity = 'Quantity must be greater than 0';
    if (f.pickup_address.trim().length < 5) e.pickup_address = 'Enter the pickup address';
    if (!f.city.trim()) e.city = 'Enter the city';
    if (f.latitude === '' || f.longitude === '') e.location = 'Drop a pin so NGOs can find you';
    const s = new Date(f.pickup_start), en = new Date(f.pickup_end), cb = new Date(f.consume_before);
    if (!f.pickup_start || isNaN(s)) e.pickup_start = 'Choose a pickup start time';
    if (!f.pickup_end || isNaN(en)) e.pickup_end = 'Choose a pickup end time';
    else if (en <= s) e.pickup_end = 'Pickup end must be after pickup start';
    else if (en <= new Date()) e.pickup_end = 'Pickup end must be in the future';
    if (!f.consume_before || isNaN(cb)) e.consume_before = 'Choose a consume-before time';
    else if (cb < s) e.consume_before = 'Consume-before cannot be earlier than pickup start';
    setErrors((p) => ({ image: p.image, ...e }));
    return !Object.keys(e).length && !errors.image;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return toast.error('Please fix the highlighted fields');
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries({ ...f, pickup_start: toISO(f.pickup_start), pickup_end: toISO(f.pickup_end), consume_before: toISO(f.consume_before) }).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append('image', file);
      const { data } = editing ? await api.put(`/donations/${id}`, fd) : await api.post('/donations', fd);
      toast.success(editing ? 'Donation updated' : 'Donation published. Nearby NGOs can claim it now.');
      navigate(`/donor/donations/${data.donation.id}`);
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  if (loading) return <Skeleton className="h-96 rounded-2xl" />;
  return (
    <>
      <PageHeader title={editing ? 'Edit donation' : 'Create donation'} subtitle="Tell NGOs what you have and when they can collect it." />
      <form onSubmit={submit} className="max-w-3xl space-y-6" noValidate>
        <Section title="What are you donating?">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Food name" error={errors.food_name}><input className="input" placeholder="e.g. Vegetarian Meals" value={f.food_name} onChange={set('food_name')} /></Field>
            <Field label="Food type"><select className="input" value={f.food_type} onChange={set('food_type')}>{FOOD_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Quantity" error={errors.quantity}><input className="input" type="number" min="0" step="any" value={f.quantity} onChange={set('quantity')} /></Field>
            <Field label="Unit"><select className="input" value={f.unit} onChange={set('unit')}>{UNITS.map((t) => <option key={t}>{t}</option>)}</select></Field>
          </div>
          <Field label="Description (optional)"><textarea className="input" rows="3" placeholder="What’s in it? How is it packed? Any allergens?" value={f.description} onChange={set('description')} /></Field>
          <Field label="Food photo (optional)" error={errors.image} hint="JPG, PNG or WEBP, up to 5 MB">
            {preview ? (
              <div className="relative inline-block"><img src={preview} alt="Food preview" className="h-40 rounded-xl object-cover" />
                <button type="button" aria-label="Remove image" className="absolute right-2 top-2 rounded-full bg-white p-1 shadow" onClick={() => { setFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = ''; }}><X className="h-4 w-4" /></button></div>
            ) : (
              <button type="button" onClick={() => fileRef.current.click()} className="flex h-32 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-200 text-ink-500 hover:border-brand-600 hover:text-brand-700"><ImagePlus className="h-6 w-6" />Choose an image</button>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pickFile} />
          </Field>
        </Section>

        <Section title="When can it be collected?">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Pickup starts" error={errors.pickup_start}><input className="input" type="datetime-local" value={f.pickup_start} onChange={set('pickup_start')} /></Field>
            <Field label="Pickup ends" error={errors.pickup_end}><input className="input" type="datetime-local" value={f.pickup_end} onChange={set('pickup_end')} /></Field>
            <Field label="Consume before" error={errors.consume_before} hint="Food safety deadline"><input className="input" type="datetime-local" value={f.consume_before} onChange={set('consume_before')} /></Field>
          </div>
        </Section>

        <Section title="Where is it?">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Pickup address" error={errors.pickup_address} className="sm:col-span-2"><input className="input" value={f.pickup_address} onChange={set('pickup_address')} /></Field>
            <Field label="City" error={errors.city}><input className="input" value={f.city} onChange={set('city')} /></Field>
          </div>
          <Field label="Pin the pickup spot" error={errors.location}><LocationPicker lat={f.latitude} lng={f.longitude} searchHint={`${f.pickup_address} ${f.city}`} onChange={(a, b) => setF((s) => ({ ...s, latitude: a, longitude: b }))} /></Field>
        </Section>

        <div className="flex gap-3"><button className="btn-primary px-6" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}{editing ? 'Save changes' : 'Publish donation'}</button><button type="button" className="btn-outline" onClick={() => navigate(-1)}>Cancel</button></div>
      </form>
    </>
  );
}
