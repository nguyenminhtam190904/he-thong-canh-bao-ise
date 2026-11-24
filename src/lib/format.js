import { format, formatDistanceToNow } from 'date-fns';
import { enUS } from 'date-fns/locale';

export const SEVERITIES = [
    { value: 'info', label: 'Informational', short: 'Info', color: '#8A90A0' },
    { value: 'critical', label: 'Critical', short: 'Critical', color: '#F2555A' },
    { value: 'high', label: 'High', short: 'High', color: '#F08A3C' },
    { value: 'medium', label: 'Medium', short: 'Medium', color: '#E3B341' },
    { value: 'low', label: 'Low', short: 'Low', color: '#4FB39B' },
];

export const STATUSES = [
    { value: 'detected', label: 'Detected', color: '#E3B341' },
    { value: 'quarantined', label: 'Quarantined', color: '#5B9DFF' },
    { value: 'quarantine_failed', label: 'Quarantine failed', color: '#F2555A' },
];

export const severityMeta = (value) =>
    SEVERITIES.find((s) => s.value === String(value ?? '').toLowerCase()) ?? SEVERITIES[0];

export const statusMeta = (value) =>
    STATUSES.find((s) => s.value === value) ?? STATUSES[0];

export const severityLabel = (value) => severityMeta(value).label;
export const statusLabel = (value) => statusMeta(value).label;

export const formatNumber = (value) =>
    new Intl.NumberFormat('en-US').format(value ?? 0);

export const formatPercent = (value) =>
    `${(Number.isFinite(value) ? value : 0).toFixed(1)}%`;

export const formatDateTime = (value) =>
    value ? format(new Date(value), 'MMM d, yyyy, HH:mm:ss') : '—';

export const formatDate = (value) =>
    value ? format(new Date(value), 'MMM d, yyyy') : '—';

export const formatTime = (value) =>
    value ? format(new Date(value), 'HH:mm') : '—';

export const formatRelative = (value) =>
    value
        ? formatDistanceToNow(new Date(value), { addSuffix: true, locale: enUS })
        : '—';