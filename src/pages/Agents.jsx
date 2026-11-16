import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MonitorSmartphone, Search, Loader2, ArrowUpRight, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import { clearDeviceQuarantine, fetchAlerts } from '@/api/alerts';
import { formatDateTime, formatNumber } from '@/lib/format';

function collectAgents(alerts) {
  const grouped = new Map();
  alerts.forEach((alert) => {
    const key = alert.agent_id || alert.agent_name || alert.device_ip || alert.device_mac;
    if (!key) return;
    const current = grouped.get(String(key)) || {
      id: String(key), agent_id: alert.agent_id, hostname: alert.agent_name,
      ip: alert.device_ip, mac: alert.device_mac, os: alert.agent_os,
      count: 0, lastAlert: alert.timestamp, statusTimestamp: 0,
    };
    current.count += 1;
    const alertTimestamp = alert.timestamp ? new Date(alert.timestamp).getTime() : 0;
    if (alert.timestamp && (!current.lastAlert || alertTimestamp > new Date(current.lastAlert).getTime())) current.lastAlert = alert.timestamp;
    if (alertTimestamp >= current.statusTimestamp) {
      current.is_quarantined = alert.is_quarantined;
      current.statusTimestamp = alertTimestamp;
    }
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
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [clearError, setClearError] = useState('');
  const [clearing, setClearing] = useState(false);
  const confirmationDialogRef = useRef(null);
  useEffect(() => {
    fetchAlerts().then(setAlerts).catch((loadError) => setError(loadError.message || 'Could not load data.')).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    const dialog = confirmationDialogRef.current;
    if (!dialog) return;
    if (selectedAgent && !dialog.open) dialog.showModal();
    else if (!selectedAgent && dialog.open) dialog.close();
  }, [selectedAgent]);
  useEffect(() => {
    if (!openMenu) return undefined;
    const closeMenu = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.type === 'pointerdown' && event.target instanceof Element
        && event.target.closest('[data-quarantine-menu], [data-quarantine-trigger]')) return;
      setOpenMenu(null);
    };
    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [openMenu]);

  const agents = useMemo(() => collectAgents(alerts), [alerts]);
  const filtered = agents.filter((agent) => [agent.agent_id, agent.hostname, agent.ip, agent.mac, agent.os]
    .some((value) => String(value ?? '').toLocaleLowerCase().includes(q.trim().toLocaleLowerCase())));

  async function handleClearQuarantine() {
    if (!selectedAgent?.mac) return;
    setClearError('');
    setClearing(true);
    try {
      await clearDeviceQuarantine(selectedAgent.mac);
      const normalizedMac = selectedAgent.mac.toLowerCase();
      setAlerts((current) => current.map((alert) => (
        String(alert.device_mac ?? '').toLowerCase() === normalizedMac
          ? { ...alert, is_quarantined: false, status: 'detected' }
          : alert
      )));
      setSelectedAgent(null);
    } catch (clearRequestError) {
      setClearError(clearRequestError.message || 'Could not remove device quarantine.');
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">Device management</p>
        <h1 className="mt-2 font-display text-[24px] sm:text-[28px]">Devices & Agents</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Devices are inferred from the 50 most recent alert payloads. Status shows quarantine state; online/offline connectivity is not provided by the API.</p>
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
            <table className="w-full min-w-[790px] border-collapse text-left">
              <thead><tr className="border-b border-border/70">{['Device', 'Agent ID', 'IP / MAC', 'Operating System', 'Status', 'Observed Alerts', 'Last Seen in Alert', ''].map((heading) => <th key={heading} className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{heading}</th>)}</tr></thead>
              <tbody>{filtered.map((agent) => <tr key={agent.id} className="border-b border-border/40 last:border-0 hover:bg-white/[0.025]">
                <td className="px-4 py-3 text-[12.5px] text-foreground/90">{agent.hostname || 'Unknown hostname'}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{agent.agent_id || '—'}</td>
                <td className="px-4 py-3"><p className="font-mono text-[12px]">{agent.ip || '—'}</p><p className="font-mono text-[10px] text-muted-foreground">{agent.mac || '—'}</p></td>
                <td className="px-4 py-3 text-[11.5px] text-muted-foreground">{agent.os || '—'}</td>
                <td className="px-4 py-3">
                  {agent.is_quarantined ? (
                    <button
                      type="button"
                      data-quarantine-trigger
                      aria-haspopup="menu"
                      aria-expanded={openMenu?.agent.id === agent.id}
                      onClick={(event) => {
                        if (openMenu?.agent.id === agent.id) {
                          setOpenMenu(null);
                          return;
                        }
                        const bounds = event.currentTarget.getBoundingClientRect();
                        setOpenMenu({
                          agent,
                          top: Math.min(bounds.bottom + 4, window.innerHeight - 48),
                          left: Math.min(Math.max(bounds.left, 8), Math.max(8, window.innerWidth - 184)),
                        });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#5B9DFF]/30 bg-[#5B9DFF]/10 px-2.5 py-1 text-[10.5px] text-[#8DBBFF] hover:bg-[#5B9DFF]/15"
                    >
                      Quarantined <ChevronDown className="h-3 w-3" />
                    </button>
                  ) : (
                    <span title="Not reported as quarantined; online/offline connectivity is not available." className="inline-flex rounded-full border border-[#35C98A]/25 bg-[#35C98A]/10 px-2.5 py-1 text-[10.5px] text-[#65D9A5]">Running</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-[12px]">{formatNumber(agent.count)}</td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-[10.5px] text-muted-foreground">{formatDateTime(agent.lastAlert)}</td>
                <td className="px-4 py-3 text-right"><Link to={`/alerts?q=${encodeURIComponent(agent.ip || agent.agent_id || '')}`} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary">Alerts <ArrowUpRight className="h-3 w-3" /></Link></td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
      {openMenu && createPortal(
        <div
          data-quarantine-menu
          role="menu"
          className="fixed z-[110] min-w-[176px] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
          style={{ top: openMenu.top, left: openMenu.left }}
        >
          <button
            type="button"
            role="menuitem"
            disabled={!openMenu.agent.mac}
            onClick={() => {
              setClearError('');
              setSelectedAgent(openMenu.agent);
              setOpenMenu(null);
            }}
            className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            Remove quarantine
          </button>
        </div>,
        document.body
      )}
      {createPortal(
        <dialog
          ref={confirmationDialogRef}
          aria-labelledby={clearing ? undefined : 'clear-quarantine-title'}
          aria-describedby={clearing ? undefined : 'clear-quarantine-description'}
          aria-label={clearing ? 'Removing device quarantine' : undefined}
          onCancel={(event) => {
            if (clearing) {
              event.preventDefault();
              return;
            }
            setSelectedAgent(null);
            setClearError('');
          }}
          style={{ inset: 'auto', position: 'fixed', left: '50vw', top: '50vh', right: 'auto', bottom: 'auto', margin: 0, transform: 'translate(-50%, -50%)' }}
          className="w-[calc(100%-2rem)] max-w-lg rounded-xl border border-border bg-background p-6 text-foreground shadow-lg backdrop:bg-black/80"
        >
          {clearing ? (
            <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-3 py-12 text-center text-sm text-muted-foreground">
              <Loader2 className="h-10 w-10 animate-spin text-primary" aria-label="Removing quarantine" />
              <span>Removing quarantine…</span>
            </div>
          ) : (
            <>
              <h2 id="clear-quarantine-title" className="text-lg font-semibold">Remove device quarantine?</h2>
              <p id="clear-quarantine-description" className="mt-2 text-sm text-muted-foreground">
                This will remove quarantine for {selectedAgent?.hostname || selectedAgent?.mac || 'this device'} in Cisco ISE.
              </p>
              {clearError && <p role="alert" className="mt-4 rounded-lg border border-[#F2555A]/30 bg-[#F2555A]/10 px-3 py-2 text-[12px] text-[#F2555A]">{clearError}</p>}
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => { setSelectedAgent(null); setClearError(''); }} className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-transparent px-4 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
                  Cancel
                </button>
                <button type="button" onClick={handleClearQuarantine} className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
                  Remove quarantine
                </button>
              </div>
            </>
          )}
        </dialog>,
        document.body
      )}
    </div>
  );
}
