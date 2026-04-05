# Mechanism Security: Replay Protection

Each chain mechanism uses a different replay protection strategy. This document
describes the approach per mechanism.

## EVM (exact, upto, permit2-proxy)

- **Strategy**: On-chain nonce (EIP-3009 `authorizationState`)
- **Verification**: Facilitator calls `authorizationState(from, nonce)` on the
  token contract to check if the nonce has been used
- **Guarantee**: On-chain — cannot be replayed once settled

## TON (exact, upto)

- **Strategy**: Wallet sequence number (`seqno`)
- **Verification**: Facilitator checks current seqno vs payload seqno. Once the
  wallet processes a message, seqno increments and the old message is invalid
- **Guarantee**: On-chain — inherent to TON wallet contracts

## SVM / Solana (exact)

- **Strategy**: Transaction signature uniqueness
- **Verification**: Solana rejects duplicate transaction signatures at the
  runtime level. Each transaction has a unique `recentBlockhash` that expires
- **Guarantee**: On-chain — protocol-level deduplication

## Tron (exact)

- **Strategy**: In-memory payload hash cache + expiration window
- **Verification**: Facilitator hashes (signedTransaction + from + to + amount)
  and tracks processed payloads. Expiration check prevents replay after window.
- **Guarantee**: Application-level — resets on facilitator restart.
  On-chain replay still prevented by Tron's transaction hash uniqueness.

## Stellar (exact)

- **Strategy**: In-memory payload hash cache + ledger expiry (`maxLedger`)
- **Verification**: Facilitator hashes (signedXDR + from + to + amount)
  and tracks processed payloads. maxLedger check prevents late replay.
- **Guarantee**: Application-level — resets on facilitator restart.
  On-chain replay prevented by Stellar's transaction sequence numbers.

## BTC (exact, lightning)

- **Strategy**: UTXO model — inherently replay-proof
- **Verification**: Each UTXO can only be spent once. The PSBT references
  specific UTXOs that become invalid after spending.
- **Guarantee**: On-chain — fundamental to Bitcoin's design

## Cosmos, NEAR, Polkadot, Stacks, Tezos

- **Strategy**: Account sequence numbers / nonces
- **Verification**: Each chain enforces monotonically increasing sequence
  numbers per account. Facilitator verifies the transaction includes the
  correct sequence.
- **Guarantee**: On-chain — protocol-level enforcement

## Algorand, Hedera, Sui

- **Status**: Skeleton implementations only (types defined, no logic)
- **Replay protection**: Not yet implemented
