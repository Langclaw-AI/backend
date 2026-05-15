# Smart Contract Team Notes

## Purpose

Langclaw needs a new smart contract for prepaid native 0G deposits.

The contract should act as a usage vault. Users deposit 0G first. The backend verifies the deposit transaction, credits the user's internal Langclaw balance, then deducts that balance when the user runs research.

The smart contract team owns the contract implementation. The backend team only needs the deployed address, ABI, and event shape.

## Contract Scope

Create a new contract named `LangclawUsageVault`.

The contract should handle:

- Native 0G deposit.
- Native 0G withdrawal.
- Pause and unpause controls.
- Events that let the backend verify deposits and withdrawals.

The contract should not handle:

- AI model pricing.
- Token usage calculation.
- Per-research balance deduction.
- 0G Router billing.
- Research output proof.
- `SignalGraphRegistry` changes.

Backend ledger remains the source of truth for app usage balance.

## Required Interface

The backend expects these callable entrypoints:

```solidity
receive() external payable;
function deposit(bytes32 reference) external payable;
function withdraw(uint256 amount) external;
function pause() external onlyOwner;
function unpause() external onlyOwner;
```

`reference` should be a backend-generated value. It can link a deposit transaction to a wallet session, quote, or top-up request.

## Required Events

The backend expects these events:

```solidity
event Deposit(address indexed payer, uint256 amount, bytes32 indexed reference);
event Withdrawal(address indexed payer, uint256 amount);
event VaultPaused(address indexed owner);
event VaultUnpaused(address indexed owner);
```

The backend will use `Deposit` to verify top-ups.

Required fields:

- `payer` must equal the wallet that signed the Langclaw session.
- `amount` must equal the native 0G value credited to the internal balance.
- `reference` must match the backend top-up request when the user uses the `deposit(bytes32 reference)` function.

## Required Checks

The contract should enforce these checks:

- Reject zero-value deposits.
- Reject zero-value withdrawals.
- Block deposits while paused.
- Block withdrawals while paused.
- Protect withdrawals against reentrancy.
- Use native 0G only.
- Use custom errors.
- Keep owner actions limited to pause and unpause for v1.

## Withdrawal Behavior

Users should be able to withdraw unused 0G from the vault.

The contract should only release funds that belong to the caller. If the smart contract tracks per-user balances, withdrawals must reduce the caller's contract balance before sending funds.

The backend will also maintain its own internal ledger. The backend should mark a withdrawal request as pending or completed after it verifies the withdrawal event.

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
- Any constructor arguments, if used.

## Backend Integration Expectations

The backend will verify each deposit before crediting internal balance.

Verification rules:

- Transaction receiver must equal `LANGCLAW_USAGE_VAULT_ADDRESS`.
- Transaction sender must equal the signed wallet.
- Transaction must be confirmed on the expected 0G chain.
- Transaction hash can only be credited once.
- Deposit event `payer` must equal the signed wallet.
- Deposit event `amount` must match the credited amount.
- Deposit event `reference` should match the top-up request when present.

The backend will handle:

- User balance ledger.
- Deposit credit.
- Research usage reservation.
- Model usage charge.
- Internal refund if a research run fails after reservation.
- Live 0G Router price lookup.
- Actual cost calculation from model token usage.

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
- Withdrawal is protected against reentrancy.
- `SignalGraphRegistry` remains unchanged.
