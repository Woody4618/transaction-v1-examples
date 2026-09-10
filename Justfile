set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

solana_version := "4.2.1"
yellowstone_tag := "v15.1.2+solana.4.2.0"
token_2022_tag := "program@v11.0.0"

_default:
    @just --list

# Setup

# Install Rust, TypeScript, Python, and Go dependencies.
setup: _py-install
    cd rust && cargo fetch --locked
    cd ts && pnpm install
    cd go && go mod download

# Create the Python virtualenv and install the package into it.
[private]
_py-install:
    #!/usr/bin/env bash
    set -euo pipefail
    cd python
    [ -d .venv ] || python3 -m venv .venv
    .venv/bin/pip install --quiet -e '.[dev]' -c requirements.txt

# Install the Anza CLI this repo is pinned to.
setup-solana:
    sh -c "$(curl -sSfL https://release.anza.xyz/v{{ solana_version }}/install)"
    solana --version

# Fetch or build the Yellowstone geyser plugin into .local/.
setup-geyser:
    YELLOWSTONE_TAG={{ yellowstone_tag }} ./scripts/setup-geyser.sh

# Fetch the Token-2022 program the validator loads for confidential transfers.
setup-token-2022:
    TOKEN_2022_TAG={{ token_2022_tag }} ./scripts/setup-token-2022.sh

# Regenerate go/pb/ from the pinned yellowstone-grpc protobuf definitions.
gen-go-proto:
    YELLOWSTONE_TAG={{ yellowstone_tag }} ./scripts/gen-go-proto.sh

# Formatting

fmt: _py-install
    cd rust && cargo fmt --all
    cd ts && pnpm exec oxfmt .
    cd python && .venv/bin/ruff format .
    cd go && gofmt -w .

fmt-check: _py-install
    cd rust && cargo fmt --all --check
    cd ts && pnpm exec oxfmt --check .
    cd python && .venv/bin/ruff format --check .
    cd go && test -z "$(gofmt -l .)"

# Linting

lint: _py-install
    cd rust && cargo clippy --locked --all-targets -- -D warnings
    cd ts && pnpm exec oxlint
    cd python && .venv/bin/ruff check .
    cd go && go vet ./...

typecheck: _py-install
    cd ts && pnpm exec tsc -p kit/tsconfig.json --noEmit && pnpm exec tsc -p kit-plugins/tsconfig.json --noEmit && pnpm exec tsc -p web3js-legacy/tsconfig.json --noEmit && pnpm exec tsc -p web3js-v3/tsconfig.json --noEmit && pnpm exec tsc -p wallet-table/tsconfig.json --noEmit
    cd python && .venv/bin/mypy
    cd go && go build ./...

# Testing

# Offline tests only — no validator required.
test: _py-install
    cd rust && cargo test --locked
    cd ts/kit && pnpm exec vitest run test/wire.test.ts test/budget.test.ts
    cd python && .venv/bin/pytest
    cd go && go test ./...

# Every test, including the ones that need a validator and geyser plugin.
test-live: _py-install
    just validator-start
    just _test-live-inner || (just validator-stop && exit 1)
    just validator-stop

_test-live-inner:
    cd rust && cargo test --locked -- --include-ignored --test-threads=1
    cd ts/kit && TXV1_LIVE=1 pnpm exec vitest run
    cd python && .venv/bin/pytest -m live
    cd go && TXV1_LIVE=1 go test ./... -p 1

# Everything CI runs, minus the live tests.
check: fmt-check lint typecheck test

# Local validator

validator-start:
    YELLOWSTONE_TAG={{ yellowstone_tag }} TOKEN_2022_TAG={{ token_2022_tag }} ./scripts/validator.sh start

validator-stop:
    ./scripts/validator.sh stop

# Examples (require a running validator: `just validator-start`)

send-decode:
    cd rust && cargo run --bin send-decode

get-block slot="":
    cd rust && cargo run --bin get-block -- {{ if slot == "" { "" } else { "--slot " + slot } }}

grpc-tx-indexer:
    cd rust && cargo run --bin grpc-tx-indexer

grpc-block-indexer:
    cd rust && cargo run --bin grpc-block-indexer

ts-send-decode:
    cd ts/kit && pnpm exec tsx src/send-decode.ts

ts-estimate:
    cd ts/kit && pnpm exec tsx src/estimate.ts

# Read the compute budget out of a base64 transaction of any version. Needs no validator.
ts-decode-budget base64="":
    cd ts/kit && pnpm exec tsx src/decode-budget.ts '{{ base64 }}'

ts-confidential-transfer:
    cd ts/kit && pnpm exec tsx src/confidential-transfer.ts

ts-nonce:
    cd ts/kit && pnpm exec tsx src/nonce.ts

ts-get-block slot="":
    cd ts/kit && pnpm exec tsx src/get-block.ts {{ slot }}

ts-grpc-tx-indexer:
    cd ts/kit && pnpm exec tsx src/grpc-tx-indexer.ts

ts-grpc-block-indexer:
    cd ts/kit && pnpm exec tsx src/grpc-block-indexer.ts

# Send and read a v1 transfer through a @solana/kit plugin client.
kp-send-decode:
    cd ts/kit-plugins && pnpm exec tsx src/send-decode.ts

# Send a whole Token-2022 confidential transfer through a @solana/kit plugin client.
kp-confidential-transfer:
    cd ts/kit-plugins && pnpm exec tsx src/confidential-transfer.ts

# Read a v1 transaction back over JSON-RPC with the @solana/web3.js 1.x beta. Pass a signature to read an existing one.
w3-read-transaction signature="":
    cd ts/web3js-legacy && pnpm exec tsx src/read-transaction.ts {{ signature }}

# Send a v1 transfer with @solana/web3.js 3.x, read it back, and decode the wire bytes.
w3v3-send-decode:
    cd ts/web3js-v3 && pnpm exec tsx src/send-decode.ts

# Send a whole Token-2022 confidential transfer in one v1 transaction with @solana/web3.js 3.x.
w3v3-confidential-transfer:
    cd ts/web3js-v3 && pnpm exec tsx src/confidential-transfer.ts

# Browser page listing installed wallets and whether each supports v1.
wallet-table:
    cd ts/wallet-table && pnpm dev

py-send-decode: _py-install
    cd python && .venv/bin/python examples/send_decode.py

py-get-block slot="": _py-install
    cd python && .venv/bin/python examples/get_block.py {{ slot }}
go-send-decode:
    cd go && go run ./cmd/send-decode

go-get-block slot="":
    cd go && go run ./cmd/get-block {{ if slot == "" { "" } else { "-slot " + slot } }}

go-grpc-tx-indexer:
    cd go && go run ./cmd/grpc-tx-indexer

go-grpc-block-indexer:
    cd go && go run ./cmd/grpc-block-indexer

# Run every example end to end against a fresh validator.
demo:
    just validator-start
    just _demo-inner || (just validator-stop && exit 1)
    just validator-stop

_demo-inner:
    just send-decode
    just get-block
    just ts-send-decode
    just ts-estimate
    just ts-decode-budget
    just ts-nonce
    just ts-get-block
    just ts-confidential-transfer
    just kp-send-decode
    just kp-confidential-transfer
    just w3-read-transaction
    just w3v3-send-decode
    just w3v3-confidential-transfer
    just py-send-decode
    just py-get-block
    just go-send-decode
    just go-get-block
    ./scripts/demo-indexers.sh
