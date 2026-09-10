# transaction-v1-examples

Working examples for Solana transaction **v1** ([SIMD-0385](https://solana.com/upgrades/larger-transaction-sizes)) in Rust, TypeScript, Python, and Go: sending, decoding, reading blocks, and indexing over Yellowstone gRPC.

Every example runs against a local `solana-test-validator` from Anza CLI 4.2.1 or Surfpool 1.5+, and the whole suite is exercised in CI.

## What v1 changes

A v1 message carries a `TransactionConfig` instead of ComputeBudget program instructions:

| | legacy / v0 | v1 |
|---|---|---|
| Compute unit limit | `SetComputeUnitLimit` instruction | `config.computeUnitLimit` |
| Priority fee | `SetComputeUnitPrice` instruction, micro-lamports **per CU** | `config.priorityFeeLamports`, **total lamports** |
| Loaded accounts cap | `SetLoadedAccountsDataSizeLimit` instruction | `config.loadedAccountsDataSizeLimit` |
| Heap size | `RequestHeapFrame` instruction | `config.heapSize` |
| Address lookup tables | v0 only | never |
| Message version prefix | `0x80` (v0) | `0x81` |

An existing pipeline that derives priority fees or compute budget by scanning Compute Budget instructions reports 0 for every v1 transaction, and raises nothing.

## Quick start

```sh
just setup-solana     # Anza CLI 4.2.1
just setup            # Rust, TypeScript, Python, and Go dependencies
just demo             # start a validator, run every example, shut it down
```

To keep a validator up and drive the examples yourself:

```sh
just validator-start  # local validator with the geyser plugin attached
just send-decode      # …then any example below
just validator-stop
```

`solana-test-validator` activates every feature at genesis, so the `enable_tx_v1` gate (`txv1aq4pp281K9um3tnPgkfX8UqtFT6wcVW3hNezGLL`) is live on startup. Verify with:

```sh
solana -u l feature status txv1aq4pp281K9um3tnPgkfX8UqtFT6wcVW3hNezGLL
```

## Examples

| What | Rust | TypeScript | Python | Go |
|---|---|---|---|---|
| Send a v1 transfer, read it back, decode the wire bytes | `just send-decode` | `just ts-send-decode` | `just py-send-decode` | `just go-send-decode` |
| Read a block holding v1 transactions | `just get-block` | `just ts-get-block` | `just py-get-block` | `just go-get-block` |
| Size the compute budget by simulation instead of hard-coding it | — | `just ts-estimate` | — | — |
| Read the compute budget out of a base64 transaction of any version | — | `just ts-decode-budget` | — | — |
| Send a v1 transfer under a durable nonce lifetime | — | `just ts-nonce` | — | — |
| Send a whole Token-2022 confidential transfer in one transaction | — | `just ts-confidential-transfer` | — | — |
| Send and read a v1 transfer through a `@solana/kit` plugin client | — | `just kp-send-decode` | — | — |
| Send a confidential transfer through a `@solana/kit` plugin client | — | `just kp-confidential-transfer` | — | — |
| Read a v1 transaction with the `@solana/web3.js` 1.x beta | — | `just w3-read-transaction` | — | — |
| Send and read a v1 transfer with `@solana/web3.js` 3.x | — | `just w3v3-send-decode` | — | — |
| Send a confidential transfer with `@solana/web3.js` 3.x | — | `just w3v3-confidential-transfer` | — | — |
| See which installed browser wallets support v1 | — | `just wallet-table` | — | — |
| Index transactions over gRPC | `just grpc-tx-indexer` | `just ts-grpc-tx-indexer` | — | `just go-grpc-tx-indexer` |
| Index blocks over gRPC | `just grpc-block-indexer` | `just ts-grpc-block-indexer` | — | `just go-grpc-block-indexer` |

Source: [`rust/src/bin/`](rust/src/bin), [`ts/kit/src/`](ts/kit/src), [`ts/kit-plugins/src/`](ts/kit-plugins/src), [`ts/web3js-legacy/src/`](ts/web3js-legacy/src), [`ts/web3js-v3/src/`](ts/web3js-v3/src), [`ts/wallet-table/src/`](ts/wallet-table/src), [`python/examples/`](python/examples), and [`go/cmd/`](go/cmd).

## Do more with Larger Transactions

v1 raises the transaction size limit from **1,232 bytes to 4,096**, which is enough to send a [Token-2022 confidential transfer](https://solana.com/docs/tokens/extensions/confidential-transfer) in one transaction. A transfer is three client-generated zero-knowledge proofs, each written into its own context state account, the transfer instruction that reads all three, then three closes to reclaim the rent — which `@solana-program/token-2022` hands back as an `InstructionPlan` for a planner to split, because under the legacy limit it cannot be one transaction.

Under v1 it all fits: ten instructions and 2,897 of the 4,096 bytes. [`just ts-confidential-transfer`](ts/kit/src/confidential-transfer.ts) packs and sends it, [`just kp-confidential-transfer`](ts/kit-plugins/src/confidential-transfer.ts) does it on a plugin client where `sendTransaction` asserts the plan fits, and [`just w3v3-confidential-transfer`](ts/web3js-v3/src/confidential-transfer.ts) does it on `@solana/web3.js` 3.x.


### The local validator needs a different Token-2022

`solana-test-validator` bundles a Token-2022 build with `zk-ops` compiled out. [`scripts/setup-token-2022.sh`](scripts/setup-token-2022.sh) fetches the program published with a token-2022 release — the same binary mainnet runs — and [`scripts/validator.sh`](scripts/validator.sh) loads it at the Token-2022 address instead.

## Common gotchas

**Unset config fields are not defaults.** An absent `computeUnitLimit` or `loadedAccountsDataSizeLimit` resolves to **zero**, so the transaction fails; only `heapSize` falls back to the 32 KB default. The 200,000-CUs-per-instruction fallback is the legacy/v0 rule and does not apply — `solana_message::v1::TransactionConfig` is the authority.

**JSON-RPC pinned at `maxSupportedTransactionVersion: 0` starts failing.** The parameter is a ceiling, so asking for a v1 transaction errors. For `getBlock` that takes down the *entire block*, so one v1 transaction blinds a caller for that slot. Raise it to 1.

**gRPC gives no warning.** No equivalent parameter, no version field, no server-side filter. v1 transactions show up in the stream looking like any other, and `Message.versioned` is `true` for v0 and v1 alike — the only signal is whether `config` is present.

```rust
match (&message.config, message.versioned) {
    (Some(_), _)     => MessageVersion::V1,
    (None, true)     => MessageVersion::V0,
    (None, false)    => MessageVersion::Legacy,
}
```

**Stale generated protobuf drops the config.** `config` is field 7 on the `Message` protobuf, and protobuf clients silently discard fields their schema does not know — so a consumer built before it existed decodes a v1 message into something that looks exactly like v0 with no compute budget. In TypeScript the field arrived in `@triton-one/yellowstone-grpc` 6.0.0; a pin like `^5.0.9` loses every v1 budget.

Go has no release carrying the field at all: yellowstone-grpc checks its Go client in at `examples/golang/proto/`, generated before field 7, so the tag whose geyser plugin *sends* the config ships a client that drops it. [`scripts/gen-go-proto.sh`](scripts/gen-go-proto.sh) generates [`go/pb/`](go/pb) from the tag's `.proto` instead, and fails loudly if `Message.config` is missing.

## Reading a budget that works for every version

An indexer needs one accessor for all three versions. That is [`rust/src/budget.rs`](rust/src/budget.rs), [`ts/kit/src/lib/budget.ts`](ts/kit/src/lib/budget.ts), and [`go/txv1/budget.go`](go/txv1/budget.go): read `config` on v1, scan ComputeBudget instructions on legacy and v0, and normalise the priority fee so the two are comparable.

legacy/v0 states a *price* in micro-lamports per compute unit; v1 states a *total* in lamports. Comparing them means multiplying the v0 price by the compute unit limit — including the implicit `min(200_000 × instructions, 1_400_000)` when the transaction never set one — and rounding up:

```
20,000 CU × 250,000 micro-lamports/CU = 5,000 lamports   // v0
                                        5,000 lamports   // the v1 equivalent
```

Both gRPC indexers print this normalised budget for every transaction, whatever its version.

A facilitator, relayer, or simulation service has the same problem one layer up: it is handed a base64 transaction and has to price it before it knows the version. [`just ts-decode-budget`](ts/kit/src/decode-budget.ts) builds the same budget three ways and prints what comes back out of each; pass it a base64 transaction to read that one instead. It needs no validator.

## Setting a budget across versions

kit's setters do not all accept the same versions. Three of the four budget fields route by version on their own, so existing code that sets them keeps working when the message becomes v1:

| Setter | legacy / v0 | v1 |
|---|---|---|
| `setTransactionMessageComputeUnitLimit` | appends a ComputeBudget instruction | writes `config.computeUnitLimit` |
| `setTransactionMessageHeapSize` | appends a ComputeBudget instruction | writes `config.heapSize` |
| `setTransactionMessageLoadedAccountsDataSizeLimit` | appends a ComputeBudget instruction | writes `config.loadedAccountsDataSizeLimit` |
| `setTransactionMessagePriorityFeeLamports` | **rejected at compile time** | writes `config.priorityFeeLamports` |
| `setTransactionMessageComputeUnitPrice` | appends a ComputeBudget instruction | **rejected at compile time** |
| `setTransactionMessageConfig` | **rejected at compile time** | writes every field it is given |

The priority fee is the one that does not port, for the same reason it complicates reading: micro-lamports per compute unit and a total in lamports are different quantities, so they get different setters and neither accepts the other's versions. Only the type system enforces this — call the wrong one and the runtime attaches a `config` to a v0 message or a ComputeBudget instruction to a v1 one.

`setTransactionMessageConfig` merges into the config the message already holds, so `EXAMPLE_CONFIG` in [`ts/kit/src/send-decode.ts`](ts/kit/src/send-decode.ts) could be built up one field at a time; passing `undefined` unsets a field, and unsetting the last one removes `config` altogether.

`solana-go` draws the line elsewhere. `solana.TransactionV1Config(config)` both selects the v1 format and carries the whole budget, and its `With*` methods chain onto a zero `solana.TransactionConfig` — one setter rather than six, and no way to reach for the wrong one. What kit rejects at compile time, `solana.NewTransaction` rejects at runtime: a ComputeBudget instruction or a lookup table alongside a v1 config is an error, not a silent no-op.

[`ts/kit/test/wire.test.ts`](ts/kit/test/wire.test.ts) and [`go/txv1/wire_test.go`](go/txv1/wire_test.go) pin all of this down offline.

## Version requirements

| Component | Minimum | Why |
|---|---|---|
| Anza CLI / Agave | 4.2.0 | v1 support and `maxSupportedTransactionVersion: 1` |
| `solana-message` | 4.2.0 | `v1::Message` landed in 4.1.0; 4.2.0 adds the inherent `Message::serialize()` these examples call |
| `yellowstone-grpc-proto` | 12.6.0 | first release whose generated code has `Message.config` |
| yellowstone-grpc geyser | 15.1.1 | `convert_from` no longer downgrades v1 to v0 |
| `@solana/kit` | 8.0.0 | codecs and setters landed in 7.1.1; 8.0.0 types `createTransactionMessage({ version: 1 })` ([kit#1950](https://github.com/anza-xyz/kit/pull/1950)), so v1 builds through the same `pipe` as v0 |
| `@solana-program/token-2022` | 0.15.0 | the `confidential` entry point, its plan helpers, and `solana-conf-bal/v1` key derivation |
| `@solana/zk-sdk` | 0.5.1 | the WASM proof generation the confidential helpers call |
| Token-2022 program | `program@v11.0.0` | a build with `zk-ops` enabled — see above |
| `@solana/kit-plugin-rpc` | 0.19.0 | first planner taking `version: 1`, with a v1 arm keyed by `priorityFeeLamports` and loaded-accounts estimation |
| `@solana-program/system` | 0.14.1 | the `systemProgram()` plugin — `ts/kit-plugins` only; `ts/kit` stays on 0.13.0 |
| `@solana-program/token-2022` (plugin) | 0.16.1 | the `token2022Program()` plugin — `ts/kit-plugins` only; `ts/kit` stays on 0.15.0 |
| `@solana/kit-plugin-signer` | 0.19.0 | published alongside `@solana/kit-plugin-rpc` 0.19.0; supersedes the deprecated `kit-plugin-payer` and `kit-plugin-airdrop` |
| `@solana/web3.js` | 1.99.0-beta.0 | first 1.x prerelease with `MessageV1`; deserializes v1 but cannot serialize it |
| `@solana/web3.js` (3.x) | 3.0.0-rc.3 | `MessageV1.compile`, which writes v1 and takes kit instructions and plans — `ts/web3js-v3` |
| `@triton-one/yellowstone-grpc` | 6.0.0 | first release whose generated code has `Message.config`; 5.0.9 and earlier drop field 7 |
| `solders` | 0.29.0 | first release with `MessageV1`, and the first to serialize versioned messages with wincode |
| Go | 1.25 | the toolchain the `grpc-go` and `golang.org/x` dependencies require |
| `solana-go` | 2.0.0 | first stable release on the `/v2` module path; carries the v1 format from [solana-go#481](https://github.com/solana-foundation/solana-go/pull/481) |

### These examples pin `yellowstone-grpc-proto` directly

`yellowstone-grpc-client` 13.3.0 only requires `yellowstone-grpc-proto = "12.5.0"`, which has no field 7 — so on a lockfile written before 2026-08-13 the resolver picks a proto crate that drops every v1 config without erroring. [`rust/Cargo.toml`](rust/Cargo.toml) pins 12.6.0 directly, and CI runs `--locked` so a resolution change fails the build rather than drifting.

### These examples use the v2 `solana-go` module path

SIMD-0385 support landed in [PR #481](https://github.com/solana-foundation/solana-go/pull/481) — `solana.TransactionConfig`, `solana.MessageVersionV1`, and the `solana.TransactionV1Config` build option — and shipped in v1.23.0 and v2.0.0.

The Go examples import `github.com/solana-foundation/solana-go/v2`. v2 moved the module path off `github.com/gagliardetto/solana-go` and reworked `rpc/ws` and the loader packages, none of which these examples use — the same code builds against the v1 line with only the import path changed.

## Configuration

Every example reads its endpoints from the environment; the Rust and Go binaries also accept equivalent flags.

| Variable | Default | Used by |
|---|---|---|
| `TXV1_RPC_URL` | `http://127.0.0.1:8899` | all examples and tests |
| `TXV1_RPC_SUBSCRIPTIONS_URL` | `ws://127.0.0.1:8900` | TypeScript examples and tests |
| `TXV1_GRPC_URL` | `http://127.0.0.1:10000` | gRPC indexers and tests |
| `TOKEN_2022_TAG` | `program@v11.0.0` | which Token-2022 release the validator scripts fetch; the `just` recipes pin it, so override with `just --set token_2022_tag …` |
| `TXV1_LIVE` | unset | set to `1` to un-skip the TypeScript and Go live tests |
| `TXV1_EXIT_AFTER_V1` | unset | stop the TypeScript or Go transaction indexer after N v1 transactions |
| `TXV1_EXIT_AFTER_V1_BLOCKS` | unset | stop the TypeScript or Go block indexer after N blocks holding v1 |

Rust flags: `--rpc-url`, `--grpc-url`, `--slot` (get-block), `--exit-after-v1` / `--exit-after-v1-blocks` (indexers). Go takes the same names single-dashed.

## Testing

```sh
just test       # offline: wire format, codecs, version discrimination
just test-live  # everything, against a validator started for the run
just check      # what CI runs on every PR, minus the live tests
```

Live tests start a 4.2.1 validator with the geyser plugin, send real v1 traffic, and assert on what comes back over JSON-RPC and gRPC. CI runs both jobs on every pull request, and the live job downloads the prebuilt geyser plugin for x86_64 Linux rather than paying for a source build.

## Layout

```
rust/src/bin/         Rust example binaries, one per example
rust/src/             the Rust library they share
rust/tests/           offline and live tests
ts/kit/src/           @solana/kit example scripts, one per example
ts/kit/src/lib/       the modules they share
ts/kit/test/          offline and live tests
ts/kit-plugins/src/   @solana/kit plugin-client example scripts, plus the lib/ they share
ts/web3js-legacy/src/ @solana/web3.js 1.x example scripts
ts/web3js-v3/src/     @solana/web3.js 3.x example scripts, plus the lib/ they share
python/examples/      Python example scripts, one per example
python/src/txv1/      the package they share
python/tests/         offline and live tests
go/cmd/               Go example commands, one per example
go/txv1/              the Go package they share, plus offline and live tests
go/pb/                generated Yellowstone protobuf bindings
scripts/              validator, geyser plugin, Token-2022, and protobuf bootstrap
```

Each language directory is self-contained: `rust/` is a single Cargo package, `ts/` a pnpm workspace with one package per client library, `python/` a single hatchling package, and `go/` a single Go module, all driven from the root `Justfile`.

Runnable examples are separate from the code they share everywhere. A file directly under a `src/`, `examples/`, `src/bin/`, or `cmd/` directory is an entry point: it runs top to bottom and has a `just` recipe. The `lib/` and shared-package modules are importable and free of side effects, and mirror each other — `budget` reads a compute budget from any version, `grpc` and `rpc` wrap the two transports, `feature` checks the activation gate, `send` builds and sends a v1 transfer, and `confidential` (TypeScript only) sets up a confidential transfer. Python has no `budget` or `grpc`, since it ships no gRPC example. Go keeps them in one package, one file per module.


## Additional Resources

- [Transaction V1 - solana.com](https://solana.com/upgrades/larger-transaction-sizes)
- [YouTube: SolAndy Transaction v1 Solana Tutorial - Aug 22nd '26](https://www.youtube.com/watch?v=BIvGszvDOtw)
