import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { fetchAlerts, downloadRows } from '@/api/alerts';
import StatCard from '@/components/StatCard';
import TrendChart from '@/components/TrendChart';
import SeverityBars from '@/components/SeverityBars';
import { SEVERITIES, formatNumber } from '@/lib/format';
import { buildTrendSeries, countBy } from '@/lib/trend';

const COLORS = ['#F2555A', '#F08A3C', '#E3B341', '#5B9DFF', '#4FB39B', '#A78BFA'];

export default function Reports() {
  const [alerts, setAlerts] = useState([]);
  const [range, setRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    fetchAlerts().then(setAlerts).catch((loadError) => setError(loadError.message || 'Could not load data.')).finally(() => setLoading(false));
  }, []);

  const severityRows = useMemo(() => SEVERITIES.map((severity) => ({
    value: severity.value, label: severity.label, color: severity.color,
    count: alerts.filter((alert) => alert.severity === severity.value).length,
  })), [alerts]);
  const threatRows = Object.entries(countBy(alerts, 'alert_type'))
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([name, count], index) => ({ name, count, color: COLORS[index] }));
  const series = useMemo(() => buildTrendSeries(alerts, range), [alerts, range]);
  const uniqueDevices = new Set(alerts.map((alert) => alert.agent_id || alert.device_ip || alert.device_mac).filter(Boolean)).size;
  const quarantined = alerts.filter((alert) => alert.is_quarantined).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">Reports</p><h1 className="mt-2 font-display text-[24px] sm:text-[28px]">Reports & Analytics</h1><p className="mt-1.5 text-[13px] text-muted-foreground">Statistics and exported files are based on data provided by the API.</p></div>
        <button type="button" onClick={() => downloadRows('alert-report.csv', alerts)} disabled={!alerts.length || loading} className="inline-flex items-center gap-2 rounded-lg border border-border/70 px-3.5 py-2 text-[12px] hover:border-primary/40 hover:text-primary disabled:opacity-50"><Download className="h-3.5 w-3.5" /> Export Alerts CSV</button>
      </div>
      <div className="rounded-lg border border-border/70 bg-card/60 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        Only the 50 most recent alerts are available from the API. No agent data, activity history, resolution status, or metrics not provided by the API are fabricated or exported.
      </div>
      {error && <p role="alert" className="rounded-lg border border-[#F2555A]/30 bg-[#F2555A]/10 px-4 py-3 text-[12px] text-[#F2555A]">{error}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="API Alerts" value={formatNumber(alerts.length)} hint="Up to 50 most recent records" accent="#4FB39B" />
        <StatCard label="Observed Devices" value={formatNumber(uniqueDevices)} hint="Inferred from alert payloads" accent="#F08A3C" />
        <StatCard label="Quarantined" value={formatNumber(quarantined)} hint="Current status from the API" accent="#5B9DFF" />
        <StatCard label="Critical" value={formatNumber(alerts.filter((alert) => alert.severity === 'critical').length)} hint="Among records returned by the API" accent="#F2555A" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.9fr_1.1fr]">
        <section className="rounded-2xl border border-border/70 bg-card/60 p-5">
          <h2 className="mb-1 font-display text-[13px]">Alert Trends</h2>
          <p className="mb-2 text-[11px] text-muted-foreground">Based on the most recent data available.</p>
          {loading ? <div className="flex h-[236px] items-center justify-center gap-2 text-[12px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Calculating…</div> : <TrendChart series={series} range={range} onRangeChange={setRange} />}
        </section>
        <div className="space-y-4">
          <section className="rounded-2xl border border-border/70 bg-card/60 p-5"><h2 className="mb-4 font-display text-[13px]">By Severity · Up to 50</h2><SeverityBars rows={severityRows} /></section>
          <section className="rounded-2xl border border-border/70 bg-card/60 p-5">
            <h2 className="mb-4 font-display text-[13px]">Common Alert Types</h2>
            {threatRows.length === 0 ? <p className="text-[12px] text-muted-foreground">No data available.</p> : <div className="space-y-2.5">{threatRows.map((row) => <div key={row.name} className="flex items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full" style={{ background: row.color }} /><span className="flex-1 truncate text-[12px]">{row.name}</span><span className="font-mono text-[11px] text-muted-foreground">{row.count}</span></div>)}</div>}
          </section>
        </div>
      </div>
      <section className="rounded-2xl border border-border/70 bg-card/60 p-5">
        <h2 className="font-display text-[13px]">Exported Data</h2>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">The CSV contains only alerts actually retrieved: ID, severity, type, description, IP/MAC, agent, and file metadata when provided in the payload. Missing fields are left blank.</p>
      </section>
    </div>
  );
}
