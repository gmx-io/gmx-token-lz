# Solana Rate Limiting Management Guide

This guide covers the Solana rate limiting tasks for managing inbound rate limits and whitelist overrides.

> **📖 For Multisig Operations**: See [SOLANA_MULTISIG_PAYLOADS.md](./SOLANA_MULTISIG_PAYLOADS.md) for complete Squads V4 multisig workflow documentation.

## Overview

The GMX Solana OFT includes custom rate limiting features:

- **Inbound Rate Limiting**: Controls how much can be transferred TO Solana from other chains
- **Whitelist Overrides**: Allows specific addresses to bypass rate limits (e.g., FeeDistributor)
- **Multisig Support**: Generate payloads for governance approval
- **Custom Implementation**: Bypasses SDK issues with raw account parsing

## Available Tasks

### Rate Limit Configuration
- `lz:oft:solana:inbound-rate-limit` - Set inbound rate limits per source chain
- `lz:oft:solana:get-rate-limits` - View current rate limit configuration

### Whitelist Management
- `lz:oft:solana:set-rate-limit-override` - Add/remove addresses from whitelist
- `lz:oft:solana:set-guid-rate-limit-override` - Add/remove GUIDs from whitelist
- `lz:oft:solana:get-rate-limit-overrides` - View current whitelist (addresses and GUIDs)

## Prerequisites

Ensure you have:
```bash
# Your Solana private key in .env
SOLANA_PRIVATE_KEY=your_base58_private_key_here

# Your deployment information
# Check: deployments/solana-mainnet/OFT.json
```

## Task Usage

### 📊 View Current Rate Limits

```bash
# View rate limits using SDK (shows both inbound/outbound)
pnpm hardhat lz:oft:solana:get-rate-limits \
  --mint <TOKEN_MINT> \
  --eid 30168 \
  --dst-eid 30110 \
  --program-id <PROGRAM_ID> \
  --oft-store <OFT_STORE>
```

**Example:**
```bash
pnpm hardhat lz:oft:solana:get-rate-limits \
  --mint 9wX6Qz1Y5YQe71dfnFYFfZYXZhKqjYKQwdqfrRkmYUSX \
  --eid 30168 \
  --dst-eid 30110 \
  --program-id HYVSSRw542kNTAa2x8Ub3tb2ygK6bJEW7pHtP6GwguqP \
  --oft-store 5xgwxqVYWeZVjGRr45spDU9KW8yXenYigRfeshoKNyG2
```

### 🚦 Set Inbound Rate Limits

#### Immediate Execution:
```bash
pnpm hardhat lz:oft:solana:inbound-rate-limit \
  --eid 30168 \
  --src-eid <SOURCE_EID> \
  --program-id <PROGRAM_ID> \
  --oft-store <OFT_STORE> \
  --mint <TOKEN_MINT> \
  --capacity <CAPACITY_IN_BASE_UNITS> \
  --refill-per-second <REFILL_RATE_IN_BASE_UNITS>
```

#### Generate Multisig Payload:
```bash
pnpm hardhat lz:oft:solana:inbound-rate-limit \
  --eid 30168 \
  --src-eid <SOURCE_EID> \
  --program-id <PROGRAM_ID> \
  --oft-store <OFT_STORE> \
  --mint <TOKEN_MINT> \
  --capacity <CAPACITY_IN_BASE_UNITS> \
  --refill-per-second <REFILL_RATE_IN_BASE_UNITS> \
  --execute-immediately false \
  --multisig-key <VAULT_ADDRESS> \
  --multisig-pda <MULTISIG_PDA>
```

> See [SOLANA_MULTISIG_PAYLOADS.md](./SOLANA_MULTISIG_PAYLOADS.md) for complete multisig workflow.

