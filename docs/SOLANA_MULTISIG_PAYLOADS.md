# Solana Multisig Payload Guide

This guide explains how to generate and execute Solana multisig payloads for GMX OFT operations using **Squads V4**.

> **⚠️ Squads V4 Only**: This tooling is designed specifically for Squads V4. It will **not work with Squads V3** due to different transaction message formats and multisig architecture.

GMX's multisig program is Squads V4.

**GMX Multisig Addresses:**
- **Multisig PDA** (where proposals are created): `CHnvkrsy37qheATdjgFNifbCngnDQARhvrtFu7iC3vDM`
  - [View on Solscan](https://solscan.io/account/CHnvkrsy37qheATdjgFNifbCngnDQARhvrtFu7iC3vDM)
  - 8 members, 5 of 8 approval threshold
  
- **Vault** (OFT Store admin): `EwXp4sepbKE7aoSn6Q4APR26BKWoqsc7hKq8NtCUpC1K`
  - [View on Solscan](https://solscan.io/account/EwXp4sepbKE7aoSn6Q4APR26BKWoqsc7hKq8NtCUpC1K)
  - PDA controlled by the multisig, signs transactions after approval
  - This is the admin of your OFT Store

---

## Table of Contents

- [Quick Start](#quick-start)
- [Understanding Squads V4](#understanding-squads-v4)
- [Available Commands](#available-commands)
- [Creating Proposals](#creating-proposals)
- [Payload Structure](#payload-structure)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

**To create a multisig proposal (recommended workflow):**

```bash
# 1. Generate payload with base58 transaction message
pnpm hardhat lz:oft:solana:set-guid-rate-limit-override \
  --eid 30168 \
  --program-id HYVSSRw542kNTAa2x8Ub3tb2ygK6bJEW7pHtP6GwguqP \
  --oft-store 5xgwxqVYWeZVjGRr45spDU9KW8yXenYigRfeshoKNyG2 \
  --guids <YOUR_GUID> \
  --actions add \
  --execute-immediately false \
  --multisig-key EwXp4sepbKE7aoSn6Q4APR26BKWoqsc7hKq8NtCUpC1K \
  --multisig-pda CHnvkrsy37qheATdjgFNifbCngnDQARhvrtFu7iC3vDM

# 2. Go to app.squads.so → Navigate to CHnvkrsy37qheATdjgFNifbCngnDQARhvrtFu7iC3vDM

# 3. Click "Propose from Transaction Message"

# 4. Paste the base58 string from the terminal output or JSON file

# 5. Squads auto-parses → Create proposal → Get approvals → Execute
```

---

## Understanding Squads V4

Squads V4 uses two addresses that work together:

### Multisig PDA: `CHnvkrsy37qheATdjgFNifbCngnDQARhvrtFu7iC3vDM`
- Where you create and vote on proposals in Squads UI
- 8 members with 5 of 8 approval threshold
- Does **not** sign transactions directly

### Vault: `EwXp4sepbKE7aoSn6Q4APR26BKWoqsc7hKq8NtCUpC1K`
- PDA controlled by the multisig above
- Actually **signs** transactions after approval
- The admin of your OFT Store (verified on-chain)

**How it works:**
1. Create proposal at Multisig PDA
2. Members vote (5 of 8 needed)
3. Upon approval, Vault signs and executes
4. Transaction completes with Vault as signer

**In commands**: Always use Vault as `--multisig-key` because it's the OFT Store admin.

---

## Available Commands

### Three Operating Modes

**1. Generate JSON Payload** (recommended for production):
```bash
--execute-immediately false --multisig-key <VAULT> --multisig-pda <PDA>
```
- Saves `./payloads/<DATE>_<operation>.json` with base58 message
- Best for: Audit trail, team coordination, production deployments

**2. Base58 Only** (quick workflow):
```bash
--only-base58 --multisig-key <VAULT> --simulate
```
- Prints base58 to terminal only (no file)
- Best for: Quick proposals, no file clutter

**3. Direct Execution** (testing):
```bash
--execute-immediately true
```
- Executes immediately with your keypair (default behavior)
- Best for: Testing, non-multisig operations

### Common Flags

- `--simulate`: Verify transaction will succeed (recommended)
- `--only-base58`: Output base58 only, no JSON file
- `--multisig-key <VAULT>`: Vault address (use `EwXp4sepbKE7aoSn6Q4APR26BKWoqsc7hKq8NtCUpC1K`)
- `--multisig-pda <PDA>`: Multisig account (use `CHnvkrsy37qheATdjgFNifbCngnDQARhvrtFu7iC3vDM`)

---

## Task Reference

### 1. GUID Rate Limit Override

Add/remove GUIDs from rate limit bypass list:

```bash
pnpm hardhat lz:oft:solana:set-guid-rate-limit-override \
  --eid 30168 \
  --program-id HYVSSRw542kNTAa2x8Ub3tb2ygK6bJEW7pHtP6GwguqP \
  --oft-store 5xgwxqVYWeZVjGRr45spDU9KW8yXenYigRfeshoKNyG2 \
  --guids 0x705e877032dc7434335b8652f50423f5380ece26f97ad79d8e1f394ebee280e6 \
  --actions add \
  --execute-immediately false \
  --multisig-key EwXp4sepbKE7aoSn6Q4APR26BKWoqsc7hKq8NtCUpC1K \
  --multisig-pda CHnvkrsy37qheATdjgFNifbCngnDQARhvrtFu7iC3vDM
```

**Parameters:**
- `--guids`: Comma-separated hex GUIDs (with or without `0x` prefix)
- `--actions`: Comma-separated actions (`add` or `remove`) matching each GUID

**Multiple GUIDs:**
```bash
--guids 0xGUID1,0xGUID2,0xGUID3 --actions add,remove,add
```

**Retrying Failed Transactions After GUID Override:**

After adding a GUID override, you **must use the `retry-payload` command** to retry the failed transaction instead of LayerZero Scan. This is critical because:

- The Solana executor enforces strict instruction sequencing (`PreExecute` → `lzReceive`)
- LayerZero Scan may not properly handle the required instruction ordering
- Bundling additional instructions (like the override) with the retry will trigger `InvalidInstructionSequence` error

**Retry workflow:**
1. Add GUID override (using command above)
2. Verify override is on-chain: `lz:oft:solana:get-rate-limit-overrides`
3. Retry the payload:
```bash
npx hardhat lz:oft:solana:retry-payload \
  --src-eid <SRC_EID> \
  --dst-eid 30168 \
  --nonce <NONCE> \
  --sender <OFT address on source chain> \
  --oft-store 5xgwxqVYWeZVjGRr45spDU9KW8yXenYigRfeshoKNyG2 \
  --guid <GUID_YOU_JUST_ENABLED_RATE_LIMIT_OVERRIDE_FOR> \
  --message <PAYLOAD_HEX> \
  --compute-units 800000 \
  --lamports 0 \
  --with-priority-fee 100000 \
  --simulate
```

See the main [README.md](../README.md) for more details on the retry command.

### 2. Address Rate Limit Override

Whitelist addresses that can bypass rate limits:

```bash
pnpm hardhat lz:oft:solana:set-rate-limit-override \
  --eid 30168 \
  --program-id HYVSSRw542kNTAa2x8Ub3tb2ygK6bJEW7pHtP6GwguqP \
  --oft-store 5xgwxqVYWeZVjGRr45spDU9KW8yXenYigRfeshoKNyG2 \
  --addresses <ADDRESS_1>,<ADDRESS_2> \
  --actions add,remove \
  --execute-immediately false \
  --multisig-key EwXp4sepbKE7aoSn6Q4APR26BKWoqsc7hKq8NtCUpC1K \
  --multisig-pda CHnvkrsy37qheATdjgFNifbCngnDQARhvrtFu7iC3vDM
```

**Parameters:**
- `--addresses`: Comma-separated Solana addresses
- `--actions`: Comma-separated actions (`add` or `remove`)

### 3. Inbound Rate Limit Configuration

Set rate limits for incoming transfers from specific chains:

```bash
pnpm hardhat lz:oft:solana:inbound-rate-limit \
  --eid 30168 \
  --src-eid 30110 \
  --mint 9wX6Qz1Y5YQe71dfnFYFfZYXZhKqjYKQwdqfrRkmYUSX \
  --program-id HYVSSRw542kNTAa2x8Ub3tb2ygK6bJEW7pHtP6GwguqP \
  --oft-store 5xgwxqVYWeZVjGRr45spDU9KW8yXenYigRfeshoKNyG2 \
  --capacity 1000000000000 \
  --refill-per-second 100000000 \
  --execute-immediately false \
  --multisig-key EwXp4sepbKE7aoSn6Q4APR26BKWoqsc7hKq8NtCUpC1K \
  --multisig-pda CHnvkrsy37qheATdjgFNifbCngnDQARhvrtFu7iC3vDM
```

**Parameters:**
- `--src-eid`: Source chain endpoint ID (30110=Arbitrum, 30106=Avalanche, etc.)
- `--capacity`: Max tokens in smallest unit (e.g., 1000 tokens = 1,000,000,000,000 with 9 decimals)
- `--refill-per-second`: Refill rate (e.g., 0.1 tokens/sec = 100,000,000)

---

## Creating Proposals

### Workflow: Base58 Transaction Message (Recommended)

**Step 1: Generate Base58 Message**

Run any command above. You'll get output like:
```
📋 Base58 Transaction Message:
241EGCWfxdBj8sr2vL4Lxn9FkwQQGo4HyWe6uMAhYxs2bTQB...

💾 Payload saved to: ./payloads/2025-11-25_solana-set-guid-rate-limit-override.json
```

**Step 2: Create Proposal in Squads UI**

1. Go to **app.squads.so** and connect wallet (must be one of the 8 members)
2. Navigate to multisig: `CHnvkrsy37qheATdjgFNifbCngnDQARhvrtFu7iC3vDM`
3. Click **"Propose from Transaction Message"**
4. Paste the base58 string
5. Squads automatically:
   - Parses all instruction details
   - Simulates the transaction
   - Shows compute units and fees
6. Add title/description
7. Create proposal

**Step 3: Approval and Execution**

1. Other members review and approve (5 of 8 needed)
2. Any member clicks "Execute" when threshold reached
3. Vault signs and submits transaction
4. Verify on-chain using:
   ```bash
   pnpm hardhat lz:oft:solana:get-rate-limit-overrides \
     --eid 30168 \
     --oft-store 5xgwxqVYWeZVjGRr45spDU9KW8yXenYigRfeshoKNyG2 \
     --program-id HYVSSRw542kNTAa2x8Ub3tb2ygK6bJEW7pHtP6GwguqP
   ```

**Important:**
- ⏰ Blockhash expires in ~60 seconds - create proposal quickly
- 🔄 If expired, regenerate the base58 message

### Simulation

Always simulate before sharing payloads:

```bash
pnpm hardhat lz:oft:solana:set-guid-rate-limit-override \
  --eid 30168 \
  --program-id HYVSSRw542kNTAa2x8Ub3tb2ygK6bJEW7pHtP6GwguqP \
  --oft-store 5xgwxqVYWeZVjGRr45spDU9KW8yXenYigRfeshoKNyG2 \
  --guids <GUID> \
  --actions add \
  --multisig-key EwXp4sepbKE7aoSn6Q4APR26BKWoqsc7hKq8NtCUpC1K \
  --simulate
```

**Output:**
```
✅ Simulation successful!
Compute units used: 5975

📋 Program Logs:
  Program HYVSSRw542kNTAa2x8Ub3tb2ygK6bJEW7pHtP6GwguqP invoke [1]
  Program log: Instruction: ManageRateLimitOverrideGuid
  Program HYVSSRw542kNTAa2x8Ub3tb2ygK6bJEW7pHtP6GwguqP success
```

Simulation runs without signatures, so non-members can verify transactions will succeed.

---

## Payload Structure

Generated JSON files are minimal and contain only what's needed:

```json
{
  "base58TransactionMessage": "241EGCWfxdBj8sr2vL4Lxn9FkwQQGo4HyWe6uMAhYxs2bTQB...",
  "multisig": "EwXp4sepbKE7aoSn6Q4APR26BKWoqsc7hKq8NtCUpC1K",
  "multisigPda": "CHnvkrsy37qheATdjgFNifbCngnDQARhvrtFu7iC3vDM",
  "description": "GUID rate limit override",
  "actions": [
    "ADD 0x705e877032dc7434335b8652f50423f5380ece26f97ad79d8e1f394ebee280e6"
  ],
  "timestamp": "2025-11-25T22:13:30.049Z"
}
```

**Usage:** Copy `base58TransactionMessage` and paste into Squads UI.

---

## Troubleshooting

### "Unauthorized" Error

**Cause:** Wrong admin address in payload

**Solution:**
1. Verify on-chain admin matches vault:
   ```bash
   pnpm hardhat lz:oft:solana:get-rate-limit-overrides \
     --eid 30168 \
     --oft-store 5xgwxqVYWeZVjGRr45spDU9KW8yXenYigRfeshoKNyG2 \
     --program-id HYVSSRw542kNTAa2x8Ub3tb2ygK6bJEW7pHtP6GwguqP
   ```
2. Use `EwXp4sepbKE7aoSn6Q4APR26BKWoqsc7hKq8NtCUpC1K` as `--multisig-key`
3. Regenerate payload

### "Reached end of buffer" or "nonProgramIds is not a function"

**Cause:** Squads V3 incompatibility or wrong format

**Solution:**
1. Verify using Squads V4 (not V3)
2. Use "Propose from Transaction Message" in Squads UI
3. Regenerate if blockhash expired (>60 seconds old)
4. Verify entire base58 string copied without truncation

### Blockhash Expired

**Symptom:** Transaction fails with blockhash error

**Solution:** Regenerate the payload - blockhashes expire after ~60 seconds

### Simulation Shows Different Results Than Squads

**Cause:** RPC differences or state changes between simulation times

**Solution:** 
- Both should succeed if transaction is valid
- Squads UI simulation is authoritative
- Local simulation is for pre-verification only

---

## Security Checklist

**Before creating proposal:**
- [ ] Simulated successfully (`--simulate`)
- [ ] Verified vault address is correct OFT Store admin
- [ ] Reviewed GUIDs/addresses/parameters are correct
- [ ] Checked compute units are reasonable (<200,000)

**Before approving in Squads:**
- [ ] Squads UI simulation passes
- [ ] Reviewed all instruction details
- [ ] Verified correct program and accounts
- [ ] Confirmed with other signers if uncertain

---

## Additional Resources

- [Squads V4 Documentation](https://docs.squads.so/)
- [Solana Explorer](https://explorer.solana.com/)
- [GMX Solana Rate Limiting Guide](./SOLANA_RATE_LIMITING_GUIDE.md)
