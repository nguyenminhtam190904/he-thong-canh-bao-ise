import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Check, Loader2 } from 'lucide-react';
import { fetchAlerts } from '@/api/alerts';
import { useLiveAlerts } from '@/lib/live-updates';
import SeverityBadge from '@/components/SeverityBadge';
import StatusBadge from '@/components/StatusBadge';
import { formatDateTime } from '@/lib/format';

export default function AlertDetail() {
  const { id } = useParams();
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const { version } = useLiveAlerts();

  useEffect(() => {
    fetchAlerts()
      .then((rows) => setAlert(rows.find((row) => String(row.id) === String(id)) ?? null))
      .catch((loadError) => setError(loadError.message || 'Could not load data.'))
      .finally(() => setLoading(false));
  }, [id, version]);

  const copyHash = async () => {
    if (!alert?.file_hash || !navigator.clipboard) return;
    await navigator.clipboard.writeText(alert.file_hash);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (loading) return <div className="flex items-center justify-center gap-2 py-24 text-[12px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading alert details…</div>;
  if (!alert) return (
    <div className="rounded-2xl border border-border/70 bg-card/60 px-6 py-20 text-center">
      <p className="font-display text-[16px]">Alert not found</p>
      <p className="mt-1.5 text-[12px] text-muted-foreground">{error || 'Details are available only for the 50 most recent records provided by the API.'}</p>
      <Link to="/alerts" className="mt-5 inline-flex items-center gap-1.5 text-[12px] text-primary hover:underline"><ArrowLeft className="h-3.5 w-3.5" /> Back to alerts</Link>
    </div>
  );

  const fields = [
    ['Alert Type', alert.alert_type],
    ['Device IP', alert.device_ip],
    ['Device MAC', alert.device_mac],
    ['Agent Name', alert.agent_name],
    ['Agent ID', alert.agent_id],
    ['File Path', alert.file_path],
    ['Timestamp', formatDateTime(alert.timestamp)],
    ['Record ID', alert.id],
  ];

  return (
    <div className="space-y-5">
      <Link to="/alerts" className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Alert List</Link>
      <section className="rounded-2xl border border-border/70 bg-card/60 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><SeverityBadge severity={alert.severity} /><StatusBadge status={alert.status} /><span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{alert.alert_type}</span></div>
            <h1 className="mt-3 break-all font-mono text-[20px] sm:text-[24px]">{alert.file_name}</h1>
            <p className="mt-1.5 text-[12px] text-muted-foreground">{alert.description || 'No description provided by the agent'} · {formatDateTime(alert.timestamp)}</p>
          </div>
          <p className="max-w-md rounded-lg border border-border/70 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">Quarantine can be removed from Devices & Agents. Status actions are not available from this alert detail view.</p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border/70 bg-card/60 p-5">
          <h2 className="font-display text-[13px]">Threat Details</h2>
          <dl className="mt-4 divide-y divide-border/40">
            {fields.map(([label, value]) => <div key={label} className="flex items-start justify-between gap-4 py-2.5"><dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</dt><dd className="max-w-[62%] break-words text-right font-mono text-[12px] text-foreground/90">{value || '—'}</dd></div>)}
            <div className="flex items-start justify-between gap-4 py-2.5"><dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Status</dt><dd><StatusBadge status={alert.status} /></dd></div>
          </dl>
        </section>
        <section className="rounded-2xl border border-border/70 bg-card/60 p-5">
          <h2 className="font-display text-[13px]">Detection Information</h2>
          <div className="mt-4 space-y-3">
            <div><p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Agent Description</p><p className="mt-1 whitespace-pre-line text-[12px] leading-relaxed text-foreground/90">{alert.description || '—'}</p></div>
            <div><p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">SHA-256</p><button type="button" onClick={copyHash} disabled={!alert.file_hash} className="mt-1 flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-2 text-left font-mono text-[10.5px] text-muted-foreground disabled:cursor-not-allowed"><span className="truncate">{alert.file_hash || 'Not available in payload'}</span>{copied ? <Check className="h-3 w-3 shrink-0 text-primary" /> : <Copy className="h-3 w-3 shrink-0" />}</button></div>
            <Link to={`/alerts?q=${encodeURIComponent(alert.device_ip ?? '')}`} className="inline-flex text-[11px] text-primary hover:underline">View alerts for this device →</Link>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-border/70 bg-card/60 p-5">
        <h2 className="font-display text-[13px]">Raw Agent Payload</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">Data is displayed as safe text; the API does not provide status change history.</p>
        <pre className="mt-4 max-h-[420px] overflow-auto rounded-lg border border-border/60 bg-black/20 p-3 text-[11px] leading-relaxed text-muted-foreground">{JSON.stringify(alert.raw_payload, null, 2)}</pre>
      </section>
    </div>
  );
}
