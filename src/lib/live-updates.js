// One shared Server-Sent Events connection for the whole app.
// Pages read `version` from useLiveAlerts() and reload when it changes.
import { useEffect, useSyncExternalStore } from 'react';

let state = { status: 'idle', version: 0, lastEvent: null };
const listeners = new Set();
let source = null;
let subscribers = 0;
let fallbackTimer = null;

const FALLBACK_POLL_MS = 30000;

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function bump(lastEvent) {
  setState({ version: state.version + 1, lastEvent });
}

function connect() {
  if (source || typeof EventSource === 'undefined') return;
  setState({ status: 'connecting' });
  source = new EventSource('/api/alerts/stream');

  source.addEventListener('ready', () => {
    // Reload after (re)connecting so nothing missed while offline is lost.
    const wasOffline = state.status === 'offline';
    setState({ status: 'live' });
    if (wasOffline) bump({ type: 'reconnected' });
  });

  source.addEventListener('alerts', (event) => {
    let data = null;
    try {
      data = JSON.parse(event.data);
    } catch {
      data = { type: 'unknown' };
    }
    bump(data);
  });

  source.onerror = () => {
    // EventSource retries automatically; mark offline and poll meanwhile.
    setState({ status: 'offline' });
  };

  // Safety net: if the stream is down, still refresh periodically.
  fallbackTimer = window.setInterval(() => {
    if (state.status !== 'live') bump({ type: 'poll' });
  }, FALLBACK_POLL_MS);
}

function disconnect() {
  source?.close();
  source = null;
  window.clearInterval(fallbackTimer);
  fallbackTimer = null;
  setState({ status: 'idle' });
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

// Keeps the connection open while at least one component uses it.
export function useLiveAlerts() {
  useEffect(() => {
    subscribers += 1;
    connect();
    return () => {
      subscribers -= 1;
      if (subscribers === 0) disconnect();
    };
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot);
}
