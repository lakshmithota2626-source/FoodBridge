import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const COLORS = ['#0a9552', '#f59e0b', '#0ea5e9', '#6b7280', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316'];
const STATUS_COLORS = { AVAILABLE: '#0a9552', CLAIMED: '#f59e0b', PICKED_UP: '#0ea5e9', EXPIRED: '#9ca3af', CANCELLED: '#ef4444' };

const Box = ({ title, children, className = '' }) => (
  <div className={`card p-5 ${className}`}><h3 className="mb-4 text-base font-bold">{title}</h3><div className="h-64">{children}</div></div>
);
const axis = { tick: { fontSize: 11, fill: '#7c857d' }, tickLine: false, axisLine: false };

export default function Charts({ charts }) {
  const empty = (arr) => !arr?.length || arr.every((r) => !(r.value ?? r.donations ?? r.meals ?? r.donors ?? 0) && !(r.ngos ?? 0));
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Box title="Donations over time (30 days)">
        <ResponsiveContainer><AreaChart data={charts.donations_over_time}><CartesianGrid vertical={false} stroke="#e7e9e7" /><XAxis dataKey="day" interval={4} {...axis} /><YAxis allowDecimals={false} {...axis} /><Tooltip /><Area type="monotone" dataKey="donations" stroke="#0a9552" fill="#d1fae0" strokeWidth={2} /></AreaChart></ResponsiveContainer>
      </Box>
      <Box title="Meals rescued over time (30 days)">
        <ResponsiveContainer><BarChart data={charts.meals_over_time}><CartesianGrid vertical={false} stroke="#e7e9e7" /><XAxis dataKey="day" interval={4} {...axis} /><YAxis allowDecimals={false} {...axis} /><Tooltip /><Bar dataKey="meals" fill="#0a9552" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
      </Box>
      <Box title="Donation status">
        {empty(charts.status_distribution) ? <p className="grid h-full place-items-center text-sm text-ink-400">No donations yet</p> : (
          <ResponsiveContainer><PieChart><Pie data={charts.status_distribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>{charts.status_distribution.map((s) => <Cell key={s.name} fill={STATUS_COLORS[s.name] || '#999'} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>
        )}
      </Box>
      <Box title="Food types">
        {empty(charts.food_type_distribution) ? <p className="grid h-full place-items-center text-sm text-ink-400">No donations yet</p> : (
          <ResponsiveContainer><PieChart><Pie data={charts.food_type_distribution} dataKey="value" nameKey="name" outerRadius={85}>{charts.food_type_distribution.map((s, i) => <Cell key={s.name} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>
        )}
      </Box>
      <Box title="New donors vs NGOs (30 days)" className="lg:col-span-2">
        <ResponsiveContainer><LineChart data={charts.user_growth}><CartesianGrid vertical={false} stroke="#e7e9e7" /><XAxis dataKey="day" interval={2} {...axis} /><YAxis allowDecimals={false} {...axis} /><Tooltip /><Legend /><Line type="monotone" dataKey="donors" name="Donors" stroke="#f59e0b" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="ngos" name="NGOs" stroke="#2563eb" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
      </Box>
    </div>
  );
}
