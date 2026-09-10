import type { Wallet } from '@wallet-standard/base';

import { KNOWN_WALLETS } from './known-wallets.js';
import { isSolanaWallet, supportedTransactionVersions, supportsV1, useWallets } from './wallets.js';

const UPGRADE_URL = 'https://solana.com/upgrades/larger-transaction-sizes';
const VERSIONS = ['legacy', '0', '1'] as const;

function v1Rank(wallet: Wallet): number {
    if (supportsV1(wallet)) return 0;
    if (KNOWN_WALLETS[wallet.name]?.v1UpdateVersion) return 1;
    return 2;
}

function Support({ supported }: { supported: boolean }) {
    return supported ? <span className="yes">✓</span> : <span className="no">✗</span>;
}

function V1Support({ wallet, supported }: { wallet: Wallet; supported: boolean }) {
    const known = KNOWN_WALLETS[wallet.name];
    if (supported || !known?.v1UpdateVersion) return <Support supported={supported} />;
    return (
        <a className="update" href={known.url} title={`Update to ${known.v1UpdateVersion} for v1 support`}>
            <span aria-hidden="true">↑</span> update
        </a>
    );
}

function WalletRow({ wallet }: { wallet: Wallet }) {
    const versions = supportedTransactionVersions(wallet);
    return (
        <tr>
            <th scope="row">
                <img src={wallet.icon} alt="" width={20} height={20} />
                {wallet.name}
            </th>
            {VERSIONS.map(version => (
                <td key={version}>
                    {version === '1' ? (
                        <V1Support wallet={wallet} supported={versions.has(version)} />
                    ) : (
                        <Support supported={versions.has(version)} />
                    )}
                </td>
            ))}
        </tr>
    );
}

export function App() {
    const wallets = useWallets()
        .filter(isSolanaWallet)
        .sort((a, b) => v1Rank(a) - v1Rank(b) || a.name.localeCompare(b.name));
    return (
        <main>
            <h1>Does my wallet support transaction v1?</h1>
            <p>
                Transaction is a new standard on Solana v1 raises the size limit from 1,232 to 4,096 bytes. Upgrade your
                wallet to maintain access to all of the latest functionality from your favorite dapps!
                <br />
                <a href={UPGRADE_URL}>Learn more about larger transactions</a>.
            </p>
            {wallets.length === 0 ? (
                <p className="empty">No Solana wallet detected in this browser.</p>
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th scope="col">Wallet</th>
                            {VERSIONS.map(version => (
                                <th key={version} scope="col">
                                    {version}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {wallets.map(wallet => (
                            <WalletRow key={wallet.name} wallet={wallet} />
                        ))}
                    </tbody>
                </table>
            )}
            <ul className="legend">
                <li>
                    <span className="yes">✓</span> supported
                </li>
                <li>
                    <span className="no">✗</span> not supported, or not known to be
                </li>
                <li>
                    <span className="update">update</span> a newer release of this wallet supports v1
                </li>
            </ul>
        </main>
    );
}
