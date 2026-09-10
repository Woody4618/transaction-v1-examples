import { SolanaSignAndSendTransaction, SolanaSignTransaction } from '@solana/wallet-standard-features';
import { getWallets } from '@wallet-standard/app';
import type { Wallet } from '@wallet-standard/base';
import { useSyncExternalStore } from 'react';

const wallets = getWallets();

function subscribe(onChange: () => void) {
    const offRegister = wallets.on('register', onChange);
    const offUnregister = wallets.on('unregister', onChange);
    return () => {
        offRegister();
        offUnregister();
    };
}

export function useWallets(): readonly Wallet[] {
    const getSnapshot = () => wallets.get();
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
