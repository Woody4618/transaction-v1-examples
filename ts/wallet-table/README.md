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

## Deploy

The page is fully static: no env vars, no backend, no build-time network
access. [`../vercel.json`](../vercel.json) holds the install, build, and output
settings for Vercel.

Set the project's **Root Directory** to `ts` — that setting lives only in the
Vercel dashboard, and it has to be `ts` rather than `ts/wallet-table` because
the pnpm workspace root (`pnpm-workspace.yaml`, `pnpm-lock.yaml`, and the
`packageManager` field) is `ts/`. Vercel picks its package manager from the
lockfile it finds at the root directory, so pointing it deeper falls back to
npm and fails to resolve the workspace.

Keep the project on Node 22.x; Vite 8 requires Node >=20.19 or >=22.12.