**Example (10,000 GMX capacity, 4-hour refill window):**
```bash
# Immediate execution
pnpm hardhat lz:oft:solana:inbound-rate-limit \
  --eid 30168 \
  --src-eid 30110 \
  --program-id HYVSSRw542kNTAa2x8Ub3tb2ygK6bJEW7pHtP6GwguqP \
  --oft-store 5xgwxqVYWeZVjGRr45spDU9KW8yXenYigRfeshoKNyG2 \
  --mint 9wX6Qz1Y5YQe71dfnFYFfZYXZhKqjYKQwdqfrRkmYUSX \
  --capacity 10000000000000 \
  --refill-per-second 694444444

# Multisig payload (see SOLANA_MULTISIG_PAYLOADS.md for details)
pnpm hardhat lz:oft:solana:inbound-rate-limit \
  --eid 30168 \
  --src-eid 30110 \
  --program-id HYVSSRw542kNTAa2x8Ub3tb2ygK6bJEW7pHtP6GwguqP \
  --oft-store 5xgwxqVYWeZVjGRr45spDU9KW8yXenYigRfeshoKNyG2 \
  --mint 9wX6Qz1Y5YQe71dfnFYFfZYXZhKqjYKQwdqfrRkmYUSX \
  --capacity 10000000000000 \
  --refill-per-second 694444444 \
  --execute-immediately false \
  --multisig-key EwXp4sepbKE7aoSn6Q4APR26BKWoqsc7hKq8NtCUpC1K \
  --multisig-pda CHnvkrsy37qheATdjgFNifbCngnDQARhvrtFu7iC3vDM
```

### 🏷️ View Current Whitelist

```bash
# View whitelist addresses (custom raw parsing)
pnpm hardhat lz:oft:solana:get-rate-limit-overrides \
  --eid 30168 \
  --program-id <PROGRAM_ID> \
  --oft-store <OFT_STORE>
```

**Example:**
```bash
pnpm hardhat lz:oft:solana:get-rate-limit-overrides \
  --eid 30168 \
  --program-id HYVSSRw542kNTAa2x8Ub3tb2ygK6bJEW7pHtP6GwguqP \
  --oft-store 5xgwxqVYWeZVjGRr45spDU9KW8yXenYigRfeshoKNyG2
```

### ✅ Manage Whitelist Addresses

#### Add Addresses to Whitelist:
```bash
pnpm hardhat lz:oft:solana:set-rate-limit-override \
  --eid 30168 \
  --program-id <PROGRAM_ID> \
  --oft-store <OFT_STORE> \
  --addresses "ADDRESS1,ADDRESS2,ADDRESS3" \
  --actions "add,add,add"
```

#### Remove Addresses from Whitelist:
```bash
pnpm hardhat lz:oft:solana:set-rate-limit-override \
  --eid 30168 \
  --program-id <PROGRAM_ID> \
  --oft-store <OFT_STORE> \
  --addresses "ADDRESS_TO_REMOVE" \
  --actions "remove"
```

#### Generate Multisig Payload for Whitelist:
```bash
pnpm hardhat lz:oft:solana:set-rate-limit-override \
  --eid 30168 \
  --program-id <PROGRAM_ID> \
  --oft-store <OFT_STORE> \
  --addresses "FEE_DISTRIBUTOR_ADDRESS" \
  --actions "add" \
  --execute-immediately false \
  --multisig-key <VAULT_ADDRESS> \
  --multisig-pda <MULTISIG_PDA>
```

> See [SOLANA_MULTISIG_PAYLOADS.md](./SOLANA_MULTISIG_PAYLOADS.md) for how to use the generated payload in Squads V4.

**Example:**
```bash
# Add FeeDistributor to whitelist
pnpm hardhat lz:oft:solana:set-rate-limit-override \
  --eid 30168 \
  --program-id HYVSSRw542kNTAa2x8Ub3tb2ygK6bJEW7pHtP6GwguqP \
  --oft-store 5xgwxqVYWeZVjGRr45spDU9KW8yXenYigRfeshoKNyG2 \
  --addresses "7M5wTZXneoTxVoipxVt1xgV4vyXXX79bbQCp7qYSLdBw" \
  --actions "add"

# Generate multisig payload for governance
pnpm hardhat lz:oft:solana:set-rate-limit-override \
  --eid 30168 \
  --program-id HYVSSRw542kNTAa2x8Ub3tb2ygK6bJEW7pHtP6GwguqP \
  --oft-store 5xgwxqVYWeZVjGRr45spDU9KW8yXenYigRfeshoKNyG2 \
  --addresses "FeeDistributorAddress123..." \
  --actions "add" \
  --execute-immediately false \
  --multisig-key EwXp4sepbKE7aoSn6Q4APR26BKWoqsc7hKq8NtCUpC1K \
  --multisig-pda CHnvkrsy37qheATdjgFNifbCngnDQARhvrtFu7iC3vDM
```


## Parameter Reference

### Common Parameters

