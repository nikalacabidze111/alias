// Full-page manager: complete operation history, alias details, recovery notes.
import { bgCall, type AliasInfo, type OperationRecord, type VaultStatus } from '../shared/messages';
import { explorerAddressUrl, explorerTxUrl } from '../shared/constants';
import { lamportsToSol } from '../shared/format';

const root = document.getElementById('root')!;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

async function bg<T>(req: Parameters<typeof bgCall>[0]): Promise<T> {
  const res = await bgCall<T>(req);
  if (!res.ok) throw new Error(res.error?.message ?? 'Something went wrong');
  return res.result as T;
}

async function main(): Promise<void> {
  const status = await bg<VaultStatus>({ type: 'vault.status' });
  if (!status.exists) {
    root.innerHTML = `<p>No vault yet. Open Alias from the toolbar to create one.</p>`;
    return;
  }
  if (!status.unlocked) {
    root.innerHTML = `<p>Alias is locked. Unlock it from the toolbar, then reload this page.</p>`;
    return;
  }
  const [aliases, ops, settings] = await Promise.all([
    bg<AliasInfo[]>({ type: 'alias.list' }),
    bg<OperationRecord[]>({ type: 'ops.list' }),
    bg<{ network: 'devnet' | 'mainnet-beta' }>({ type: 'settings.get' }),
  ]);

  const aliasRows = await Promise.all(
    aliases.map(async (a) => {
      let balance = '-';
      try {
        const { lamports } = await bg<{ lamports: number }>({ type: 'alias.balance', id: a.id });
        balance = `${lamportsToSol(lamports)} SOL`;
      } catch {
        balance = 'unavailable';
      }
      return `<tr>
        <td><strong>${esc(a.name)}</strong><br /><span class="muted small">${esc(a.kind)}</span></td>
        <td><a href="${explorerAddressUrl(a.address, settings.network)}" target="_blank" rel="noreferrer">${esc(a.address)}</a></td>
        <td>${balance}</td>
        <td class="muted small">m/44'/501'/${a.index}'/0'</td>
      </tr>`;
    }),
  );

  const opRows = ops.map((op) => {
    const alias = aliases.find((a) => a.id === op.aliasId);
    return `<tr>
      <td>${op.kind === 'fund' ? 'Fund' : 'Return'}</td>
      <td>${esc(alias?.name ?? '-')}</td>
      <td>${lamportsToSol(op.amountLamports)} SOL</td>
      <td>${esc(op.step)}${op.error ? `<br /><span class="muted small">${esc(op.error)}</span>` : ''}</td>
      <td>
        ${op.depositTx ? `<a href="${explorerTxUrl(op.depositTx, op.network)}" target="_blank" rel="noreferrer">deposit</a>` : '-'}
        ${op.withdrawTx ? ` · <a href="${explorerTxUrl(op.withdrawTx, op.network)}" target="_blank" rel="noreferrer">withdrawal</a>` : ''}
      </td>
      <td class="muted small">${new Date(op.createdAt).toLocaleString()}</td>
    </tr>`;
  });

  root.innerHTML = `
    <h2>Aliases</h2>
    <table>
      <tr><th>Alias</th><th>Address</th><th>Balance</th><th>Derivation</th></tr>
      ${aliasRows.join('')}
    </table>
    <h2>Private operations</h2>
    ${
      ops.length === 0
        ? '<p class="muted">None yet.</p>'
        : `<table><tr><th>Kind</th><th>Alias</th><th>Amount</th><th>Status</th><th>Explorer</th><th>When</th></tr>${opRows.join('')}</table>`
    }
    <h2>Recovery</h2>
    <p class="muted">Every alias key derives from your 12-word phrase (shown in Settings → Show recovery phrase) at the derivation paths above. Shielded balances recover from the same keys by rescanning the pool, which happens automatically during fund and return operations. Aliases cannot be deleted while they hold SOL, tokens or an unfinished operation; this build does not delete aliases at all.</p>
  `;
}

void main().catch((e: unknown) => {
  root.innerHTML = `<p>${esc(e instanceof Error ? e.message : 'Something went wrong')}</p>`;
});
