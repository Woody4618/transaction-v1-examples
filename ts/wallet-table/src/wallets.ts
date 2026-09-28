import { SolanaSignAndSendTransaction, SolanaSignTransaction } from '@solana/wallet-standard-features';
import { getWallets } from '@wallet-standard/app';
import type { Wallet } from '@wallet-standard/base';
import { useSyncExternalStore } from 'react';

const wallets = getWallets();

type StandardEvents = { on(event: 'change', listener: () => void): () => void };

let snapshot: readonly Wallet[] = wallets.get();

function subscribe(onChange: () => void) {
    const offChanges = new Map<Wallet, () => void>();
    const refresh = () => {
        const current = wallets.get();
        for (const [wallet, off] of offChanges) {
            if (!current.includes(wallet)) {
                off();
                offChanges.delete(wallet);
            }
        }
        for (const wallet of current) {
            if (offChanges.has(wallet)) continue;
            const events = wallet.features['standard:events'] as StandardEvents | undefined;
            offChanges.set(wallet, events?.on('change', update) ?? (() => {}));
        }
    };
    const update = () => {
        refresh();
        snapshot = [...wallets.get()];
        onChange();
    };
    refresh();
    snapshot = [...wallets.get()];
    const offRegister = wallets.on('register', update);
    const offUnregister = wallets.on('unregister', update);
    return () => {
        offRegister();
        offUnregister();
        for (const off of offChanges.values()) off();
    };
}

export function useWallets(): readonly Wallet[] {
    const getSnapshot = () => snapshot;
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function isSolanaWallet(wallet: Wallet): boolean {
    return wallet.chains.some(chain => chain.startsWith('solana:'));
}

/**
 * `SolanaTransactionVersion` in `@solana/wallet-standard-features` is still `'legacy' | 0`, so a
 * wallet advertising `1` is outside the published type and has to be read structurally.
 */
export function supportedTransactionVersions(wallet: Wallet): ReadonlySet<string> {
    const versions = new Set<string>();
    for (const name of [SolanaSignAndSendTransaction, SolanaSignTransaction] as const) {
        const feature = wallet.features[name] as { supportedTransactionVersions?: readonly unknown[] } | undefined;
        for (const version of feature?.supportedTransactionVersions ?? []) versions.add(String(version));
    }
    return versions;
}

export function supportsV1(wallet: Wallet): boolean {
    return supportedTransactionVersions(wallet).has('1');
}
