import { formatDateTime, statusLabel } from '@/lib/format';

const ACTION_META = {
    created: { label: 'Alert detected', color: '#E3B341' },
    quarantined: { label: 'File quarantined', color: '#5B9DFF' },
    resolved: { label: 'Resolution completed', color: '#4FB39B' },
    ignored: { label: 'Alert dismissed', color: '#8A90A0' },
    reopened: { label: 'Alert reopened', color: '#F08A3C' },
    note: { label: 'Note added', color: '#9AA3B2' },
};

export default function EventTimeline({ events = [], emptyLabel = 'No activity yet.' }) {
    if (!events.length) {
        return <p className="text-[12px] text-muted-foreground">{emptyLabel}</p>;
    }

    return (
        <ol className="relative space-y-5 border-l border-border/70 pl-5">
            {events.map((event) => {
                const meta = ACTION_META[event.action] ?? ACTION_META.note;
                return (
                    <li key={event.id} className="relative">
                        <span
                            className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background"
                            style={{ background: meta.color }}
                        />
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="text-[13px] text-foreground/90">{meta.label}</p>
                            {event.from_status && event.to_status && (
                                <span className="font-mono text-[10px] text-muted-foreground">
                                    {statusLabel(event.from_status)} → {statusLabel(event.to_status)}
                                </span>
                            )}
                        </div>
                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/80">
                            {formatDateTime(event.occurred_at || event.created_date)}
                            {event.actor ? ` · ${event.actor}` : ''}
                        </p>
                        {event.note && (
                            <p className="mt-1.5 rounded-lg border border-border/60 bg-white/[0.02] px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
                                {event.note}
                            </p>
                        )}
                    </li>
                );
            })}
        </ol>
    );
}