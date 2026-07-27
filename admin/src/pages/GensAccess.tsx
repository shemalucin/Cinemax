import { useCallback, useEffect, useState } from 'react';
import { websiteApi } from '../lib/websiteApi';
import { Heart, Loader2, RefreshCw } from 'lucide-react';

interface GensAccessRow {
  userId: string;
  name: string;
  email: string;
  status: string;
  role: string;
  subscription: string;
  createdAt: string;
  currentAge: number | null;
  ageEligible: boolean;
  adminOverride: boolean;
  authorized: boolean;
  authorizationReason: string;
  firstAccessedAt: string | null;
  lastAccessedAt: string | null;
  accessCount: number;
}

export default function GensAccess() {
  const [rows, setRows] = useState<GensAccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({ total: 0, authorized: 0, unauthorized: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await websiteApi.getGensAccess();
      setRows((data as any).users || []);
      setSummary({
        total: (data as any).total || 0,
        authorized: (data as any).authorized || 0,
        unauthorized: (data as any).unauthorized || 0,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const [grantTarget, setGrantTarget] = useState("");
  const [granting, setGranting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleGrant = async () => {
    if (!grantTarget) return setActionError("Enter a user email or id to grant access.");
    setGranting(true);
    setActionError(null);
    try {
      // Try to resolve by email/name via users search
      const list = await websiteApi.getUsers({ search: grantTarget, page: 1 });
      const user = (list as any).users?.[0];
      if (!user) throw new Error("No user found matching that query.");
      await websiteApi.grantGensAccess(user.id);
      setGrantTarget("");
      await load();
    } catch (e: any) {
      setActionError(e.message || String(e));
    } finally {
      setGranting(false);
    }
  };

  const handleBanToggle = async (row: GensAccessRow) => {
    const toBan = row.status !== 'banned';
    if (!confirm(`Are you sure you want to ${toBan ? 'ban' : 'unban'} ${row.email}?`)) return;
    try {
      await websiteApi.setUserStatus(row.userId, toBan ? 'banned' : 'active');
      await load();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-pink-500 to-red-500">
              <Heart className="w-3.5 h-3.5 text-white" fill="currentColor" />
            </span>
            Gens Access
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Full directory of authorized and unauthorized users, with automatic age eligibility and admin overrides.
          </p>
        </div>
        <button type="button" onClick={load} className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold self-start sm:self-auto">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard label="Total Users" value={summary.total} />
        <SummaryCard label="Authorized" value={summary.authorized} />
        <SummaryCard label="Unauthorized" value={summary.unauthorized} />
      </div>

      <div className="flex items-center gap-3">
        <input
          placeholder="User email or id"
          value={grantTarget}
          onChange={(e) => setGrantTarget(e.target.value)}
          className="rounded-xl px-3 py-2 bg-white/5 text-sm text-white w-full max-w-sm"
        />
        <button
          type="button"
          onClick={handleGrant}
          disabled={granting}
          className="px-4 py-2 rounded-xl bg-green-600/10 text-green-300 hover:bg-green-600/20 text-sm font-bold"
        >
          {granting ? 'Granting…' : 'Grant Gens Access'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl p-4 text-xs" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden glass-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-faint)' }}>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Age</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Access</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Reason</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Last Access</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Visits</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.userId} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-4 py-3 text-white whitespace-nowrap">
                      <div className="font-bold">{row.name}</div>
                      <div className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                        {row.role} · {row.subscription || 'Free'} · joined {new Date(row.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{row.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                        style={{
                          background: row.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                          color: row.status === 'active' ? '#4ade80' : '#f87171',
                        }}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      {row.currentAge ?? 'Unknown'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                        style={{
                          background: row.authorized ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                          color: row.authorized ? '#4ade80' : '#f87171',
                        }}
                      >
                        {row.authorized ? 'Authorized' : 'Blocked'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      {reasonLabel(row.authorizationReason)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      {row.lastAccessedAt ? new Date(row.lastAccessedAt).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-3 font-bold" style={{ color: 'var(--accent-text)' }}>{row.accessCount}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        {row.adminOverride ? (
                          <button
                            type="button"
                            onClick={async () => { try { await websiteApi.revokeGensAccess(row.userId); load(); } catch (e) { console.error(e); } }}
                            className="px-3 py-1 rounded-xl text-xs font-bold bg-red-600/10 text-red-400 hover:bg-red-600/20"
                          >
                            Revoke
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={async () => { try { await websiteApi.grantGensAccess(row.userId); load(); } catch (e) { console.error(e); } }}
                            className="px-3 py-1 rounded-xl text-xs font-bold bg-green-600/10 text-green-300 hover:bg-green-600/20"
                          >
                            Grant
                          </button>
                        )}
                      <button
                        type="button"
                        onClick={() => handleBanToggle(row)}
                        className="px-3 py-1 rounded-xl text-xs font-bold bg-white/5 text-neutral-200 hover:bg-white/10"
                      >
                        {row.status === 'banned' ? 'Unban' : 'Ban'}
                      </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center" style={{ color: 'var(--text-muted)' }}>
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl p-4 glass-card">
      <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-faint)' }}>{label}</p>
      <p className="text-2xl font-black text-white mt-1">{value.toLocaleString()}</p>
    </div>
  );
}

function reasonLabel(reason: string) {
  switch (reason) {
    case 'admin_override': return 'Admin override';
    case 'admin_role': return 'Admin role';
    case 'age_eligible': return 'Age eligible';
    default: return 'Restricted';
  }
}
