import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import NotificationsBell from '@/components/NotificationsBell';

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
                    <span className="hidden items-center gap-2 rounded-full border border-border/70 px-3 py-1.5 text-[11px] text-muted-foreground sm:flex">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                        </span>
                        API data
                    </span>

                    <NotificationsBell />

                    <span className="hidden rounded-lg border border-border/70 px-3 py-1.5 text-[11px] text-muted-foreground sm:block">
                        Read-only
                    </span>
                </div>
            </div>
        </header>
    );
}