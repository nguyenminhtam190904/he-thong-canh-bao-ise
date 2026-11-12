import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { SEVERITIES, formatNumber, formatPercent } from '@/lib/format';

export default function SeverityDonut({ data = [], active = null, onSelect, total }) {
    const sum = total ?? data.reduce((acc, d) => acc + (d.count || 0), 0);
    const rows = SEVERITIES.map((s) => ({
        ...s,
        count: data.find((d) => d.severity === s.value)?.count ?? 0,
    }));

    return (
        <div>
            <div className="relative mx-auto h-[188px] w-full max-w-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={rows}
                            dataKey="count"
                            nameKey="label"
                            innerRadius="66%"
                            outerRadius="94%"
                            paddingAngle={2}
                            stroke="none"
                            onClick={(entry) => onSelect?.(entry.value)}
                            className="cursor-pointer"
                        >
                            {rows.map((row) => (
                                <Cell
                                    key={row.value}
                                    fill={row.color}
                                    opacity={active && active !== row.value ? 0.28 : 1}
                                />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-display text-2xl leading-none tracking-tight">
                        {formatNumber(sum)}
                    </span>
                    <span className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        alerts
                    </span>
                </div>
            </div>

            <div className="mt-5 space-y-1">
                {rows.map((row) => {
                    const selected = active === row.value;
                    return (
                        <button
                            key={row.value}
                            type="button"
                            onClick={() => onSelect?.(row.value)}
                            className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors ${selected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                                }`}
                        >
                            <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ background: row.color }}
                            />
                            <span className="flex-1 text-[13px] text-foreground/90">{row.label}</span>
                            <span className="font-mono text-[11px] text-muted-foreground">
                                {sum ? formatPercent((row.count / sum) * 100) : '0%'}
                            </span>
                            <span className="w-10 text-right font-mono text-[12px] text-foreground/80">
                                {formatNumber(row.count)}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}