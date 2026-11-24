import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Check, Eye, EyeOff, KeyRound, Loader2, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const REMEMBER_KEY = 'nguard.rememberedUsername';

function readRemembered() {
  try {
    return localStorage.getItem(REMEMBER_KEY) || '';
  } catch {
    return '';
  }
}

function saveRemembered(username) {
  try {
    if (username) localStorage.setItem(REMEMBER_KEY, username);
    else localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* storage unavailable */
  }
}

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState(readRemembered);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => Boolean(readRemembered()));
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const from = location.state?.from?.pathname || '/';
  if (!loading && user) return <Navigate to={from} replace />;

  const submit = async (event) => {
    event.preventDefault();
    setInfo('');
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await login(username.trim(), password);
      saveRemembered(remember ? username.trim() : '');
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    'group flex h-14 w-full items-center gap-3 rounded-full border border-white/15 bg-white/[0.06] px-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition focus-within:border-white/50 focus-within:bg-white/[0.1]';
  const inputClass =
    'h-full min-w-0 flex-1 bg-transparent text-[15px] text-white placeholder:text-white/45 focus:outline-none';

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 text-white"
      style={{ fontFamily: "'Outfit', var(--font-body)", backgroundColor: '#000000' }}
    >
      {/* Black background with a faint glow */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-[-20%] h-[60vh] w-[70vw] -translate-x-1/2 rounded-full bg-white/[0.04] blur-[140px]" />
      </div>

      <form onSubmit={submit} noValidate className="relative w-full max-w-[390px]">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] shadow-[0_0_40px_-8px_rgba(255,255,255,0.25)]">
            <ShieldCheck className="h-8 w-8 text-white" strokeWidth={1.75} />
          </div>
          <p className="mt-4 text-[20px] font-semibold tracking-[0.02em]">NGuard</p>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">Threat console</p>
        </div>

        <h1 className="mb-8 text-center text-[30px] font-medium tracking-[-0.01em]">Sign in</h1>

        <div className="space-y-6">
          <label className={fieldClass}>
            <User className="h-5 w-5 shrink-0 text-white" strokeWidth={2.25} aria-hidden />
            <span className="sr-only">Username</span>
            <input
              type="text"
              autoComplete="username"
              autoFocus={!username}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className={inputClass}
              placeholder="Username"
            />
          </label>

          <label className={fieldClass}>
            <KeyRound className="h-5 w-5 shrink-0 text-white" strokeWidth={2.25} aria-hidden />
            <span className="sr-only">Password</span>
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              autoFocus={Boolean(username)}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
              placeholder="Password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:text-white"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
            </button>
          </label>
        </div>

        <div className="mt-5 flex items-center justify-between px-6 text-[14px] font-medium">
          <label className="flex cursor-pointer select-none items-center gap-2">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="peer sr-only"
            />
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-white/70 bg-transparent transition peer-checked:border-white peer-checked:bg-white peer-focus-visible:ring-2 peer-focus-visible:ring-white/60">
              <Check className={`h-3 w-3 text-black ${remember ? 'opacity-100' : 'opacity-0'}`} strokeWidth={3.5} />
            </span>
            Remember me
          </label>
          <button
            type="button"
            onClick={() => {
              setError('');
              setInfo('Please contact your system administrator to reset your password.');
            }}
            className="transition text-white/80 hover:text-white hover:underline"
          >
            Forgot password?
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-5 rounded-2xl border border-[#ff8a8f]/50 bg-[#ff5a64]/20 px-5 py-2.5 text-center text-[13px] font-medium text-white backdrop-blur-md">
            {error}
          </p>
        )}
        {info && !error && (
          <p role="status" className="mt-5 rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-2.5 text-center text-[13px] text-white backdrop-blur-md">
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-8 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-[16px] font-medium text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition hover:bg-white/90 disabled:opacity-70"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
