import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { DashboardLayout, PublicLayout } from './components/Layouts';
import { Spinner } from './components/ui';
import { homePath } from './lib/format';

import Landing from './pages/Landing';
import { About, HowItWorks } from './pages/Static';
import { Login, Register } from './pages/Auth';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import DonationDetail from './pages/DonationDetail';
import DonorDashboard from './pages/donor/Dashboard';
import CreateDonation from './pages/donor/CreateDonation';
import { DonorDonations, DonorHistory } from './pages/donor/Lists';
import NgoDashboard from './pages/ngo/Dashboard';
import BrowseDonations from './pages/ngo/BrowseDonations';
import { NgoClaimed, NgoHistory } from './pages/ngo/Claims';
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import { AdminDonations, AdminReports } from './pages/admin/Manage';
import AdminAnalytics from './pages/admin/Analytics';

function Protected({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center"><Spinner className="h-8 w-8 text-brand-600" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={homePath(user.role)} replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to={homePath(user.role)} replace /> : children;
}

export default function App() {
  const shell = (role) => <Protected role={role}><DashboardLayout /></Protected>;
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/about" element={<About />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      </Route>

      <Route path="/donor" element={shell('DONOR')}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DonorDashboard />} />
        <Route path="create-donation" element={<CreateDonation />} />
        <Route path="donations" element={<DonorDonations />} />
        <Route path="donations/:id" element={<DonationDetail />} />
        <Route path="donations/:id/edit" element={<CreateDonation />} />
        <Route path="history" element={<DonorHistory />} />
        <Route path="profile" element={<Profile />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>

      <Route path="/ngo" element={shell('NGO')}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<NgoDashboard />} />
        <Route path="donations" element={<BrowseDonations />} />
        <Route path="donations/:id" element={<DonationDetail />} />
        <Route path="claimed" element={<NgoClaimed />} />
        <Route path="history" element={<NgoHistory />} />
        <Route path="profile" element={<Profile />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>

      <Route path="/admin" element={shell('ADMIN')}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="donations" element={<AdminDonations />} />
        <Route path="donations/:id" element={<DonationDetail />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="analytics" element={<AdminAnalytics />} />
      </Route>

      <Route path="*" element={<div className="grid min-h-screen place-items-center text-center"><div><h1 className="text-4xl font-bold">Page not found</h1><a href="/" className="btn-primary mt-6">Back to home</a></div></div>} />
    </Routes>
  );
}
