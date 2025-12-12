# Solana Anchor Data Validation

This guide explains how to validate Solana anchor account data against payload files using the automated validation tool.

## Overview

The validation tool fetches anchor account data from Solana's blockchain and compares it against a local payload file to ensure they match. This is useful for:

- Verifying Squads multisig vault transactions before execution
- Auditing that the on-chain transaction matches your expected payload
- Debugging discrepancies between generated payloads and actual on-chain data

The tool supports **two payload formats**:
1. **Base58 Transaction Message Format** - Standard Squads format with `base58TransactionMessage`
2. **Enforced Options Format** - Array format with hex data for cross-chain operations

## Prerequisites

- Node.js and pnpm installed
- Solana RPC access (defaults to public RPC endpoints)
- A payload file and Solana anchor account address

## Usage

### Basic Command

```bash
# Using direct anchor address
pnpm hardhat lz:oft:solana:validate-anchor-data \
  --payload-file <path-to-payload.json> \
  --anchor-address <solana-address>

# Using Solana Explorer URL (easier - just copy/paste from browser!)
pnpm hardhat lz:oft:solana:validate-anchor-data \
  --payload-file <path-to-payload.json> \
  --anchor-url "https://explorer.solana.com/address/<ADDRESS>/anchor-account"
```

### Examples

**Option 1: Using Explorer URL (Recommended - Just Copy/Paste!)**
```bash
pnpm hardhat lz:oft:solana:validate-anchor-data \
  --payload-file payloads/2025-12-03_solana-evm-enforced-options.json \
  --anchor-url "https://explorer.solana.com/address/8YfeVjc2VPjXynChmVyJAYEY5iyrK3CegEaXu38XfdKr/anchor-account"
```

**Option 2: Using Direct Address**
```bash
pnpm hardhat lz:oft:solana:validate-anchor-data \
  --payload-file payloads/2025-12-03_solana-evm-enforced-options.json \
  --anchor-address 8YfeVjc2VPjXynChmVyJAYEY5iyrK3CegEaXu38XfdKr
```

### With Custom RPC Endpoint

```bash
pnpm hardhat lz:oft:solana:validate-anchor-data \
  --payload-file payloads/2025-12-03_solana-evm-enforced-options.json \
  --anchor-url "https://explorer.solana.com/address/8YfeVjc2VPjXynChmVyJAYEY5iyrK3CegEaXu38XfdKr/anchor-account" \
  --rpc https://your-rpc-endpoint.com
```

### Specifying Cluster

The tool automatically detects the cluster from the URL, but you can override it:

```bash
pnpm hardhat lz:oft:solana:validate-anchor-data \
  --payload-file payloads/test-payload.json \
  --anchor-address DevnetAddress123... \
  --cluster devnet
```

Available clusters: `mainnet-beta`, `testnet`, `devnet`

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `--payload-file` | Yes | - | Path to the JSON payload file to validate against |
| `--anchor-address` | No* | - | Solana anchor account address (raw address) |
| `--anchor-url` | No* | - | Solana Explorer URL with anchor account (easier - just copy from browser!) |
| `--rpc` | No | Public RPC | Custom Solana RPC endpoint URL |
| `--cluster` | No | `mainnet-beta` | Solana cluster name (auto-detected from URL if provided) |

\* **Either `--anchor-address` or `--anchor-url` must be provided**

### Supported URL Formats

The `--anchor-url` parameter accepts various formats:
- Full URL: `https://explorer.solana.com/address/<ADDRESS>/anchor-account`
- With cluster: `https://explorer.solana.com/address/<ADDRESS>/anchor-account?cluster=mainnet-beta`
- Without protocol: `explorer.solana.com/address/<ADDRESS>`
- Just the address: `<ADDRESS>` (treated same as `--anchor-address`)

## What It Validates

The tool performs the following checks:

### 1. Account Address Validation
- ✓ Verifies the address from the payload exists in the vault transaction's account keys

### 2. EID Validation
- ✓ Confirms the EID (Endpoint ID) from the payload matches the expected Solana mainnet EID (30168)

### 3. Instruction Data Validation
- ✓ Extracts instruction data from the anchor account
- ✓ Verifies all instruction data bytes are embedded in the payload hex data
- ✓ Decodes EIDs from each instruction
- ✓ Matches decoded EIDs against the payload description

### 4. Description Validation
- ✓ Displays the human-readable description for manual review

## Example Output

