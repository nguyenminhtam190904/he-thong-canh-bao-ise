import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';

export default function Layout() {
    const [open, setOpen] = useState(false);

    return (
        <div className="relative min-h-screen bg-background">
            <div
                className="pointer-events-none fixed inset-0 -z-10"
                style={{
                    background:
                        'radial-gradient(900px 420px at 12% -8%, rgba(79,179,155,0.10), transparent 65%), radial-gradient(760px 380px at 88% 4%, rgba(242,85,90,0.07), transparent 70%)',
                }}
            />
            <Sidebar open={open} onClose={() => setOpen(false)} />
            <div className="lg:pl-[268px]">
                <Topbar onMenu={() => setOpen(true)} />
                <main className="mx-auto w-full max-w-[1400px] px-5 pb-20 pt-7 sm:px-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}