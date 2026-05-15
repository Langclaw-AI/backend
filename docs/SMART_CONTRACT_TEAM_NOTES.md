# Smart Contract Team Notes

## Purpose

Langclaw needs a mainnet smart contract for prepaid native 0G deposits.

The contract should act as a deposit vault for app usage balance. Users deposit native 0G first. The backend verifies the deposit transaction, credits the user's internal Langclaw balance, then deducts that internal balance when the user runs research or inference.

The smart contract team owns the contract implementation. The backend team only needs the deployed address, ABI, event shape, and deployment metadata.

## Current Product Flow

The expected flow is:

```text
User connects wallet
User deposits native 0G to LangclawUsageVault
Backend verifies the on-chain deposit
Backend credits the user's Langclaw prepaid ledger
User runs research or inference
Backend pays 0G Router from the backend Router account
Backend deducts the user's Langclaw prepaid ledger
```

Important custody detail:

- User deposit funds go to `LangclawUsageVault`.
- User deposit funds do not automatically top up the backend 0G Router balance.
- The backend 0G Router account must be funded separately in `pc.0g.ai`.
- Langclaw needs operational Router balance to pay inference before or while user deposits accumulate in the vault.

## Contract Scope

Create a new contract named `LangclawUsageVault`.

The contract should handle:

- Native 0G deposits.
- Safe withdrawal flow for unused user funds.
- Pause and unpause controls.
- Events that let the backend verify deposits and withdrawals.

The contract should not handle:

- AI model pricing.
- Token usage calculation.
- Per-research balance deduction.
- 0G Router billing.
- 0G Direct account-management or provider sub-account funding.
- Research output proof.
- `SignalGraphRegistry` changes.

Backend ledger remains the source of truth for app usage balance.

## Required Interface

The backend expects these callable entrypoints for v1 compatibility:

```solidity
receive() external payable;
function deposit(bytes32 reference) external payable;
function withdraw(uint256 amount) external;
function pause() external onlyOwner;
function unpause() external onlyOwner;
```

`reference` should be a backend-generated `bytes32` value. It can link a deposit transaction to a wallet session, quote, or top-up request.

If users deposit through `receive()`, the contract must still emit a `Deposit` event with a deterministic empty reference such as `bytes32(0)`.

## Required Events

The backend expects these events:

```solidity
event Deposit(address indexed payer, uint256 amount, bytes32 indexed depositReference);
event Withdrawal(address indexed payer, uint256 amount);
event VaultPaused(address indexed owner);
event VaultUnpaused(address indexed owner);
```

The event parameter name `depositReference` is preferred because the backend currently decodes the log with that name. The on-chain signature only depends on types, but matching the name avoids ABI confusion.

The backend will use `Deposit` to verify top-ups.

Required deposit fields:

- `payer` must equal the wallet that signed the Langclaw session.
- `amount` must equal the native 0G value credited to the internal balance.
- `depositReference` must match the backend top-up request when the user uses `deposit(bytes32 reference)`.

## Required Checks

The contract should enforce these checks:

- Reject zero-value deposits.
- Reject zero-value withdrawals.
- Block deposits while paused.
- Block withdrawals while paused.
- Protect withdrawals against reentrancy.
- Use native 0G only.
- Use custom errors.
- Emit `Deposit` for both `deposit(bytes32)` and `receive()`.
- Keep owner actions limited to pause, unpause, and any explicitly agreed emergency recovery path.

## Withdrawal Safety Requirement

Do not ship an unrestricted user withdrawal that lets a wallet withdraw its full raw deposited amount after it has already spent prepaid balance in Langclaw.

Reason:

- Usage charges are calculated and deducted in the backend ledger.
- The v1 contract does not know every research or inference charge.
- A contract mapping that only tracks raw deposits would become stale after backend usage deductions.
- If users can withdraw from that stale on-chain balance, they can spend app balance and then withdraw the same funds.

Recommended safe options:

1. Backend-authorized withdrawal:
   - User requests withdrawal in the app.
   - Backend checks the user's available off-chain balance.
   - Backend signs or submits an authorization for the unused amount.
   - Contract releases only the authorized amount.
   - Contract prevents replay with nonce or consumed withdrawal id.

2. Operator-processed withdrawal:
   - User requests withdrawal in the app.
   - Backend debits or reserves the internal ledger.
   - Operator wallet sends the withdrawal from the vault.
   - Contract emits `Withdrawal`.

If the team wants self-service withdrawal, propose a revised interface before implementation. A signed withdrawal interface is safer than plain `withdraw(uint256 amount)` for the current off-chain ledger model.

The backend currently exposes withdraw request metadata only. Production withdrawal completion should not be enabled until the contract withdrawal model and backend verification endpoint are aligned.

## Deployment Target

Deploy to:

```text
Network: 0G Mainnet
Chain ID: 16661
Native token: 0G
Env output: LANGCLAW_USAGE_VAULT_ADDRESS
```

Backend RPC envs:

```text
OG_CHAIN_RPC_URL=https://evmrpc.0g.ai
OG_RPC_URL=https://evmrpc.0g.ai
```

The final deployment note should include:

- Contract address.
- Chain ID.
- Deployment transaction hash.
- ABI file or ABI JSON.
- Owner address.
- Pauser address, if different from owner.
- Withdrawal authority address, if used.
- Any constructor arguments, if used.
- Whether the source is verified on the explorer.

## Backend Integration Expectations

The backend will verify each deposit before crediting internal balance.

Deposit verification rules:

- Transaction receiver must equal `LANGCLAW_USAGE_VAULT_ADDRESS`.
- Transaction sender must equal the signed wallet.
- Transaction must be confirmed on the expected 0G chain.
- Transaction status must be success.
- Transaction value must be greater than zero.
- Transaction hash can only be credited once.
- Deposit event `payer` must equal the signed wallet.
- Deposit event `amount` must match the transaction value.
- Deposit event `depositReference` should match the top-up request when present.

The backend will handle:

- User balance ledger.
- Deposit credit.
- Research usage reservation.
- Model usage charge.
- Internal refund if a research run fails after reservation.
- Live 0G Router price lookup.
- Actual cost calculation from Router trace or token usage.
- 30 percent markup by default through `LANGCLAW_USAGE_MARKUP_BPS=3000`.

## Router Balance Is Separate

Do not wire the vault to the 0G Router account.

The backend Router account is managed through 0G Platform and `OG_COMPUTE_API_KEY`. User vault deposits are Langclaw prepaid app balance. They are not Router provider sub-account funds and they are not 0G Direct ledger funds.

The 0G Direct account-management flow is out of scope for this contract:

- `broker.ledger.getLedger()`
- `broker.ledger.depositFund()`
- `broker.ledger.transferFund(provider, "inference", amount)`
- `broker.inference.getAccountWithDetail(provider)`
- `broker.ledger.retrieveFund("inference")`
- `broker.ledger.refund(amount)`

## Do Not Change SignalGraphRegistry

`SignalGraphRegistry` is only for research proof.

It stores:

- Brief hash.
- Storage URI.
- Creator wallet.
- Timestamp.

Do not add deposit logic to `SignalGraphRegistry`. Keep payment vault logic in `LangclawUsageVault`.

## Acceptance Checklist

Before handing the contract to backend, confirm:

- `LangclawUsageVault` is deployed on 0G Mainnet.
- `LANGCLAW_USAGE_VAULT_ADDRESS` is available.
- ABI is shared with backend.
- Deposit emits `Deposit`.
- Withdrawal emits `Withdrawal`.
- Zero deposit is rejected.
- Zero withdrawal is rejected.
- Pause blocks deposit and withdrawal.
- Unpause restores deposit and withdrawal.
- Withdrawal cannot release funds already spent in the backend ledger.
- Withdrawal is protected against reentrancy.
- Replay protection exists for backend-authorized withdrawals, if used.
- `SignalGraphRegistry` remains unchanged.
