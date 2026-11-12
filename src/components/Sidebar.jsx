import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    ShieldAlert,
    MonitorSmartphone,
    History,
    FileSpreadsheet,
    Settings as SettingsIcon,
    ShieldCheck,
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const SECTIONS = [
    {
        title: 'NGuard',
        items: [{ to: '/', label: 'Overview', icon: LayoutDashboard, end: true }],
    },
    {
        title: 'Threat Management',
        items: [
            { to: '/alerts', label: 'Alerts', icon: ShieldAlert },
            { to: '/agents', label: 'Devices & Agents', icon: MonitorSmartphone },
            { to: '/history', label: 'Event History', icon: History },
        ],
    },
    {
        title: 'Reports',
        items: [{ to: '/reports', label: 'Reports & Analytics', icon: FileSpreadsheet }],
    },
    {
        title: 'System',
        items: [{ to: '/settings', label: 'Settings', icon: SettingsIcon }],
    },
];

export default function Sidebar({ open, onClose }) {
    return (
        <>
            <div
                onClick={onClose}
                className={cn(
                    'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden',
                    open ? 'opacity-100' : 'pointer-events-none opacity-0'
                )}
            />
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-50 flex w-[268px] flex-col border-r border-border/60 bg-[#08090D] px-4 py-6 transition-transform duration-300 lg:translate-x-0',
                    open ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
                            <ShieldCheck className="h-[18px] w-[18px] text-primary" />
                        </div>
                        <div>
                            <p className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] leading-none">
                                NGuard
                            </p>
                            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                Threat console
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/5 lg:hidden"
                        aria-label="Close menu"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <nav className="mt-9 flex-1 space-y-7 overflow-y-auto">
                    {SECTIONS.map((section) => (
                        <div key={section.title}>
                            <p className="mb-2 px-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
                                {section.title}
                            </p>
                            <div className="space-y-0.5">
                                {section.items.map((item) => (
                                    <NavLink
                                        key={item.to}
                                        to={item.to}
                                        end={item.end}
                                        onClick={onClose}
                                        className={({ isActive }) =>
                                            cn(
                                                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-colors',
                                                isActive
                                                    ? 'bg-white/[0.06] text-foreground'
                                                    : 'text-muted-foreground hover:bg-white/[0.03] hover:text-foreground'
                                            )
                                        }
                                    >
                                        {({ isActive }) => (
                                            <>
                                                <span
                                                    className={cn(
                                                        'absolute left-0 h-4 w-[2px] rounded-r-full bg-primary transition-opacity',
                                                        isActive ? 'opacity-100' : 'opacity-0'
                                                    )}
                                                />
                                                <item.icon
                                                    className={cn('h-4 w-4', isActive ? 'text-primary' : '')}
                                                    strokeWidth={1.8}
                                                />
                                                {item.label}
                                            </>
                                        )}
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>

                <div className="mt-6 rounded-xl border border-border/60 bg-white/[0.02] p-3">
                    <p className="text-[11px] text-muted-foreground">
                        This dashboard displays alerts and quarantine status provided by the existing API.
                    </p>
                </div>
            </aside>
        </>
    );
}