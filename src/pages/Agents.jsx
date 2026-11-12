import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MonitorSmartphone, Search, Loader2, ArrowUpRight } from 'lucide-react';
import { fetchAlerts } from '@/api/alerts';
import { formatDateTime, formatNumber } from '@/lib/format';

function collectAgents(alerts) {
  const grouped = new Map();
  alerts.forEach((alert) => {
    const key = alert.agent_id || alert.agent_name || alert.device_ip || alert.device_mac;
    if (!key) return;
    const current = grouped.get(String(key)) || {
      id: String(key), agent_id: alert.agent_id, hostname: alert.agent_name,
      ip: alert.device_ip, mac: alert.device_mac, os: alert.agent_os,
      count: 0, lastAlert: alert.timestamp,
    };
    current.count += 1;
    if (alert.timestamp && (!current.lastAlert || new Date(alert.timestamp) > new Date(current.lastAlert))) current.lastAlert = alert.timestamp;
    current.hostname ||= alert.agent_name;
    current.ip ||= alert.device_ip;
    current.mac ||= alert.device_mac;
    current.os ||= alert.agent_os;
    grouped.set(String(key), current);
  });
  return [...grouped.values()].sort((a, b) => new Date(b.lastAlert || 0) - new Date(a.lastAlert || 0));
}

export default function Agents() {
  const [alerts, setAlerts] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    fetchAlerts().then(setAlerts).catch((loadError) => setError(loadError.message || 'Could not load data.')).finally(() => setLoading(false));
  }, []);

  const agents = useMemo(() => collectAgents(alerts), [alerts]);
  const filtered = agents.filter((agent) => [agent.agent_id, agent.hostname, agent.ip, agent.mac, agent.os]
    .some((value) => String(value ?? '').toLocaleLowerCase().includes(q.trim().toLocaleLowerCase())));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">Device management</p>
        <h1 className="mt-2 font-display text-[24px] sm:text-[28px]">Devices & Agents</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Devices are inferred from the 50 most recent alert payloads; there is no dedicated agent API.</p>
      </div>
      {error && <p role="alert" className="rounded-lg border border-[#F2555A]/30 bg-[#F2555A]/10 px-4 py-3 text-[12px] text-[#F2555A]">{error}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-card/60 p-5"><div className="flex items-center justify-between"><p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Observed Devices</p><MonitorSmartphone className="h-4 w-4 text-muted-foreground" /></div><p className="mt-4 font-display text-2xl">{formatNumber(agents.length)}</p></div>
        <div className="rounded-2xl border border-border/70 bg-card/60 p-5"><p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Alerts from Devices</p><p className="mt-4 font-display text-2xl text-primary">{formatNumber(alerts.length)}</p></div>
      </div>
      <section className="rounded-2xl border border-border/70 bg-card/60 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search hostname, IP, MAC, or agent ID…" className="h-9 w-full rounded-lg border border-border/70 bg-white/[0.02] pl-9 pr-3 text-[12px] focus:border-primary/40 focus:outline-none" />
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/60">
        {loading ? <div className="flex items-center justify-center gap-2 py-20 text-[12px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading from alerts…</div> : filtered.length === 0 ? <div className="px-6 py-16 text-center text-sm text-muted-foreground">{error || 'Current alert payloads contain no agent information matching your filter.'}</div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left">
              <thead><tr className="border-b border-border/70">{['Device', 'Agent ID', 'IP / MAC', 'Operating System', 'Observed Alerts', 'Last Seen in Alert', ''].map((heading) => <th key={heading} className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{heading}</th>)}</tr></thead>
              <tbody>{filtered.map((agent) => <tr key={agent.id} className="border-b border-border/40 last:border-0 hover:bg-white/[0.025]">
                <td className="px-4 py-3 text-[12.5px] text-foreground/90">{agent.hostname || 'Unknown hostname'}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{agent.agent_id || '—'}</td>
                <td className="px-4 py-3"><p className="font-mono text-[12px]">{agent.ip || '—'}</p><p className="font-mono text-[10px] text-muted-foreground">{agent.mac || '—'}</p></td>
                <td className="px-4 py-3 text-[11.5px] text-muted-foreground">{agent.os || '—'}</td>
                <td className="px-4 py-3 font-mono text-[12px]">{formatNumber(agent.count)}</td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-[10.5px] text-muted-foreground">{formatDateTime(agent.lastAlert)}</td>
                <td className="px-4 py-3 text-right"><Link to={`/alerts?q=${encodeURIComponent(agent.ip || agent.agent_id || '')}`} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary">Alerts <ArrowUpRight className="h-3 w-3" /></Link></td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
