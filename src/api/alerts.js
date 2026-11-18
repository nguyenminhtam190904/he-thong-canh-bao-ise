import { notifyUnauthorized } from '@/api/auth';

const SEVERITY_VALUES =new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);

function objectValue(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '') ?? null;
}

function fileNameFrom(value) {
  if (typeof value !== 'string') return null;
  const parts = value.split(/[\\/]/);
  return parts[parts.length - 1] || value;
}

export function normalizeAlert(row = {}) {
  const payload = objectValue(row.raw_payload);
  const agent = objectValue(payload.agent);
  const data = objectValue(payload.data);
  const syscheck = objectValue(payload.syscheck ?? data.syscheck);
  const win = objectValue(data.win);
  const eventdata = objectValue(win.eventdata);
  const rawFilePath = firstValue(
    eventdata.targetFilename,
    syscheck.path,
    data.path,
    data.file,
    data.filename,
    payload.file_path,
    payload.file
  );
  const filePath = typeof rawFilePath === 'string' ? rawFilePath : null;
  const rawSeverity = String(row.severity ?? 'INFO').toUpperCase();
  const severity = SEVERITY_VALUES.has(rawSeverity) ? rawSeverity.toLowerCase() : 'info';
  const quarantined = row.is_quarantined === true || row.is_quarantined === 'true';
  const agentId = firstValue(agent.id, payload.agent_id, data.agent_id);
  const agentName = firstValue(agent.name, agent.hostname, payload.agent_name, data.hostname);
  const agentOs = firstValue(agent.os?.name, agent.os?.platform, agent.os, payload.os);

  return {
    ...row,
    severity,
    severity_raw: rawSeverity,
    alert_type: row.alert_type ?? '—',
    description: row.description ?? '',
    timestamp: row.timestamp ?? null,
    detection_time: row.timestamp ?? null,
    status: quarantined ? 'quarantined' : 'detected',
    is_quarantined: quarantined,
    device_ip: row.device_ip ?? agent.ip ?? null,
    device_mac: row.device_mac ?? eventdata.mac ?? data.srcmac ?? null,
    file_path: filePath,
    file_name: fileNameFrom(filePath) ?? row.alert_type ?? 'Alert',
    threat_type: row.alert_type ?? 'Alert',
    agent_id: agentId,
    agent_name: agentName,
    agent_os: typeof agentOs === 'string' ? agentOs : null,
    file_hash: firstValue(syscheck.sha256_after, syscheck.sha256, data.sha256, eventdata.sha256),
    raw_payload: payload,
  };
}

export async function fetchAlerts() {
  const response = await fetch('/api/alerts', { headers: { Accept: 'application/json' } });
  notifyUnauthorized(response);
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.error || `Could not load alerts (${response.status}).`);
  }
  return Array.isArray(result?.data) ? result.data.map(normalizeAlert) : [];
}

export async function fetchDashboardSummary() {
  const response = await fetch('/api/dashboard-summary', { headers: { Accept: 'application/json' } });
  notifyUnauthorized(response);
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.error || `Could not load statistics (${response.status}).`);
  }
  return result;
}

export async function clearDeviceQuarantine(macAddress) {
  const response = await fetch('/api/agents/clear-quarantine', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ macAddress }),
  });
  notifyUnauthorized(response);
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.error || `Could not remove device quarantine (${response.status}).`);
  }
  return result;
}

export function downloadRows(filename, rows) {
  const columns = [
    ['id', 'ID'], ['severity_raw', 'Severity'], ['alert_type', 'Alert Type'],
    ['description', 'Description'], ['device_ip', 'IP'], ['device_mac', 'MAC'],
    ['agent_name', 'Agent'], ['agent_id', 'Agent ID'], ['file_name', 'File'],
    ['file_path', 'File Path'], ['timestamp', 'Timestamp'], ['status', 'Status'],
  ];
  const quote = (value) => {
    const text = String(value ?? '');
    const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safeText.replace(/"/g, '""')}"`;
  };
  const content = [
    columns.map(([, label]) => quote(label)).join(','),
    ...rows.map((row) => columns.map(([key]) => quote(row[key])).join(',')),
  ].join('\r\n');
  const blob = new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
