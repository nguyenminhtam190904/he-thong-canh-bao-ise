import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from '@/components/Layout';
import { AuthProvider, RequireAuth } from '@/lib/auth-context';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Alerts from '@/pages/Alerts';
import AlertDetail from '@/pages/AlertDetail';
import Agents from '@/pages/Agents';
import History from '@/pages/History';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';

function NotFound() {
  return <section className="rounded-2xl border border-border/70 bg-card/60 p-10 text-center">Page not found.</section>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/alerts/:id" element={<AlertDetail />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/history" element={<History />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
