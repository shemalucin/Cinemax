import { useCallback, useEffect, useState } from 'react';
import { websiteApi } from '../lib/websiteApi';
import { Bot, Check, Database, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';

interface AiMemory {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
  source: string;
  updated_at: string;
}

export default function AIControl() {
  const [data, setData] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [memoryTitle, setMemoryTitle] = useState('');
  const [memoryContent, setMemoryContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await websiteApi.getAiControl();
      setData(next);
      setSettings(next.settings);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await websiteApi.updateAiSettings(settings);
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const addMemory = async () => {
    if (!memoryTitle.trim() || !memoryContent.trim()) return;
    setSaving(true);
    try {
      await websiteApi.createAiMemory({ title: memoryTitle.trim(), content: memoryContent.trim(), enabled: true });
      setMemoryTitle('');
      setMemoryContent('');
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (error) return <div className="rounded-xl p-4 text-xs" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>{error}</div>;
  if (loading || !data || !settings) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--accent)' }} />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Bot className="w-5 h-5" style={{ color: 'var(--accent-text)' }} />
            AI Control Panel
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Monitor All Kiki&apos;s AI, tune its brain, and manage approved memory.
          </p>
        </div>
        <button type="button" onClick={load} className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold self-start sm:self-auto">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        <Stat label="Messages" value={data.stats.totalMessages} />
        <Stat label="Token Estimate" value={data.stats.totalTokensEstimate} />
        <Stat label="Gemini Replies" value={data.stats.geminiMessages} />
        <Stat label="Groq Replies" value={data.stats.groqMessages} />
      </div>

      <section className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <h2 className="text-sm font-bold text-white flex items-center gap-2"><Database className="w-4 h-4" style={{ color: 'var(--accent-text)' }} /> Brain Settings</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Gemini Primary Model</span>
            <input className="input-base font-mono" value={settings.aiPrimaryModel || ''} onChange={(e) => setSettings({ ...settings, aiPrimaryModel: e.target.value })} />
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Groq Fallback Model</span>
            <input className="input-base font-mono" value={settings.aiModel || ''} onChange={(e) => setSettings({ ...settings, aiModel: e.target.value })} />
          </label>
        </div>
        <label className="space-y-1.5 block">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Global Brain Instructions</span>
          <textarea rows={5} className="input-base resize-none" value={settings.aiSystemPromptExtra || ''} onChange={(e) => setSettings({ ...settings, aiSystemPromptExtra: e.target.value })} />
        </label>
        <div className="flex items-center justify-between">
          <button onClick={() => setSettings({ ...settings, aiEnabled: !settings.aiEnabled })} className="px-4 py-2 rounded-xl text-xs font-bold" style={settings.aiEnabled ? { background: 'var(--accent-dim)', color: 'var(--accent-text)' } : { background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
            AI {settings.aiEnabled ? 'Enabled' : 'Disabled'}
          </button>
          <button onClick={saveSettings} disabled={saving} className="neon-btn flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save Brain
          </button>
        </div>
      </section>

      <section className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <h2 className="text-sm font-bold text-white">Approved Memory</h2>
        <div className="grid md:grid-cols-[240px_1fr_auto] gap-2">
          <input className="input-base" placeholder="Memory title" value={memoryTitle} onChange={(e) => setMemoryTitle(e.target.value)} />
          <input className="input-base" placeholder="Instruction, correction, workflow, route knowledge..." value={memoryContent} onChange={(e) => setMemoryContent(e.target.value)} />
          <button onClick={addMemory} disabled={saving} className="neon-btn px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> Add</button>
        </div>
        <div className="space-y-2">
          {(data.memory || []).map((item: AiMemory) => (
            <div key={item.id} className="rounded-xl p-3 flex gap-3 items-start" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
              <button onClick={async () => { await websiteApi.updateAiMemory(item.id, { enabled: !item.enabled }); await load(); }} className="text-[10px] font-bold px-2 py-1 rounded-lg" style={item.enabled ? { background: 'var(--accent-dim)', color: 'var(--accent-text)' } : { background: 'rgba(255,255,255,0.05)', color: 'var(--text-faint)' }}>
                {item.enabled ? 'ON' : 'OFF'}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{item.title}</p>
                <p className="text-xs mt-1 whitespace-pre-wrap" style={{ color: 'var(--text-muted)' }}>{item.content}</p>
              </div>
              <button onClick={async () => { await websiteApi.deleteAiMemory(item.id); await load(); }} className="p-2 rounded-lg bg-red-500/10 text-red-300"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-bold text-white">Recent AI Conversations</h2>
        </div>
        <div className="divide-y max-h-[420px] overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
          {(data.recentLogs || []).map((log: any) => (
            <div key={log.id} className="px-5 py-3 text-xs">
              <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--text-faint)' }}>
                <span className="font-bold uppercase">{log.role}</span>
                <span>{log.engine}</span>
                <span>{new Date(log.created_at).toLocaleString()}</span>
                {log.user_name && <span>{log.user_name}</span>}
              </div>
              <p className="whitespace-pre-wrap" style={{ color: 'var(--text-muted)' }}>{log.message}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-faint)' }}>{label}</p>
      <p className="text-2xl font-black text-white mt-1">{value.toLocaleString()}</p>
    </div>
  );
}