```
🔍 Solana Anchor Data Validator
════════════════════════════════════════════════════════════════════════════════

📡 Fetching anchor account: 8YfeVjc2VPjXynChmVyJAYEY5iyrK3CegEaXu38XfdKr
✓ Account found (419 bytes)

🔓 Decoding VaultTransaction...
  Multisig: CHnvkrsy37qheATdjgFNifbCngnDQARhvrtFu7iC3vDM
  Creator: C7TRnjCEEaVFbuKHzRGF9Qy4GH7LVxmr6Gmb7jn8Zch5
  Transaction Index: 4
  Vault Index: 0
  Instructions: 2
  Account Keys: 5

📋 Account Keys:
  #0: EwXp4sepbKE7aoSn6Q4APR26BKWoqsc7hKq8NtCUpC1K
  #1: 3o8ftmZfUkEMYhwSNrRcwmubWWeVbjGQPLFqZ6xHdgnM
  ...

📝 Instructions:
  Instruction #0:
    Program: HYVSSRw542kNTAa2x8Ub3tb2ygK6bJEW7pHtP6GwguqP
    Data (hex): 4fbba8398b8c5d2f9e75...
    Decoded EID: 30110
  ...

════════════════════════════════════════════════════════════════════════════════
🔍 VALIDATION AGAINST PAYLOAD
════════════════════════════════════════════════════════════════════════════════

1️⃣  Validating Account Address
────────────────────────────────────────────────────────────────────────────────
   ✓ PASS - Address found in account keys

2️⃣  Validating EID (from payload point)
────────────────────────────────────────────────────────────────────────────────
   ✓ PASS - EID is 30168 (Solana mainnet)

3️⃣  Validating Instruction Data
────────────────────────────────────────────────────────────────────────────────
   ✓ PASS - All instructions found in payload

4️⃣  Validating Description
────────────────────────────────────────────────────────────────────────────────
   Description: Setting enforced options to [...]

════════════════════════════════════════════════════════════════════════════════
✅ VALIDATION PASSED
════════════════════════════════════════════════════════════════════════════════
```

## Finding the Anchor Address

### Method 1: Using Explorer URL (Easiest!)

1. Go to Squads UI and open your transaction
2. Click on the transaction details
3. Look for "View on Solana Explorer" or similar link
4. You'll be taken to a URL like: `https://explorer.solana.com/address/<ADDRESS>/anchor-account`
5. **Copy the entire URL** and use it with `--anchor-url`

### Method 2: Extract Address Manually

From the Squads UI:
1. Open your multisig transaction
2. Click transaction details
3. Find the vault transaction address
4. Use it with `--anchor-address`

Alternatively, from Solana Explorer:
1. Navigate to the transaction
2. Look for the "Anchor Account" section  
3. Copy the address from the URL or account details

## Payload File Formats

The validator automatically detects and supports two payload formats:

### Format 1: Base58 Transaction Message (Standard Squads Format)

This is the standard format generated by Squads multisig operations:

```json
{
  "base58TransactionMessage": "241EGCWfxdBj8sr2vL4Lxn9F...",
  "multisig": "EwXp4sepbKE7aoSn6Q4APR26BKWoqsc7hKq8NtCUpC1K",
  "multisigPda": "CHnvkrsy37qheATdjgFNifbCngnDQARhvrtFu7iC3vDM",
  "description": "GUID rate limit override",
  "actions": [
    "ADD 0x705e877032dc7434335b8652f50423f5380ece26f97ad79d8e1f394ebee280e6"
  ],
  "timestamp": "2025-11-25T22:51:22.027Z"
}
```

**Validation checks for this format:**
- ✓ Multisig PDA matches
- ✓ Instruction count matches
- ✓ Instruction data matches (decoded from base58 message)
- ✓ Program IDs match
- ✓ Fee payer (vault) matches
- ✓ Description and actions displayed

### Format 2: Enforced Options (Cross-Chain Format)

This format is used for cross-chain LayerZero operations with embedded hex data:

```json
[
  {
    "point": {
      "eid": 30168,
      "address": "5xgwxqVYWeZVjGRr45spDU9KW8yXenYigRfeshoKNyG2"
    },
    "data": "0x02000307...",
    "description": "Setting enforced options to [...]"
  }
]
```

**Validation checks for this format:**
- ✓ Account address found in transaction
- ✓ EID is correct for Solana (30168 for mainnet)
- ✓ All instruction data embedded in payload hex data
- ✓ Decoded EIDs from instructions match description
- ✓ Description displayed

The tool automatically detects which format your payload uses and applies the appropriate validation logic.

## Troubleshooting

### Error: Account not found

- Verify the anchor address is correct
- Ensure you're using the right cluster (mainnet vs testnet vs devnet)
- Check that the transaction has been created on-chain

### Error: RPC rate limit exceeded

- Use a custom RPC endpoint with `--rpc`
- Consider using a paid RPC provider (Helius, Alchemy, QuickNode)

### Validation Failed

If validation fails:
1. Review the specific checks that failed in the output
2. Compare the decoded instruction data with the payload
3. Verify the payload file matches the intended transaction
4. Check if the on-chain transaction was modified after payload generation

### Connection Timeout

- The default public RPC can be slow
- Use a faster RPC endpoint with `--rpc`
- Retry the command

## Integration with CI/CD

You can use this tool in CI/CD pipelines:

```bash
#!/bin/bash
set -e

# Validate before executing
pnpm hardhat lz:oft:solana:validate-anchor-data \
  --payload-file payloads/production-tx.json \
  --anchor-address $ANCHOR_ADDRESS \
  --rpc $SOLANA_RPC

if [ $? -eq 0 ]; then
  echo "✅ Validation passed, safe to execute"
else
  echo "❌ Validation failed, aborting"
  exit 1
fi
```

## Related Documentation

- [Solana Multisig Payloads Guide](./SOLANA_MULTISIG_PAYLOADS.md)
- [Squads Protocol Documentation](https://docs.squads.so/)
- [LayerZero Solana Integration](https://layerzero.network/developers)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the validation output for specific error messages
3. Consult the LayerZero documentation
4. Open an issue in the repository

