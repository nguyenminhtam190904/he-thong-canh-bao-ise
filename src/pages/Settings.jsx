import { useState } from 'react';
import { Check } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

const STORAGE_KEY = 'malware-guard-user-settings-v1';
const DEFAULTS = {
  notify_new_alert: true,
  notify_critical: true,
  notify_agent_offline: true,
  notify_quarantined: false,
  auto_quarantine_critical: false,
  offline_threshold_minutes: 15,
};
const TOGGLES = [
  ['notify_new_alert', 'New agent alerts', 'Personal preference; does not create server notifications.'],
  ['notify_critical', 'Prioritize critical alerts', 'Personal preference; does not change alert severity.'],
  ['notify_agent_offline', 'Agent goes offline', 'The API does not report online/offline status.'],
  ['notify_quarantined', 'File quarantined', 'Personal preference; does not create server notifications.'],
  ['auto_quarantine_critical', 'Prioritize critical quarantine', 'Preference only; no quarantine command is sent to ISE.'],
];

function readSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...DEFAULTS, ...saved };
  } catch {
    return DEFAULTS;
  }
}

export default function Settings() {
  const [form, setForm] = useState(readSettings);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const update = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setSaved(false);
  };
  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...form,
        offline_threshold_minutes: Math.max(1, Number(form.offline_threshold_minutes) || 15),
      }));
      setError('');
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Could not save settings in this browser.');
    }
  };

  return (
    <div className="space-y-5">
      <div><p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">Settings</p><h1 className="mt-2 font-display text-[24px] sm:text-[28px]">System Settings</h1><p className="mt-1.5 text-[13px] text-muted-foreground">Preferences apply only to the current user in this browser.</p></div>
      <div role="note" className="rounded-lg border border-[#E3B341]/30 bg-[#E3B341]/[0.08] px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        Device quarantine can be removed from Devices & Agents. The preferences on this page are stored only in this browser's localStorage; they do not configure the server/ISE or apply notification rules.
      </div>
      {error && <p role="alert" className="text-[12px] text-[#F2555A]">{error}</p>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-border/70 bg-card/60 p-5">
          <h2 className="font-display text-[13px]">Notification Preferences (Local)</h2>
          <div className="mt-4 divide-y divide-border/40">
            {TOGGLES.map(([key, title, description]) => <div key={key} className="flex items-start justify-between gap-4 py-3.5">
              <div className="min-w-0"><p className="text-[12.5px] text-foreground/90">{title}</p><p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{description}</p></div>
              <Switch checked={Boolean(form[key])} onCheckedChange={(value) => update(key, value)} aria-label={title} />
            </div>)}
          </div>
        </section>
        <section className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-card/60 p-5">
            <h2 className="font-display text-[13px]">Offline Threshold (Local)</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">This preference is saved in the browser and is not used to infer agent status.</p>
            <div className="mt-4 flex items-center gap-2"><input type="number" min={1} value={form.offline_threshold_minutes} onChange={(event) => update('offline_threshold_minutes', Number(event.target.value))} className="h-9 w-24 rounded-lg border border-border/70 bg-white/[0.02] px-3 font-mono text-[12px]" /><span className="text-[11px] text-muted-foreground">minutes</span></div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card/60 p-5"><h2 className="font-display text-[13px]">Backend Capabilities</h2><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">The interface reads alerts and statistics and can remove device quarantine from Devices & Agents. It does not report online/offline connectivity, save these preferences, or support notes and agent management.</p></div>
          <button type="button" onClick={save} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[12px] font-medium text-primary-foreground hover:opacity-90">{saved && <Check className="h-3.5 w-3.5" />}{saved ? 'Saved in this browser' : 'Save Local Preferences'}</button>
        </section>
      </div>
    </div>
  );
}
