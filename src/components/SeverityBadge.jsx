import { severityMeta } from '@/lib/format';

export default function SeverityBadge({ severity, dot = true }) {
    const meta = severityMeta(severity);
    return (
        <span
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11px] font-medium"
            style={{
                color: meta.color,
                backgroundColor: `${meta.color}1A`,
                borderColor: `${meta.color}3D`,
            }}
        >
            {dot && (
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
            )}
            {meta.label}
        </span>
    );
}