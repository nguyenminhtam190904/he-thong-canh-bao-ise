import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { History as HistoryIcon, Loader2, Search } from 'lucide-react';
import { fetchAlerts } from '@/api/alerts';
import SelectField from '@/components/SelectField';
import { formatDateTime } from '@/lib/format';
import { useLiveAlerts } from '@/lib/live-updates';

const ACTION_OPTIONS = [
  { value: 'all', label: 'All alerts' },
  { value: 'detected', label: 'Not quarantined (current)' },
  { value: 'quarantined', label: 'Quarantined (current)' },
];

export default function History() {
  const [alerts, setAlerts] = useState([]);
  const [action, setAction] = useState('all');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState('');
  const [nonce, setNonce] = useState(0);

  const { version } = useLiveAlerts();
  useEffect(() => {
    setLoading(true);
    fetchAlerts().then(setAlerts).catch((error) => setLoadingError(error.message || 'Could not load data.')).finally(() => setLoading(false));
  }, [nonce, version]);

  const entries = useMemo(() => alerts.filter((alert) => {
    const term = q.trim().toLocaleLowerCase();
    const matchesText = !term || [alert.file_name, alert.description, alert.device_ip, alert.device_mac, alert.agent_name]
      .some((value) => String(value ?? '').toLocaleLowerCase().includes(term));
    return matchesText && (action === 'all' || alert.status === action);
  }), [alerts, q, action]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">Event history</p>
          <h1 className="mt-2 font-display text-[24px] sm:text-[28px]">Detection History</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">Alert records are shown by creation time; there is no API for status change history.</p>
        </div>
        <button type="button" onClick={() => setNonce((value) => value + 1)} className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-3 py-2 text-[11.5px] text-muted-foreground hover:text-foreground"><HistoryIcon className="h-3.5 w-3.5" /> Refresh</button>
      </div>
      {loadingError && <p role="alert" className="rounded-lg border border-[#F2555A]/30 bg-[#F2555A]/10 px-4 py-3 text-[12px] text-[#F2555A]">{loadingError}</p>}
      <section className="rounded-2xl border border-border/70 bg-card/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search file, description, IP, or agent…" className="h-9 w-full rounded-lg border border-border/70 bg-white/[0.02] pl-9 pr-3 text-[12px] focus:border-primary/40 focus:outline-none" /></div>
          <div className="sm:w-56"><SelectField value={action} onChange={setAction} options={ACTION_OPTIONS} /></div>
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/60">
        {loading ? <div className="flex items-center justify-center gap-2 py-20 text-[12px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading records…</div> : entries.length === 0 ? <div className="px-6 py-16 text-center text-sm text-muted-foreground">{loadingError || 'No records match your filters.'}</div> : (
          <ul className="divide-y divide-border/40">
            {entries.map((alert) => <li key={alert.id} className="flex flex-col gap-2 px-4 py-3.5 hover:bg-white/[0.02] sm:flex-row sm:items-center">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: alert.is_quarantined ? '#5B9DFF' : '#E3B341' }} />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] text-foreground/90">Alert recorded · <Link to={`/alerts/${alert.id}`} className="font-mono text-[11.5px] text-primary hover:underline">{alert.file_name || alert.description || `#${alert.id}`}</Link></p>
                <p className="mt-1 text-[11.5px] text-muted-foreground">{alert.severity_raw} · {alert.alert_type} · Current status: {alert.is_quarantined ? 'Quarantined' : 'Not quarantined'}</p>
              </div>
              <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground/80">{formatDateTime(alert.timestamp)}</span>
            </li>)}
          </ul>
        )}
        {!loading && alerts.length >= 50 && <p className="border-t border-border/60 px-4 py-3 text-[10px] text-muted-foreground">The API returns only the 50 most recent alerts; no history pagination endpoint is available.</p>}
      </section>
    </div>
  );
}
