# Solana Rate Limiting Management Guide

This guide covers the custom Solana rate limiting tasks for managing inbound rate limits and whitelist overrides with full multisig support.
Note: The examples use the current OFT deployment and config state.

## Overview

The GMX Solana OFT includes custom rate limiting features:

- **Inbound Rate Limiting**: Controls how much can be transferred TO Solana from other chains
- **Whitelist Overrides**: Allows specific addresses to bypass rate limits (e.g., FeeDistributor)
- **Multisig Support**: Generate payloads for governance approval
- **Custom Implementation**: Bypasses SDK issues with raw account parsing

## Available Tasks

### 1. `lz:oft:solana:inbound-rate-limit`
Sets inbound rate limits for cross-chain transfers to Solana.

### 2. `lz:oft:solana:get-rate-limits` 
Views current rate limit configuration using SDK.

### 3. `lz:oft:solana:set-rate-limit-override`
Manages whitelist addresses that can bypass rate limits.

### 4. `lz:oft:solana:get-rate-limit-overrides`
Views current whitelist addresses using custom raw parsing.

### 5. `lz:solana:execute-payload`
Executes multisig payloads for testing with your EOA.

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
  --multisig-key <MULTISIG_PUBKEY> \
  --execute-immediately false
```

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

# Multisig payload
pnpm hardhat lz:oft:solana:inbound-rate-limit \
  --eid 30168 \
  --src-eid 30110 \
  --program-id HYVSSRw542kNTAa2x8Ub3tb2ygK6bJEW7pHtP6GwguqP \
  --oft-store 5xgwxqVYWeZVjGRr45spDU9KW8yXenYigRfeshoKNyG2 \
  --mint 9wX6Qz1Y5YQe71dfnFYFfZYXZhKqjYKQwdqfrRkmYUSX \
  --capacity 10000000000000 \
  --refill-per-second 694444444 \
  --multisig-key 8bMVQbr1f2LcEeXyuMJGfbh6XAMyGdtkLXMnw8dqu4qi \
  --execute-immediately false
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
  --multisig-key <MULTISIG_PUBKEY> \
  --execute-immediately false
```

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
  --multisig-key 8bMVQbr1f2LcEeXyuMJGfbh6XAMyGdtkLXMnw8dqu4qi \
  --execute-immediately false
```

### 🔧 Execute Multisig Payloads

```bash
# Execute a generated payload with your EOA (for testing)
pnpm hardhat lz:solana:execute-payload \
  --payload "<BASE58_PAYLOAD_FROM_MULTISIG_GENERATION>" \
  --eid 30168
```

**Example:**
```bash
pnpm hardhat lz:solana:execute-payload \
  --payload "2bkasAVNHqCTUV7PTBPFP3WUqtsyV4hxyqFTHc3CKfjf..." \
  --eid 30168
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
| `--multisig-key` | Multisig account pubkey | ❌ | - | `8bMVQbr1f2L...` |
| `--execute-immediately` | Execute vs generate payload | ❌ | `true` | `false` |

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

### 1. Generate Payload
```bash
# Generate payload for any operation
pnpm hardhat lz:oft:solana:[TASK_NAME] \
  [PARAMETERS] \
  --multisig-key <MULTISIG_PUBKEY> \
  --execute-immediately false
```

### 2. Copy Payload
Copy the base58 payload from the output:
```
Transaction Payload (base58): 2bkasAVNHqCTUV7PTBPFP3WUqtsyV4h...
```

### 3. Submit to Multisig
- **Squads Protocol**: Paste payload in transaction builder
- **Custom Tools**: Use the hex instruction data
- **Testing**: Use the execute-payload task

### 4. Execute (Production)
- Get approvals from multisig members
- Execute when threshold is reached

### 5. Execute (Testing)
```bash
# Test with your EOA
pnpm hardhat lz:solana:execute-payload \
  --payload "YOUR_PAYLOAD_HERE" \
  --eid 30168
```

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

1. **Generate multisig payload**:
```bash
pnpm hardhat lz:oft:solana:inbound-rate-limit \
  --eid 30168 --src-eid 30110 \
  --program-id <PROGRAM_ID> --oft-store <OFT_STORE> --mint <MINT> \
  --capacity <NEW_CAPACITY> --refill-per-second <NEW_RATE> \
  --multisig-key <MULTISIG_PUBKEY> --execute-immediately false
```

2. **Submit to Squads** (or your multisig tool)

3. **Get approvals** from other signers

4. **Execute** when threshold reached

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
- Verify the payload is recent (blockhashes expire)
- Check if you have signing authority
- For testing, use your EOA as the multisig key

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

## Integration with Squads

### 1. Generate Payload
Use any task with `--multisig-key` and `--execute-immediately false`

### 2. Create Proposal in Squads
- Go to your Squads vault
- Create new transaction
- Paste the base58 payload
- Add description and submit

### 3. Get Approvals
- Share proposal with other multisig members
- Each member approves the transaction
- Execute when threshold is reached

## Summary

These custom tasks provide complete control over your Solana OFT rate limiting with:

- ✅ **Inbound rate limiting** for security
- ✅ **Whitelist management** for operational flexibility  
- ✅ **Multisig governance** for production safety
- ✅ **Custom implementation** that works with your specific program
- ✅ **Raw account parsing** that sees the truth

Perfect for production deployment with proper governance! 🚀
