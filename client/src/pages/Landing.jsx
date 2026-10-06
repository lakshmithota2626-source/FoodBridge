import { Link } from 'react-router-dom';
import { ArrowRight, BellRing, Clock, HandHeart, MapPin, ShieldCheck, Sparkles, Utensils } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../lib/hooks';
import { fmtNum, fmtTime, homePath } from '../lib/format';
import { FoodImage, Skeleton } from '../components/ui';

function Stat({ value, label, loading }) {
  return (
    <div>
      {loading ? <Skeleton className="h-10 w-24 bg-white/10" /> : <p className="font-display text-4xl font-bold text-white sm:text-5xl">{fmtNum(value)}</p>}
      <p className="mt-1 text-brand-200">{label}</p>
    </div>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const stats = useFetch(() => api.get('/public/stats').then((r) => r.data), []);
  const feat = useFetch(() => api.get('/public/featured').then((r) => r.data.donations), []);
  const s = stats.data || {};
  const donate = user?.role === 'DONOR' ? '/donor/create-donation' : user ? homePath(user.role) : '/register?role=DONOR';
  const find = user?.role === 'NGO' ? '/ngo/donations' : user ? homePath(user.role) : '/register?role=NGO';
  const hero = feat.data?.[0];

  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 lg:grid-cols-[1.15fr_1fr] lg:py-20">
        <div className="rise">
          <h1 className="text-4xl font-bold leading-[1.05] sm:text-6xl">Turn Surplus Food Into Someone’s Next Meal.</h1>
          <p className="mt-5 max-w-xl text-lg text-ink-600">FoodBridge connects food donors with NGOs so surplus food reaches people who need it instead of becoming waste.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={donate} className="btn-primary px-6 py-3 text-base">Donate Food</Link>
            <Link to={find} className="btn-dark px-6 py-3 text-base">Find Food</Link>
          </div>
        </div>
        <div className="rise" style={{ animationDelay: '.15s' }}>
          <p className="mb-2 text-sm font-medium text-ink-500">Available right now</p>
          {feat.loading ? <Skeleton className="h-72 rounded-2xl" /> : hero ? (
            <div className="card overflow-hidden shadow-lg">
              <FoodImage src={hero.image_url} type={hero.food_type} className="h-44" />
              <div className="p-5">
                <h3 className="text-xl font-bold">{fmtNum(hero.quantity)} {hero.unit} · {hero.food_name}</h3>
                <p className="text-sm text-ink-500">{hero.donor_name} · {hero.city}</p>
                <p className="mt-3 flex items-center gap-2 text-sm text-ink-600"><Clock className="h-4 w-4" />Pickup before {fmtTime(hero.pickup_end)}</p>
                <Link to={user ? homePath(user.role) : '/register?role=NGO'} className="btn-primary mt-4 w-full">{user ? 'Open dashboard' : 'Join to claim it'}</Link>
              </div>
            </div>
          ) : (
            <div className="card p-8 text-center"><Utensils className="mx-auto h-10 w-10 text-ink-300" /><p className="mt-3 font-semibold">No food posted at the moment</p><p className="text-sm text-ink-500">Donors post surplus here the moment it’s available.</p></div>
          )}
        </div>
      </section>

      {/* Problem */}
      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold">Good food is thrown away every night, a few kilometres from people who need it.</h2>
          </div>
          <div className="space-y-4 text-ink-600">
            <p>Restaurants, hostels, function halls and canteens routinely end the day with cooked food they can’t sell or serve. Meanwhile, shelters and community kitchens struggle to feed the people they look after.</p>
            <p>There has been no simple, shared place where one can say “we have 50 meals, ready at 7 PM” and the right NGO can say “we’ll take them.” Phone calls and WhatsApp groups don’t scale — and cooked food doesn’t wait.</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl font-bold">How FoodBridge works</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-4">
          {[[Utensils, 'Donor posts', 'Add what you have, how much, where, and the pickup window.'], [MapPin, 'NGO discovers', 'Nearby NGOs see it ranked by distance, food type and timing.'], [HandHeart, 'NGO claims', 'One tap claims it. Nobody else can — no double bookings.'], [ShieldCheck, 'Picked up', 'The NGO collects and confirms. The donor is notified instantly.']].map(([Icon, t, d], i) => (
            <div key={t} className="card p-5">
              <div className="mb-4 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-brand-600 font-display font-bold text-white">{i + 1}</span><Icon className="h-6 w-6 text-brand-700" /></div>
              <h3 className="text-lg font-bold">{t}</h3><p className="mt-1 text-sm text-ink-600">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Impact */}
      <section className="bg-brand-900 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-bold text-white">Impact so far</h2>
          <p className="mt-1 text-brand-200">Live numbers from the FoodBridge database.</p>
          <div className="mt-10 grid grid-cols-2 gap-8 md:grid-cols-4">
            <Stat loading={stats.loading} value={s.meals_rescued} label="Meals rescued" />
            <Stat loading={stats.loading} value={s.donations} label="Donations posted" />
            <Stat loading={stats.loading} value={s.ngos} label="NGOs connected" />
            <Stat loading={stats.loading} value={s.food_saved_kg} label="kg of food saved" />
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex items-end justify-between"><h2 className="text-3xl font-bold">Fresh donations</h2><Link to={find} className="btn-ghost">See all <ArrowRight className="h-4 w-4" /></Link></div>
        {feat.loading ? <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}</div>
          : !feat.data?.length ? <p className="mt-6 text-ink-500">Nothing is listed right now. Check back soon.</p> : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {feat.data.map((d) => (
                <div key={d.id} className="card overflow-hidden"><FoodImage src={d.image_url} type={d.food_type} className="h-32" />
                  <div className="p-4"><p className="font-bold">{fmtNum(d.quantity)} {d.unit} · {d.food_name}</p><p className="text-sm text-ink-500">{d.donor_name}</p><p className="mt-1 text-sm text-ink-500">{d.city}</p></div></div>
              ))}
            </div>
          )}
      </section>

      {/* Smart matching */}
      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold">Smart Matching puts the best donation first.</h2>
            <p className="mt-4 text-ink-600">Every donation gets a Match Score for each NGO from four transparent rules — no black box, and not machine learning. You can always see why a donation scored the way it did.</p>
            <ul className="mt-6 space-y-3 text-sm">
              {[['Distance', 40, 'Closer is better — full marks within 2 km'], ['Food type', 20, 'Does it fit what your NGO can use?'], ['Quantity', 20, 'Does it fit your pickup capacity?'], ['Pickup time', 20, 'Is there enough time to collect it?']].map(([n, w, d]) => (
                <li key={n} className="flex items-start gap-3"><span className="mt-0.5 w-12 shrink-0 rounded-md bg-brand-50 py-0.5 text-center font-bold text-brand-800">{w}%</span><span><b>{n}</b> — <span className="text-ink-600">{d}</span></span></li>
              ))}
            </ul>
          </div>
          <div className="card p-6 shadow-lg" aria-label="Example match card">
            <p className="mb-3 text-xs font-medium text-ink-400">Example</p>
            <h3 className="text-xl font-bold">50 meals · Vegetarian Meals</h3>
            <p className="text-sm text-ink-500">2.4 km away · Pickup before 8:00 PM</p>
            <div className="mt-4 space-y-2.5">
              {[['Distance', 98], ['Food type', 100], ['Quantity', 100], ['Pickup time', 85]].map(([n, v]) => (
                <div key={n}><div className="flex justify-between text-xs"><span>{n}</span><span>{v}%</span></div><div className="h-2 rounded-full bg-ink-100"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${v}%` }} /></div></div>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-2"><span className="rounded-full bg-brand-600 px-3 py-1 text-sm font-bold text-white">96% match</span><span className="text-sm font-semibold text-brand-700">★ Recommended</span></div>
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl font-bold">Why FoodBridge</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[[Sparkles, 'Built for speed', 'Cooked food has hours, not days. Post in under a minute; claim in one tap.'], [BellRing, 'Everyone stays informed', 'Instant in-app alerts for claims, pickup reminders and food about to expire.'], [ShieldCheck, 'Safe and accountable', 'Claims are locked to one NGO, every pickup is recorded, and admins can remove bad posts.']].map(([Icon, t, d]) => (
            <div key={t} className="card p-6"><Icon className="h-7 w-7 text-brand-700" /><h3 className="mt-4 text-lg font-bold">{t}</h3><p className="mt-1 text-sm text-ink-600">{d}</p></div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-16">
        <div className="mx-auto max-w-6xl rounded-3xl bg-ink-900 px-6 py-14 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Tonight’s extra food can be tomorrow’s relief.</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to={donate} className="btn-primary px-6 py-3 text-base">Donate Food</Link>
            <Link to={find} className="btn bg-white px-6 py-3 text-base text-ink-900 hover:bg-ink-100">Find Food</Link>
          </div>
        </div>
      </section>
    </>
  );
}
