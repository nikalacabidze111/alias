// ISOLATED-world relay: bridges the page (MAIN world) and the background
// service worker. Validates that messages come from this page itself and
// forwards them over a long-lived port.
import {
  CHANNEL_FROM_RELAY,
  CHANNEL_TO_RELAY,
  type PageEvent,
  type PageRequest,
  type PageResponse,
} from '../shared/messages';

let port: chrome.runtime.Port | null = null;
const inflight = new Map<string, PageRequest>();

function ensurePort(): chrome.runtime.Port {
  if (port) return port;
  port = chrome.runtime.connect({ name: 'alias-relay' });
  port.onMessage.addListener((msg: { id?: string; ok?: boolean; result?: unknown; error?: unknown; event?: string; data?: unknown }) => {
    if (msg.event) {
      const event: PageEvent = {
        channel: CHANNEL_FROM_RELAY,
        event: msg.event as PageEvent['event'],
        data: msg.data,
      };
      window.postMessage(event, window.location.origin);
      return;
    }
    if (typeof msg.id === 'string') {
      inflight.delete(msg.id);
      const response: PageResponse = {
        channel: CHANNEL_FROM_RELAY,
        id: msg.id,
        ok: Boolean(msg.ok),
        result: msg.result,
        error: msg.error as PageResponse['error'],
      };
      window.postMessage(response, window.location.origin);
    }
  });
  port.onDisconnect.addListener(() => {
    port = null;
    // Fail any in-flight requests visibly; the page can retry.
    for (const [id] of inflight) {
      const response: PageResponse = {
        channel: CHANNEL_FROM_RELAY,
        id,
        ok: false,
        error: { code: 4900, message: 'Alias was restarted. Try the request again.' },
      };
      window.postMessage(response, window.location.origin);
    }
    inflight.clear();
  });
  return port;
}

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return;
  const data = event.data as PageRequest | undefined;
  if (!data || data.channel !== CHANNEL_TO_RELAY) return;
  if (typeof data.id !== 'string' || typeof data.method !== 'string') return;
  inflight.set(data.id, data);
  try {
    ensurePort().postMessage({ id: data.id, method: data.method, params: data.params });
  } catch {
    inflight.delete(data.id);
    const response: PageResponse = {
      channel: CHANNEL_FROM_RELAY,
      id: data.id,
      ok: false,
      error: { code: 4900, message: 'Could not reach Alias. Reload the page and try again.' },
    };
    window.postMessage(response, window.location.origin);
  }
});
