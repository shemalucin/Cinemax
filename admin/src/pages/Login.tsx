import { useState, useEffect } from 'react';
import { Lock, ArrowRight, AlertCircle, Mail, KeyRound } from 'lucide-react';
import type { FormEvent } from 'react';
import { websiteAuth, setToken, getToken, clearToken } from '../lib/websiteApi';

interface LoginProps {
  onSuccess: () => void;
}

export function isAdminAuthenticated(): boolean {
  return !!getToken();
}

export function clearAdminSession() {
  clearToken();
}

export default function Login({ onSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);

  useEffect(() => {
    websiteAuth.checkConnection().then(() => setApiConnected(true)).catch(() => setApiConnected(false));
  }, []);

  // Secure portal handoff from the main website (logged-in admin)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) return;
    // Remember the website origin that handed us off so "View Live Website"
    // in the sidebar can send admins straight back there.
    try {
      if (document.referrer) {
        sessionStorage.setItem('cinemax_website_url', new URL(document.referrer).origin);
      }
    } catch {}
    setHandoffLoading(true);
    window.history.replaceState({}, '', window.location.pathname);
    websiteAuth
      .exchangePortal(token)
      .then(({ user, token: sessionToken }) => {
        if (user?.role !== 'admin') {
          clearToken();
          setError('That secure link is invalid or expired.');
          return;
        }
        setToken(sessionToken);
        onSuccess();
      })
      .catch(() => {
        clearToken();
        setError('That secure link is invalid or expired. Sign in with your admin email below.');
      })
      .finally(() => setHandoffLoading(false));
  }, [onSuccess]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      const { user, token } = await websiteAuth.login(email.trim(), password);
      if (user?.role !== 'admin') {
        setError('This account is not an administrator.');
        return;
      }
      setToken(token);
      onSuccess();
    } catch (e: any) {
      setError(e.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      {handoffLoading ? (
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin mx-auto" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          <p className="text-sm font-semibold text-white">Verifying secure link…</p>
        </div>
      ) : (
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl neon-btn">
            C
          </div>
          <div className="text-center">
            <h1 className="font-black text-white text-xl tracking-widest">CINEMAX</h1>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase mt-1" style={{ color: 'var(--accent-text)' }}>
              Admin Panel
            </p>
          </div>
        </div>

        <div className="rounded-2xl p-6 glass-card">
          <div className="flex items-center gap-2 mb-5">
            <Lock className="w-4 h-4" style={{ color: 'var(--accent-text)' }} />
            <h2 className="text-sm font-bold text-white">Administrator Sign-In</h2>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Admin Email
              </span>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="allkikisweb@gmail.com"
                  className="input-base pl-9"
                />
              </div>
            </label>

            <label className="block space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Password
              </span>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-base pl-9"
                />
              </div>
            </label>

            {error && (
              <div className="flex items-start gap-2 text-xs p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full neon-btn font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm disabled:opacity-60">
              {loading ? 'Signing in...' : 'Sign In'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] mt-6" style={{ color: 'var(--text-faint)' }}>
          {apiConnected === true && 'Connected to the live Cinemax website — changes take effect immediately.'}
          {apiConnected === false && 'Cannot reach the Cinemax backend. Check VITE_WEBSITE_API_URL on Render.'}
          {apiConnected === null && 'Checking connection to the live Cinemax website…'}
        </p>
      </div>
      )}
    </div>
  );
}
