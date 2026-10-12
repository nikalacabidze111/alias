// With a hosted Alias server baked in, the funding page defaults to it and
// installs saved with the old localhost page move over automatically.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeMock } from './chrome-mock';

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  installChromeMock();
});

describe('hosted funding page', () => {
  it('defaults to localhost when no server is configured', async () => {
    const settings = await import('../src/background/settings');
    expect((await settings.getSettings()).companionUrl).toBe('http://localhost:8765');
  });

  it('defaults to the hosted server and migrates old localhost settings', async () => {
    vi.stubGlobal('__ALIAS_SERVER__', 'https://alias.example.workers.dev');
    const settings = await import('../src/background/settings');
    expect((await settings.getSettings()).companionUrl).toBe('https://alias.example.workers.dev');
    await chrome.storage.local.set({ 'settings.v1': { companionUrl: 'http://localhost:8765/', perOperationSol: 0.1 } });
    const s = await settings.getSettings();
    expect(s.companionUrl).toBe('https://alias.example.workers.dev');
    expect(s.perOperationSol).toBe(0.1);
    // A custom page someone chose on purpose is kept.
    await chrome.storage.local.set({ 'settings.v1': { companionUrl: 'https://my.own.page' } });
    expect((await settings.getSettings()).companionUrl).toBe('https://my.own.page');
  });
});
