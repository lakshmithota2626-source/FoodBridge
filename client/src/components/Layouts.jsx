import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, BarChart3, ClipboardList, FilePlus2, Flag, HandHeart, History, LayoutDashboard, LogOut, Menu, PackageCheck, Search, User, Users, Utensils, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { homePath } from '../lib/format';
import api from '../api/client';
import { cn } from './ui';

export const Logo = ({ light }) => (
  <span className="inline-flex items-center gap-2.5">
    <svg viewBox="0 0 100 100" className="h-9 w-9" aria-hidden="true"><rect width="100" height="100" rx="24" fill="#0a9552" /><path d="M14 66 Q50 18 86 66" stroke="#fff" strokeWidth="9" fill="none" strokeLinecap="round" /><circle cx="50" cy="70" r="7" fill="#fff" /></svg>
    <span className={cn('font-display text-xl font-bold', light ? 'text-white' : 'text-ink-900')}>FoodBridge</span>
  </span>
);

export function PublicLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);
  const links = [['/about', 'About'], ['/how-it-works', 'How it works']];
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" aria-label="FoodBridge home"><Logo /></Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map(([to, l]) => <NavLink key={to} to={to} className={({ isActive }) => cn('rounded-lg px-3 py-2 text-sm font-medium hover:bg-ink-100', isActive && 'text-brand-700')}>{l}</NavLink>)}
            {user ? (
              <><Link to={homePath(user.role)} className="btn-primary ml-2">Open dashboard</Link></>
            ) : (
              <><Link to="/login" className="btn-ghost">Log in</Link><Link to="/register" className="btn-primary">Join FoodBridge</Link></>
            )}
          </nav>
          <button className="rounded-lg p-2 md:hidden" aria-label="Menu" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
        </div>
        {open && (
          <div className="space-y-1 border-t border-ink-100 bg-paper px-4 py-3 md:hidden">
            {links.map(([to, l]) => <Link key={to} to={to} className="block rounded-lg px-3 py-2 font-medium hover:bg-ink-100">{l}</Link>)}
            {user ? <Link to={homePath(user.role)} className="btn-primary w-full">Open dashboard</Link> : <><Link to="/login" className="btn-outline w-full">Log in</Link><Link to="/register" className="btn-primary w-full">Join FoodBridge</Link></>}
          </div>
        )}
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="bg-ink-900 text-ink-300">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-3">
          <div><Logo light /><p className="mt-3 max-w-xs text-sm">Rescue Food. Connect Communities. Reduce Waste.</p></div>
          <div className="text-sm"><p className="mb-3 font-semibold text-white">Platform</p><ul className="space-y-2"><li><Link to="/how-it-works" className="hover:text-white">How it works</Link></li><li><Link to="/about" className="hover:text-white">About</Link></li><li><Link to="/register" className="hover:text-white">Register as donor or NGO</Link></li></ul></div>
          <div className="text-sm"><p className="mb-3 font-semibold text-white">Built for</p><p>Restaurants, hostels, function halls and canteens with surplus food — and the NGOs that feed people with it.</p></div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs">© {new Date().getFullYear()} FoodBridge. Built for a college hackathon.</div>
      </footer>
    </div>
  );
}

const NAV = {
  DONOR: [['/donor/dashboard', 'Dashboard', LayoutDashboard], ['/donor/create-donation', 'Create donation', FilePlus2], ['/donor/donations', 'My donations', ClipboardList], ['/donor/history', 'History', History], ['/donor/notifications', 'Notifications', Bell], ['/donor/profile', 'Profile', User]],
  NGO: [['/ngo/dashboard', 'Dashboard', LayoutDashboard], ['/ngo/donations', 'Find food', Search], ['/ngo/claimed', 'Claimed', PackageCheck], ['/ngo/history', 'History', History], ['/ngo/notifications', 'Notifications', Bell], ['/ngo/profile', 'Profile', User]],
  ADMIN: [['/admin/dashboard', 'Dashboard', LayoutDashboard], ['/admin/users', 'Users', Users], ['/admin/donations', 'Donations', Utensils], ['/admin/reports', 'Reports', Flag], ['/admin/analytics', 'Analytics', BarChart3]],
};

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);

  useEffect(() => {
    if (user.role === 'ADMIN') return undefined;
    const load = () => api.get('/notifications').then((r) => setUnread(r.data.unread_count)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    window.addEventListener('fb:notifications', load);
    return () => { clearInterval(t); window.removeEventListener('fb:notifications', load); };
  }, [user.role, pathname]);

  const items = NAV[user.role];
  const nav = (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {items.map(([to, label, Icon]) => (
        <NavLink key={to} to={to} className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium', isActive ? 'bg-brand-600 text-white' : 'text-ink-300 hover:bg-white/10 hover:text-white')}>
          <Icon className="h-5 w-5" />{label}
          {label === 'Notifications' && unread > 0 && <span className="ml-auto rounded-full bg-amber-400 px-2 text-xs font-bold text-ink-900">{unread}</span>}
        </NavLink>
      ))}
    </nav>
  );
  const sidebar = (
    <div className="flex h-full flex-col bg-ink-900">
      <div className="flex h-16 items-center px-5"><Link to="/"><Logo light /></Link></div>
      {nav}
      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-semibold text-white">{user.organization_name || user.name}</p>
        <p className="mb-3 text-xs text-ink-400">{user.role === 'NGO' ? 'NGO' : user.role === 'DONOR' ? 'Donor' : 'Administrator'}</p>
        <button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-ink-300 hover:bg-white/10 hover:text-white" onClick={() => { logout(); navigate('/'); }}><LogOut className="h-4 w-4" />Log out</button>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>
      {open && <div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-ink-900/50" onClick={() => setOpen(false)} /><aside className="relative h-full w-64">{sidebar}</aside></div>}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-ink-100 bg-paper/90 px-4 backdrop-blur lg:px-8">
        <button className="rounded-lg p-2 lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}><Menu /></button>
        <div className="hidden lg:block" />
        <div className="flex items-center gap-3">
          {user.role !== 'ADMIN' && (
            <Link to={`/${user.role.toLowerCase()}/notifications`} className="relative rounded-full p-2 hover:bg-ink-100" aria-label={`Notifications, ${unread} unread`}>
              <Bell className="h-5 w-5" />{unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">{unread}</span>}
            </Link>
          )}
          <span className="hidden text-sm font-medium sm:block">{user.name}</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8"><Outlet /></main>
    </div>
  );
}
