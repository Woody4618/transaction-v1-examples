# wallet-table

A page that lists every Solana wallet installed in the browser and whether it
supports transaction **v1**, read live from each wallet's
[Wallet Standard](https://github.com/anza-xyz/wallet-standard) registration.
No wallet adapter, no `@solana/web3.js`: `getWallets()` from
`@wallet-standard/app` is the only runtime dependency.

```sh
just wallet-table   # vite dev server
```

A wallet supports v1 when `supportedTransactionVersions` on its
`solana:signAndSendTransaction` or `solana:signTransaction` feature contains
`1`. For wallets that do not, [`src/known-wallets.ts`](src/known-wallets.ts)
holds a hand-maintained map from wallet name to its site and, once shipped,
the release that added v1 support, so the page can point users at an update.

More on the upgrade: <https://solana.com/upgrades/larger-transaction-sizes>.