| Parameter | Description | Required | Example |
|-----------|-------------|----------|---------|
| `--eid` | Endpoint ID (30168=mainnet, 40168=testnet) | ✅ | `30168` |
| `--program-id` | Your OFT program ID | ✅ | `HYVSSRw542kNTAa2x8Ub3tb2ygK6bJEW7pHtP6GwguqP` |
| `--oft-store` | Your OFT store account address | ✅ | `5xgwxqVYWeZVjGRr45spDU9KW8yXenYigRfeshoKNyG2` |

### Rate Limit Parameters

| Parameter | Description | Required | Example |
|-----------|-------------|----------|---------|
| `--src-eid` | Source chain EID (where transfers come FROM) | ✅ | `30110` (Arbitrum) |
| `--mint` | Token mint address | ✅ | `9wX6Qz1Y5YQe71dfnFYFfZYXZhKqjYKQwdqfrRkmYUSX` |
| `--capacity` | Max tokens in bucket (9 decimals) | ✅ | `10000000000000` (10k tokens) |
| `--refill-per-second` | Refill rate (9 decimals) | ✅ | `694444444` (0.694 tokens/sec) |

### Whitelist Parameters

| Parameter | Description | Required | Example |
|-----------|-------------|----------|---------|
| `--addresses` | Comma-separated addresses | ✅ | `"addr1,addr2,addr3"` |
| `--actions` | Comma-separated actions | ✅ | `"add,remove,add"` |

### Multisig Parameters

| Parameter | Description | Required | Default | Example |
|-----------|-------------|----------|---------|---------|
| `--multisig-key` | Vault/authority address | ❌ | - | `EwXp4sepbKE...` |
| `--multisig-pda` | Squads multisig PDA | ❌ | - | `CHnvkrsy37q...` |
| `--execute-immediately` | Execute vs generate payload | ❌ | `true` | `false` |
| `--simulate` | Verify transaction will succeed | ❌ | `false` | Flag (no value) |
| `--only-base58` | Output base58 only (no JSON) | ❌ | `false` | Flag (no value) |

> **Note:** For multisig operations, see [SOLANA_MULTISIG_PAYLOADS.md](./SOLANA_MULTISIG_PAYLOADS.md) for complete workflow.

## Rate Limit Calculations

### Capacity (Bucket Size)
```bash
# For 10,000 GMX with 9 decimals
capacity = 10000 * 10^9 = 10000000000000
```

### Refill Rate (Tokens Per Second)
```bash
# For 10,000 GMX over 4 hours
tokens_per_hour = 10000 / 4 = 2500 GMX/hour
tokens_per_second = 2500 / 3600 = 0.694444... GMX/second
refill_per_second = 0.694444 * 10^9 = 694444444
```

## Multisig Workflow

For complete multisig workflow with Squads V4, see [SOLANA_MULTISIG_PAYLOADS.md](./SOLANA_MULTISIG_PAYLOADS.md).

**Quick summary:**
1. Add `--execute-immediately false --multisig-key <VAULT> --multisig-pda <PDA>` to any command
2. Copy base58 transaction message from output
3. Paste into Squads UI → Create proposal → Get approvals → Execute

## Common Workflows

### Initial Setup

1. **Deploy and wire your OFT** (follow main README)
2. **Set initial rate limits**:
```bash
pnpm hardhat lz:oft:solana:inbound-rate-limit \
  --eid 30168 --src-eid 30110 \
  --program-id <PROGRAM_ID> --oft-store <OFT_STORE> --mint <MINT> \
  --capacity 10000000000000 --refill-per-second 694444444
```
3. **Add FeeDistributor to whitelist**:
```bash
pnpm hardhat lz:oft:solana:set-rate-limit-override \
  --eid 30168 --program-id <PROGRAM_ID> --oft-store <OFT_STORE> \
  --addresses "<FEE_DISTRIBUTOR_ADDRESS>" --actions "add"
```

### Governance Changes

See [SOLANA_MULTISIG_PAYLOADS.md](./SOLANA_MULTISIG_PAYLOADS.md) for complete Squads V4 workflow.

### Monitoring

```bash
# Check current status
pnpm hardhat lz:oft:solana:get-rate-limit-overrides \
  --eid 30168 --program-id <PROGRAM_ID> --oft-store <OFT_STORE>

# Check rate limits
pnpm hardhat lz:oft:solana:get-rate-limits \
  --mint <MINT> --eid 30168 --dst-eid 30110 \
  --program-id <PROGRAM_ID> --oft-store <OFT_STORE>
```

## Example Values

