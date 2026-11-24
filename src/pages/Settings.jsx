import { useEffect, useState } from 'react';
import { Check, CheckCircle2, Loader2, PlugZap, XCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import SelectField from '@/components/SelectField';
import { fetchSettings, testIseConnection, updateSettings } from '@/api/settings';
import { formatDateTime } from '@/lib/format';

const THRESHOLD_LABELS = {
  HIGH: 'HIGH and CRITICAL',
  CRITICAL: 'CRITICAL only',
};

const cardClass = 'rounded-2xl border border-border/70 bg-card/60 p-5';

export default function Settings() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    fetchSettings()
      .then((result) => {
        setData(result);
        setForm(result.settings);
      })
      .catch((loadError) => setError(loadError.message || 'Could not load settings.'))
      .finally(() => setLoading(false));
  }, []);

  const canEdit = Boolean(data?.canEdit);
  const dirty = Boolean(form && data && JSON.stringify(form) !== JSON.stringify(data.settings));

  const update = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const result = await updateSettings(form);
      setData((previous) => ({ ...previous, settings: result.settings, meta: result.meta }));
      setForm(result.settings);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (saveError) {
      setError(saveError.message || 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await testIseConnection());
    } catch (testError) {
      setTestResult({ ok: false, error: testError.message });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center gap-2 py-20 text-[12px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading settings…</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">Settings</p>
        <h1 className="mt-2 font-display text-[24px] sm:text-[28px]">System Settings</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Saved on the server and applied immediately to every new alert, for all users.</p>
      </div>

      {error && <p role="alert" className="rounded-lg border border-[#F2555A]/30 bg-[#F2555A]/10 px-4 py-3 text-[12px] text-[#F2555A]">{error}</p>}
      {data && !canEdit && (
        <p role="note" className="rounded-lg border border-[#E3B341]/30 bg-[#E3B341]/[0.08] px-4 py-3 text-[12px] text-muted-foreground">
          Only administrators can change these settings. You can still test the Cisco ISE connection.
        </p>
      )}

      {form && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
          <section className={cardClass}>
            <h2 className="font-display text-[14px]">Automatic Quarantine</h2>
            <p className="mt-1 text-[11.5px] text-muted-foreground">When an alert arrives from Wazuh, the server sends the device MAC to Cisco ISE (ANC apply) according to these rules.</p>

            <div className="mt-4 divide-y divide-border/40">
              <div className="flex items-start justify-between gap-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-[12.5px] text-foreground/90">Quarantine devices automatically</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">When off, alerts are still recorded but nothing is sent to ISE. Devices can still be released from Devices & Agents.</p>
                </div>
                <Switch
                  checked={Boolean(form.auto_quarantine_enabled)}
                  onCheckedChange={(value) => update('auto_quarantine_enabled', value)}
                  disabled={!canEdit}
                  aria-label="Quarantine devices automatically"
                />
              </div>

              <div className="grid gap-2 py-3.5 sm:grid-cols-[1fr_220px] sm:items-center sm:gap-4">
                <div className="min-w-0">
                  <p className="text-[12.5px] text-foreground/90">Minimum severity</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">Alerts at or above this level trigger quarantine.</p>
                </div>
                <fieldset disabled={!canEdit || !form.auto_quarantine_enabled} className="disabled:opacity-60">
                  <SelectField
                    value={form.auto_quarantine_min_severity}
                    onChange={(value) => update('auto_quarantine_min_severity', value)}
                    options={(data.thresholds || ['HIGH', 'CRITICAL']).map((value) => ({ value, label: THRESHOLD_LABELS[value] || value }))}
                  />
                </fieldset>
              </div>

              <label className="grid gap-2 py-3.5 sm:grid-cols-[1fr_220px] sm:items-center sm:gap-4">
                <span className="min-w-0">
                  <span className="block text-[12.5px] text-foreground/90">ISE ANC policy name</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">Must match an ANC policy that exists in Cisco ISE exactly.</span>
                </span>
                <input
                  value={form.ise_quarantine_policy}
                  onChange={(event) => update('ise_quarantine_policy', event.target.value)}
                  disabled={!canEdit}
                  maxLength={64}
                  className="h-9 w-full rounded-lg border border-border/70 bg-white/[0.02] px-3 font-mono text-[12px] focus:border-primary/40 focus:outline-none disabled:opacity-60"
                />
              </label>
            </div>

            {canEdit && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] text-muted-foreground">
                  {data.meta?.updated_at
                    ? `Last changed ${formatDateTime(data.meta.updated_at)}${data.meta.updated_by ? ` by ${data.meta.updated_by}` : ''}`
                    : 'Using default values'}
                </p>
                <button
                  type="button"
                  onClick={save}
                  disabled={!dirty || saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-[12px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : null}
                  {saving ? 'Saving…' : saved ? 'Saved' : 'Save settings'}
                </button>
              </div>
            )}
          </section>

          <section className={cardClass}>
            <h2 className="font-display text-[14px]">Cisco ISE Connection</h2>
            <p className="mt-1 text-[11.5px] text-muted-foreground">Address and credentials come from the server's .env file (ISE_BASE_URL, ISE_USER, ISE_PASSWORD).</p>

            <dl className="mt-4 space-y-2 text-[12px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">ISE address</dt>
                <dd className="font-mono text-foreground/90">{data.ise?.host || '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Configuration</dt>
                <dd className={data.ise?.configured ? 'text-[#65D9A5]' : 'text-[#F2555A]'}>{data.ise?.configured ? 'Configured' : 'Missing values in .env'}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={runTest}
              disabled={testing}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border/70 px-4 py-2 text-[12px] hover:border-primary/40 hover:text-primary disabled:opacity-60"
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
              {testing ? 'Testing connection…' : 'Test connection'}
            </button>

            {testResult && (
              <div
                role="status"
                className={`mt-4 rounded-lg border px-3 py-2.5 text-[12px] ${testResult.ok ? 'border-[#35C98A]/30 bg-[#35C98A]/10' : 'border-[#F2555A]/30 bg-[#F2555A]/10'}`}
              >
                {testResult.ok ? (
                  <>
                    <p className="flex items-center gap-1.5 text-[#65D9A5]"><CheckCircle2 className="h-3.5 w-3.5" /> Connected to Cisco ISE ({testResult.latencyMs} ms)</p>
                    <p className={`mt-1.5 ${testResult.policyFound ? 'text-muted-foreground' : 'text-[#E3B341]'}`}>
                      {testResult.policyFound
                        ? `ANC policy "${testResult.policyName}" exists.`
                        : `ANC policy "${testResult.policyName}" was not found in ISE${testResult.policies?.length ? ` (available: ${testResult.policies.join(', ')})` : ''}.`}
                    </p>
                  </>
                ) : (
                  <p className="flex items-start gap-1.5 text-[#F2555A]"><XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {testResult.error}</p>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
