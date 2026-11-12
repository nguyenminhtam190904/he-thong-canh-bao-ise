import {
    ComposedChart,
    Area,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

const RANGES = [
    { value: '24h', label: '24 hours' },
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
];

function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-xl">
            <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
            {payload.map((p) => (
                <p key={p.dataKey} className="flex items-center gap-2 text-xs text-foreground/90">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
                    {p.dataKey === 'total' ? 'Total alerts' : 'Critical'}
                    <span className="ml-auto font-mono">{p.value}</span>
                </p>
            ))}
        </div>
    );
}

export default function TrendChart({ series = [], range = '7d', onRangeChange }) {
    return (
        <div>
            <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-4 rounded-full bg-[#4FB39B]" /> Total alerts
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-4 rounded-full bg-[#F2555A]" /> Critical
                    </span>
                </div>
                <div className="flex rounded-lg border border-border/70 bg-white/[0.02] p-0.5">
                    {RANGES.map((r) => (
                        <button
                            key={r.value}
                            type="button"
                            onClick={() => onRangeChange?.(r.value)}
                            className={`rounded-md px-2.5 py-1 text-[11px] transition-colors ${range === r.value
                                ? 'bg-white/[0.08] text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-[236px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={series} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
                        <defs>
                            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#4FB39B" stopOpacity={0.34} />
                                <stop offset="100%" stopColor="#4FB39B" stopOpacity={0.01} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid stroke="hsl(222 14% 18%)" strokeDasharray="3 4" vertical={false} />
                        <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: 'hsl(220 10% 55%)', fontSize: 10 }}
                            interval="preserveStartEnd"
                            minTickGap={22}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            width={44}
                            tick={{ fill: 'hsl(220 10% 55%)', fontSize: 10 }}
                        />
                        <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'hsl(222 14% 26%)' }} />
                        <Area
                            type="monotone"
                            dataKey="total"
                            stroke="#4FB39B"
                            strokeWidth={2}
                            fill="url(#trendFill)"
                            dot={false}
                            activeDot={{ r: 3, fill: '#4FB39B', stroke: 'hsl(222 24% 6%)' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="critical"
                            stroke="#F2555A"
                            strokeWidth={1.6}
                            strokeDasharray="4 3"
                            dot={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}