import { useLocation } from 'react-router-dom';
import { LogOut, Menu, UserRound } from 'lucide-react';
import NotificationsBell from '@/components/NotificationsBell';
import { useAuth } from '@/lib/auth-context';
import { useLiveAlerts } from '@/lib/live-updates';

const TITLES = {
    '/': { title: 'Overview', crumb: 'Dashboard' },
    '/alerts': { title: 'Alerts', crumb: 'Threat management' },
    '/agents': { title: 'Devices & Agents', crumb: 'Device management' },
    '/history': { title: 'Event History', crumb: 'Activity log' },
    '/reports': { title: 'Reports & Analytics', crumb: 'Reports' },
    '/settings': { title: 'Settings', crumb: 'Settings' },
};

export default function Topbar({ onMenu }) {
    const { pathname } = useLocation();
    const { user, logout } = useAuth();
    const live = useLiveAlerts();
    const current = TITLES[pathname] ?? {
        title: pathname.startsWith('/alerts/') ? 'Threat Details' : 'NGuard',
        crumb: 'Threat details',
    };

    return (
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
            <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-3 px-5 sm:px-8">
                <button
                    type="button"
                    onClick={onMenu}
                    className="rounded-lg border border-border/70 p-2 text-muted-foreground lg:hidden"
                    aria-label="Open menu"
                >
                    <Menu className="h-4 w-4" />
                </button>

                <div className="min-w-0">
                    <p className="truncate font-display text-[15px] leading-tight tracking-tight">
                        {current.title}
                    </p>
                    <p className="truncate text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                        {current.crumb}
                    </p>
                </div>

                <div className="ml-auto flex items-center gap-2">
                    <span
                        className="hidden items-center gap-2 rounded-full border border-border/70 px-3 py-1.5 text-[11px] text-muted-foreground sm:flex"
                        title={live.status === 'live' ? 'New alerts appear automatically' : 'Live connection lost; retrying and refreshing every 30 seconds'}
                    >
                        <span className="relative flex h-1.5 w-1.5">
                            {live.status === 'live' && (
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                            )}
                            <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${live.status === 'live' ? 'bg-primary' : 'bg-[#E3B341]'}`} />
                        </span>
                        {live.status === 'live' ? 'Realtime' : 'Reconnecting…'}
                    </span>

                    <NotificationsBell />

                    <span className="hidden items-center gap-2 rounded-lg border border-border/70 px-3 py-1.5 text-[11px] text-muted-foreground sm:flex">
                        <UserRound className="h-3.5 w-3.5" />
                        {user?.fullName || user?.username}
                    </span>

                    <button
                        type="button"
                        onClick={logout}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-[#F2555A]/40 hover:text-[#F2555A]"
                        aria-label="Sign out"
                    >
                        <LogOut className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Sign out</span>
                    </button>
                </div>
            </div>
        </header>
    );
}