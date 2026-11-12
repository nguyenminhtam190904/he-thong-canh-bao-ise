export default function SeverityBars({ rows = [] }) {
    const max = Math.max(1, ...rows.map((row) => row.count));
    return (
        <div className="space-y-3">
            {rows.map((row) => (
                <div key={row.value}>
                    <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
                        <span className="flex items-center gap-2 text-foreground/85">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: row.color }} />
                            {row.label}
                        </span>
                        <span className="font-mono text-muted-foreground">{row.count}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${(row.count / max) * 100}%`, background: row.color }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}