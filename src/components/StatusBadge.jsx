import { statusMeta } from '@/lib/format';

export default function StatusBadge({ status }) {
    const meta = statusMeta(status);
    return (
        <span
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-[3px] text-[11px]"
            style={{
                color: meta.color,
                backgroundColor: `${meta.color}14`,
                borderColor: `${meta.color}33`,
            }}
        >
            <span className="h-1 w-1 rounded-full" style={{ background: meta.color }} />
            {meta.label}
        </span>
    );
}