import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { fetchAlerts } from '@/api/alerts';
import { formatRelative } from '@/lib/format';
import { useLiveAlerts } from '@/lib/live-updates';

const READ_KEY = 'malware-guard-notifications-read-v1';

function getReadIds() {
  try {
    const saved = JSON.parse(localStorage.getItem(READ_KEY) || '[]');
    return new Set(Array.isArray(saved) ? saved.map(String) : []);
  } catch {
    return new Set();
  }
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [readIds, setReadIds] = useState(getReadIds);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { version } = useLiveAlerts();

  useEffect(() => {
    fetchAlerts()
      .then((alerts) => setItems(alerts.slice(0, 12)))
      .catch(() => setError('Could not load notifications from the alerts API.'));
  }, [version]);

  const markRead = (ids) => {
    const next = new Set([...readIds, ...ids.map(String)]);
    setReadIds(next);
    try {
      localStorage.setItem(READ_KEY, JSON.stringify([...next]));
    } catch {
      setError('Could not save the read status on this device.');
    }
  };

  const unread = items.filter((item) => !readIds.has(String(item.id))).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-lg border border-border/70 p-2 text-muted-foreground transition-colors hover:text-foreground"
        aria-label={`Notifications, ${unread} unread`}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F2555A] px-1 font-mono text-[9px] text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-11 z-50 w-[320px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
              <p className="font-display text-[12px]">Latest Alerts</p>
              <button
                type="button"
                onClick={() => markRead(items.map((item) => item.id))}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
              >
                <CheckCheck className="h-3 w-3" />
                Mark all as read
              </button>
            </div>
            <p className="border-b border-border/40 px-4 py-2 text-[10px] text-muted-foreground">
              Read status is saved only in this browser.
            </p>
            {error && <p className="px-4 py-3 text-[11px] text-[#F2555A]">{error}</p>}
            <div className="max-h-[340px] overflow-y-auto">
              {!error && items.length === 0 && (
                <p className="px-4 py-8 text-center text-[12px] text-muted-foreground">
                  No alerts found.
                </p>
              )}
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    markRead([item.id]);
                    setOpen(false);
                    navigate(`/alerts/${item.id}`);
                  }}
                  className="flex w-full gap-3 border-b border-border/40 px-4 py-3 text-left hover:bg-white/[0.03]"
                >
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: item.severity === 'critical' ? '#F2555A' : '#4FB39B' }}
                  />
                  <span className="min-w-0">
                    <span className={`block truncate text-[12px] ${readIds.has(String(item.id)) ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {item.description || item.alert_type || `Alert #${item.id}`}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {item.severity_raw} · {formatRelative(item.timestamp)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
