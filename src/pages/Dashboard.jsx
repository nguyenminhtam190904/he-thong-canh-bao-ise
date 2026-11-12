import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShieldAlert, TriangleAlert, ShieldCheck, ArrowUpRight,
  MonitorSmartphone, RefreshCw, Loader2,
} from 'lucide-react';
import { fetchAlerts, fetchDashboardSummary } from '@/api/alerts';
import StatCard from '@/components/StatCard';
import SeverityDonut from '@/components/SeverityDonut';
import TrendChart from '@/components/TrendChart';
import AlertTable from '@/components/AlertTable';
import { formatNumber, formatRelative, SEVERITIES } from '@/lib/format';
import { buildTrendSeries } from '@/lib/trend';

export default function Dashboard() {
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [severity, setSeverity] = useState(null);
  const [range, setRange] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nonce, setNonce] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, aggregateResult] = await Promise.all([
        fetchAlerts(),
        fetchDashboardSummary()
          .then((aggregate) => ({ aggregate }))
          .catch((summaryError) => ({ summaryError })),
      ]);
      setAlerts(rows);
      setSummary(aggregateResult.aggregate?.stats ?? null);
      setError(aggregateResult.summaryError
        ? `Could not load aggregate statistics: ${aggregateResult.summaryError.message}. Metrics are based on up to the 50 most recent alerts.`
        : '');
    } catch (loadError) {
      setError(loadError.message || 'Could not load data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, nonce]);

  const severityRows = useMemo(() => SEVERITIES.map((item) => ({
    severity: item.value,
    count: alerts.filter((alert) => alert.severity === item.value).length,
  })), [alerts]);
  const recent = alerts.filter((alert) => !severity || alert.severity === severity).slice(0, 8);
  const uniqueDevices = new Set(alerts.map((alert) => alert.agent_id || alert.device_ip || alert.device_mac).filter(Boolean)).size;
  const quarantined = Number(summary?.quarantined ?? alerts.filter((alert) => alert.is_quarantined).length);
  const total = Number(summary?.total ?? alerts.length);
  const warningCount = Number(summary ? Number(summary.high || 0) + Number(summary.medium || 0) : alerts.filter((alert) => ['high', 'medium'].includes(alert.severity)).length);
  const series = useMemo(() => buildTrendSeries(alerts, range), [alerts, range]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">NGuard · Overview</p>
          <h1 className="mt-2 font-display text-[26px] leading-tight tracking-tight sm:text-[30px]">System Overview</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {alerts[0]?.timestamp ? `Latest alert ${formatRelative(alerts[0].timestamp)}` : 'No alerts received from agents'}
            <span className="mx-1.5 text-muted-foreground/40">·</span> read-only API data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setNonce((value) => value + 1)} className="inline-flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
          </button>
          <Link to="/alerts" className="inline-flex items-center gap-2 rounded-lg border border-border/70 px-3.5 py-2 text-[12px] hover:border-primary/40 hover:text-primary">View all alerts <ArrowUpRight className="h-3.5 w-3.5" /></Link>
        </div>
      </div>
      {error && <p role="alert" className="rounded-lg border border-[#F2555A]/30 bg-[#F2555A]/10 px-4 py-3 text-[12px] text-[#F2555A]">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Alerts" value={formatNumber(total)} hint={summary ? 'Total in the database' : 'API records currently displayed'} icon={ShieldAlert} accent="#4FB39B" />
        <StatCard label="Quarantined" value={formatNumber(quarantined)} hint="Reported as quarantined by the API" icon={ShieldCheck} accent="#5B9DFF" />
        <StatCard label="Warnings" value={formatNumber(warningCount)} hint="High & medium severity" icon={TriangleAlert} accent="#E3B341" />
        <StatCard label="Observed Agents" value={formatNumber(uniqueDevices)} hint="Devices in the 50 most recent alerts" icon={MonitorSmartphone} accent="#F08A3C" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.05fr_1.95fr]">
        <section className="rounded-2xl border border-border/70 bg-card/60 p-5">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-display text-[14px]">By Severity</h2>
            {severity && <button type="button" onClick={() => setSeverity(null)} className="text-[11px] text-muted-foreground hover:text-foreground">Clear selection</button>}
          </div>
          <p className="mb-3 text-[11px] text-muted-foreground">Distribution across the 50 most recent alerts; select a severity to filter.</p>
          <SeverityDonut data={severityRows} active={severity} onSelect={(value) => setSeverity((current) => current === value ? null : value)} />
        </section>
        <section className="rounded-2xl border border-border/70 bg-card/60 p-5">
          <h2 className="mb-1 font-display text-[14px]">Alert Trends</h2>
          <p className="mb-2 text-[11px] text-muted-foreground">Based on alert records returned by the API (up to 50).</p>
          <TrendChart series={series} range={range} onRangeChange={setRange} />
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/60 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div><h2 className="font-display text-[14px]">Recent Alerts</h2><p className="mt-0.5 text-[11px] text-muted-foreground">{recent.length} records</p></div>
            <Link to={severity ? `/alerts?severity=${severity}` : '/alerts'} className="text-[11px] text-muted-foreground hover:text-primary">Open full list</Link>
          </div>
          <AlertTable alerts={recent} emptyLabel={loading ? 'Loading data…' : 'No alerts found.'} />
        </section>
        <section className="rounded-2xl border border-border/70 bg-card/60 p-5">
          <div className="flex items-center justify-between"><h2 className="font-display text-[14px]">Observed Devices</h2><MonitorSmartphone className="h-4 w-4 text-muted-foreground" /></div>
          <p className="mt-1 text-[11px] text-muted-foreground">Online/offline status is not inferred.</p>
          <div className="mt-5 rounded-xl border border-border/60 bg-white/[0.02] p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Devices in Recent Data</p>
            <p className="mt-2 font-display text-xl text-primary">{formatNumber(uniqueDevices)}</p>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">The API currently provides alerts only; it does not provide an agent list or connection status.</p>
          <Link to="/agents" className="mt-5 flex items-center justify-between rounded-xl border border-border/60 bg-white/[0.02] px-3 py-2.5 text-[12px] hover:border-primary/40 hover:text-primary">View devices inferred from alerts <ArrowUpRight className="h-3.5 w-3.5" /></Link>
        </section>
      </div>
    </motion.div>
  );
}
