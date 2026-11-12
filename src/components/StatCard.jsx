export default function StatCard({ label, value, hint, icon: Icon, accent = '#4FB39B' }) {
    return (
        <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-5 transition-colors duration-300 hover:border-border">
            <div
                className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full opacity-[0.16] blur-2xl transition-opacity duration-500 group-hover:opacity-30"
                style={{ background: accent }}
            />
            <div className="flex items-start justify-between gap-3">
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {label}
                </span>
                {Icon && <Icon className="h-4 w-4 shrink-0" style={{ color: accent }} />}
            </div>
            <div className="mt-6 font-display text-[30px] leading-none tracking-tight text-foreground">
                {value}
            </div>
            {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}