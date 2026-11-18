import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Download, ChevronLeft, ChevronRight, RotateCcw, Loader2 } from 'lucide-react';
import { fetchAlerts, downloadRows } from '@/api/alerts';
import AlertTable from '@/components/AlertTable';
import SelectField from '@/components/SelectField';
import { SEVERITIES, STATUSES, formatNumber } from '@/lib/format';
import { useLiveAlerts } from '@/lib/live-updates';

const PAGE_SIZE = 10;

export default function Alerts() {
  const [params] = useSearchParams();
  const [alerts, setAlerts] = useState([]);
  const [q, setQ] = useState(params.get('q') ?? '');
  const [severity, setSeverity] = useState(params.get('severity')?.toLowerCase() ?? 'all');
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { version } = useLiveAlerts();

  useEffect(() => {
    fetchAlerts()
      .then(setAlerts)
      .catch((loadError) => setError(loadError.message || 'Could not load alerts.'))
      .finally(() => setLoading(false));
  }, [version]);

  useEffect(() => { setPage(0); }, [q, severity, status, from, to]);

  const filtered = useMemo(() => {
    const term = q.trim().toLocaleLowerCase();
    const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : -Infinity;
    const toTime = to ? new Date(`${to}T23:59:59.999`).getTime() : Infinity;
    return alerts.filter((alert) => {
      const timestamp = alert.timestamp ? new Date(alert.timestamp).getTime() : NaN;
      const textMatches = !term || [
        alert.file_name, alert.description, alert.alert_type, alert.device_ip,
        alert.device_mac, alert.agent_name, alert.agent_id, alert.file_path,
      ].some((value) => String(value ?? '').toLocaleLowerCase().includes(term));
      return textMatches &&
        (severity === 'all' || alert.severity === severity) &&
        (status === 'all' || alert.status === status) &&
        (!from || (Number.isFinite(timestamp) && timestamp >= fromTime)) &&
        (!to || (Number.isFinite(timestamp) && timestamp <= toTime));
    });
  }, [alerts, q, severity, status, from, to]);

  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clearFilters = () => {
    setQ('');
    setSeverity('all');
    setStatus('all');
    setFrom('');
    setTo('');
  };
  const exportFiltered = () => downloadRows('alerts.csv', filtered);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">Threat management</p>
          <h1 className="mt-2 font-display text-[24px] sm:text-[28px]">Alert List</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">{formatNumber(filtered.length)} / {formatNumber(alerts.length)} matching API records · API is currently limited to 50 records</p>
        </div>
        <button type="button" onClick={exportFiltered} disabled={!filtered.length} className="inline-flex items-center gap-2 rounded-lg border border-border/70 px-3.5 py-2 text-[12px] hover:border-primary/40 hover:text-primary disabled:opacity-50">
          <Download className="h-3.5 w-3.5" /> Export Filtered CSV
        </button>
      </div>

      {error && <p role="alert" className="rounded-lg border border-[#F2555A]/30 bg-[#F2555A]/10 px-4 py-3 text-[12px] text-[#F2555A]">{error}</p>}
      <section className="rounded-2xl border border-border/70 bg-card/60 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
          <div className="relative xl:col-span-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search file, description, IP, MAC, or agent…" className="h-9 w-full rounded-lg border border-border/70 bg-white/[0.02] pl-9 pr-3 text-[12px] focus:border-primary/40 focus:outline-none" />
          </div>
          <div className="xl:col-span-2"><SelectField value={severity} onChange={setSeverity} options={[{ value: 'all', label: 'All severities' }, ...SEVERITIES.map(({ value, label }) => ({ value, label }))]} /></div>
          <div className="xl:col-span-2"><SelectField value={status} onChange={setStatus} options={[{ value: 'all', label: 'All statuses' }, ...STATUSES.map(({ value, label }) => ({ value, label }))]} /></div>
          <div className="flex items-center gap-2 xl:col-span-4">
            <input aria-label="From date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-9 w-full rounded-lg border border-border/70 bg-white/[0.02] px-2.5 text-[12px]" />
            <span className="text-[11px] text-muted-foreground">→</span>
            <input aria-label="To date" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-9 w-full rounded-lg border border-border/70 bg-white/[0.02] px-2.5 text-[12px]" />
          </div>
        </div>
        {(q || severity !== 'all' || status !== 'all' || from || to) && (
          <button type="button" onClick={clearFilters} className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"><RotateCcw className="h-3 w-3" /> Clear filters</button>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/60">
        {loading ? <div className="flex items-center justify-center gap-2 py-20 text-[12px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading alerts…</div> : <AlertTable alerts={pageItems} emptyLabel={error ? 'Could not load data.' : 'No alerts match your filters.'} />}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
          <p className="text-[11px] text-muted-foreground">Page {page + 1} / {pageCount} · {formatNumber(filtered.length)} results</p>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0 || loading} className="inline-flex items-center gap-1 rounded-lg border border-border/70 px-2.5 py-1.5 text-[11px] disabled:opacity-40"><ChevronLeft className="h-3 w-3" /> Previous</button>
            <button type="button" onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} disabled={page >= pageCount - 1 || loading} className="inline-flex items-center gap-1 rounded-lg border border-border/70 px-2.5 py-1.5 text-[11px] disabled:opacity-40">Next <ChevronRight className="h-3 w-3" /></button>
          </div>
        </div>
      </section>
    </div>
  );
}
