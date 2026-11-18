import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const from = location.state?.from?.pathname || '/';
  if (!loading && user) return <Navigate to={from} replace />;

  const submit = async (event) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'h-11 w-full rounded-lg border border-border/70 bg-white/[0.02] px-3.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20';

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(900px 420px at 12% -8%, rgba(79,179,155,0.12), transparent 65%), radial-gradient(760px 380px at 88% 4%, rgba(242,85,90,0.08), transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <p className="mt-4 font-display text-[15px] font-semibold uppercase tracking-[0.16em]">NGuard</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Threat console</p>
        </div>

        <form
          onSubmit={submit}
          noValidate
          className="rounded-2xl border border-border/70 bg-card/70 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-7"
        >
          <h1 className="font-display text-[20px]">Sign in</h1>
          <p className="mt-1 text-[12px] text-muted-foreground">Use your administrator account to access the dashboard.</p>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Username</span>
              <input
                type="text"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className={inputClass}
                placeholder="admin"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Password</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={`${inputClass} pr-11`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-lg border border-[#F2555A]/30 bg-[#F2555A]/[0.08] px-3 py-2 text-[12px] text-[#F2555A]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-muted-foreground/70">
          Accounts are managed by the system administrator.
        </p>
      </div>
    </div>
  );
}