### Mainnet Configuration
```bash
# Common EIDs
SOLANA_MAINNET=30168
ARBITRUM_MAINNET=30110
AVALANCHE_MAINNET=30106

# Example rate limits (10k GMX, 4-hour window)
CAPACITY=10000000000000          # 10,000 GMX (9 decimals)
REFILL_PER_SECOND=694444444      # ~0.694 GMX/second

# Your deployment (update with actual values)
PROGRAM_ID=HYVSSRw542kNTAa2x8Ub3tb2ygK6bJEW7pHtP6GwguqP
OFT_STORE=5xgwxqVYWeZVjGRr45spDU9KW8yXenYigRfeshoKNyG2
TOKEN_MINT=9wX6Qz1Y5YQe71dfnFYFfZYXZhKqjYKQwdqfrRkmYUSX
```

### Testnet Configuration
```bash
# Testnet EIDs
SOLANA_TESTNET=40168
ARBITRUM_SEPOLIA=40161

# Lower rate limits for testing
CAPACITY=1000000000000           # 1,000 GMX
REFILL_PER_SECOND=69444444       # ~0.069 GMX/second
```

## Troubleshooting

### "Program is not deployed"
- Check if your program ID is correct
- Ensure the program is deployed to the right network (mainnet vs testnet)

### "No addresses whitelisted" (but you added them)
- Use the raw parser: `get-rate-limit-overrides` instead of SDK-based readers
- Check you're using the correct program ID and OFT store

### "InstructionDidNotDeserialize"
- This was fixed by updating the program to match SDK structure
- Rebuild and redeploy if you still see this

### "Insufficient funds"
- Ensure you have enough SOL for transaction fees
- Check your account balance

### Multisig payload fails
- See [SOLANA_MULTISIG_PAYLOADS.md](./SOLANA_MULTISIG_PAYLOADS.md) troubleshooting section
- Verify blockhash hasn't expired (>60 seconds)
- Ensure using correct vault and multisig PDA addresses

## Security Considerations

### Rate Limiting
- **Conservative limits**: Start with lower limits and increase gradually
- **Monitor usage**: Check rate limit consumption regularly
- **Emergency procedures**: Have plans to adjust limits quickly

### Whitelist Management
- **Minimal whitelist**: Only add necessary addresses (FeeDistributor, etc.)
- **Regular audits**: Review whitelist addresses periodically
- **Governance approval**: Use multisig for all whitelist changes

### Multisig Operations
- **Test on devnet**: Always test multisig payloads on testnet first
- **Verify payloads**: Double-check all parameters before submission
- **Secure storage**: Keep multisig keys secure and backed up

## Advanced Usage

### Custom Rate Calculations
```javascript
// Calculate refill rate for different time windows
const calculateRefillRate = (tokensPerHour, decimals = 9) => {
    const tokensPerSecond = tokensPerHour / 3600;
    return Math.floor(tokensPerSecond * Math.pow(10, decimals));
};

// Examples
console.log('1000 tokens/hour:', calculateRefillRate(1000));  // 277777777
console.log('2500 tokens/hour:', calculateRefillRate(2500));  // 694444444
```

### Batch Operations
```bash
# Add multiple addresses at once
pnpm hardhat lz:oft:solana:set-rate-limit-override \
  --eid 30168 --program-id <PROGRAM_ID> --oft-store <OFT_STORE> \
  --addresses "FeeDistributor,Treasury,RewardsPool" \
  --actions "add,add,add"

# Mixed operations
pnpm hardhat lz:oft:solana:set-rate-limit-override \
  --eid 30168 --program-id <PROGRAM_ID> --oft-store <OFT_STORE> \
  --addresses "NewAddress,OldAddress" \
  --actions "add,remove"
```

## Integration with Squads V4

For complete Squads V4 integration guide, see [SOLANA_MULTISIG_PAYLOADS.md](./SOLANA_MULTISIG_PAYLOADS.md).

**Quick workflow:**
1. Generate payload with `--execute-immediately false --multisig-key <VAULT> --multisig-pda <PDA>`
2. Copy base58 transaction message
3. Paste into Squads UI "Propose from Transaction Message"
4. Get approvals and execute

## Summary

These custom tasks provide complete control over your Solana OFT rate limiting with:

- ✅ **Inbound rate limiting** for security
- ✅ **Whitelist management** for operational flexibility  
- ✅ **Multisig governance** for production safety
- ✅ **Custom implementation** that works with your specific program
- ✅ **Raw account parsing** that sees the truth

Perfect for production deployment with proper governance! 🚀
