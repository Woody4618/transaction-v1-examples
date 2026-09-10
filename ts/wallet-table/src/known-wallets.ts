/**
 * Hand-maintained per-wallet notes, keyed by the wallet's Wallet Standard `name`.
 *
 * `v1UpdateVersion` is the release a user should install to get v1 support, linked via `url`. It is
 * only set once a wallet has actually shipped v1, so an installed wallet that does not advertise
 * `1` and has no `v1UpdateVersion` has not added support yet.
 */
export interface KnownWallet {
    url: string;
    v1UpdateVersion?: string;
}

export const KNOWN_WALLETS: Readonly<Record<string, KnownWallet>> = {
    Backpack: { url: 'https://backpack.app' },
    Jupiter: { url: 'https://jup.ag/wallet', v1UpdateVersion: '1.18.0' },
    Phantom: { url: 'https://phantom.com' },
    Solflare: { url: 'https://solflare.com' },
};
