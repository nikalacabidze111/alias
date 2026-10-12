// Minimal chrome.* mock for unit tests. Storage areas are real in-memory maps
// so storage round-trips exercise the same JSON shapes the extension uses.

type Listener = (...args: unknown[]) => void;

function storageArea() {
  const data = new Map<string, unknown>();
  return {
    _data: data,
    async get(keys?: string | string[] | null) {
      if (keys == null) return Object.fromEntries(data);
      const list = Array.isArray(keys) ? keys : [keys];
      const out: Record<string, unknown> = {};
      for (const k of list) if (data.has(k)) out[k] = structuredClone(data.get(k));
      return out;
    },
    async set(items: Record<string, unknown>) {
      for (const [k, v] of Object.entries(items)) data.set(k, structuredClone(v));
    },
    async remove(keys: string | string[]) {
      for (const k of Array.isArray(keys) ? keys : [keys]) data.delete(k);
    },
    async clear() {
      data.clear();
    },
  };
}

export function installChromeMock() {
  const local = storageArea();
  const session = storageArea();
  const alarms = new Map<string, unknown>();
  const windows: { id: number; url: string }[] = [];
  let nextWindowId = 100;
  const onRemovedListeners = new Set<Listener>();

  const chrome = {
    storage: { local, session },
    alarms: {
      async create(name: string, info: unknown) {
        alarms.set(name, info);
      },
      async clear(name: string) {
        alarms.delete(name);
      },
      onAlarm: { addListener: () => undefined },
      _alarms: alarms,
    },
    windows: {
      async create(info: { url: string }) {
        const win = { id: nextWindowId++, url: info.url };
        windows.push(win);
        return win;
      },
      async remove(id: number) {
        const i = windows.findIndex((w) => w.id === id);
        if (i >= 0) windows.splice(i, 1);
        for (const l of onRemovedListeners) l(id);
      },
      onRemoved: {
        addListener: (l: Listener) => onRemovedListeners.add(l),
        removeListener: (l: Listener) => onRemovedListeners.delete(l),
      },
      _windows: windows,
    },
    tabs: {
      async create(info: { url: string }) {
        return { id: nextWindowId++, url: info.url };
      },
    },
    runtime: {
      id: 'test-extension-id',
      getURL: (path: string) => `chrome-extension://test-extension-id/${path.replace(/^\//, '')}`,
      onMessage: { addListener: () => undefined },
      onConnect: { addListener: () => undefined },
    },
  };

  (globalThis as Record<string, unknown>).chrome = chrome;
  return chrome;
}

export type ChromeMock = ReturnType<typeof installChromeMock>;
