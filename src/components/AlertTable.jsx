import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import SeverityBadge from '@/components/SeverityBadge';
import StatusBadge from '@/components/StatusBadge';
import { formatDateTime } from '@/lib/format';

export default function AlertTable({ alerts = [], emptyLabel = 'No alerts found.' }) {
    if (!alerts.length) {
        return (
            <div className="px-6 py-14 text-center text-sm text-muted-foreground">{emptyLabel}</div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                    <tr className="border-b border-border/70">
                        {['File / Threat', 'Severity', 'Device', 'Time', 'Status', ''].map((h) => (
                            <th
                                key={h}
                                className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
                            >
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {alerts.map((alert) => (
                        <tr
                            key={alert.id}
                            className="group border-b border-border/40 transition-colors last:border-0 hover:bg-white/[0.025]"
                        >
                            <td className="px-4 py-3">
                                <Link to={`/alerts/${alert.id}`} className="block">
                                    <span className="block font-mono text-[13px] text-foreground group-hover:text-primary">
                                        {alert.file_name || alert.description || `Alert #${alert.id}`}
                                    </span>
                                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                        {alert.threat_type || alert.alert_type}
                                        {alert.file_path ? ` · ${alert.file_path}` : ''}
                                    </span>
                                </Link>
                            </td>
                            <td className="px-4 py-3">
                                <SeverityBadge severity={alert.severity} />
                            </td>
                            <td className="px-4 py-3">
                                <span className="block font-mono text-[12px] text-foreground/85">
                                    {alert.device_ip}
                                </span>
                                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                    {alert.agent_name || alert.device_mac || '—'}
                                </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-muted-foreground">
                                {formatDateTime(alert.timestamp || alert.detection_time)}
                            </td>
                            <td className="px-4 py-3">
                                <StatusBadge status={alert.status} />
                            </td>
                            <td className="px-4 py-3 text-right">
                                <Link
                                    to={`/alerts/${alert.id}`}
                                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-primary"
                                >
                                    View
                                    <ArrowUpRight className="h-3 w-3" />
                                </Link>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}