import fs from 'fs'

import { Connection, PublicKey, Message } from '@solana/web3.js'
import bs58 from 'bs58'
import { task } from 'hardhat/config'

import { types } from '@layerzerolabs/devtools-evm-hardhat'

interface ValidateArgs {
    payloadFile: string
    anchorAddress?: string
    anchorUrl?: string
    rpc?: string
    cluster?: string
}

interface PayloadEntry {
    point: {
        eid: number
        address: string
    }
    data: string
    description: string
}

interface Base58Payload {
    base58TransactionMessage: string
    multisig: string
    multisigPda?: string
    description: string
    actions: string[]
    timestamp: string
}

interface VaultTransactionMessage {
    numSigners: number
    numWritableSigners: number
    numWritableNonSigners: number
    accountKeys: PublicKey[]
    instructions: MultisigCompiledInstruction[]
}

interface MultisigCompiledInstruction {
    programIdIndex: number
    accountIndexes: number[]
    data: Buffer
}

/**
 * Decode Squads VaultTransaction anchor account
 */
function decodeVaultTransaction(accountData: Buffer): {
    multisig: PublicKey
    creator: PublicKey
    index: bigint
    bump: number
    vaultIndex: number
    vaultBump: number
    message: VaultTransactionMessage
} {
    let offset = 8 // Skip discriminator

    // Read fields
    const multisig = new PublicKey(accountData.subarray(offset, offset + 32))
    offset += 32

    const creator = new PublicKey(accountData.subarray(offset, offset + 32))
    offset += 32

    const index = accountData.readBigUInt64LE(offset)
    offset += 8

    const bump = accountData.readUInt8(offset)
    offset += 1

    const vaultIndex = accountData.readUInt8(offset)
    offset += 1

    const vaultBump = accountData.readUInt8(offset)
    offset += 1

    // Skip ephemeral signer bumps length
    const ephemeralSignerBumpsLen = accountData.readUInt32LE(offset)
    offset += 4 + ephemeralSignerBumpsLen

    // Decode message
    const message = decodeVaultTransactionMessage(accountData.subarray(offset))

    return {
        multisig,
        creator,
        index,
        bump,
        vaultIndex,
        vaultBump,
        message,
    }
}

/**
 * Decode VaultTransactionMessage from buffer
 */
function decodeVaultTransactionMessage(buffer: Buffer): VaultTransactionMessage {
    let offset = 0

    const numSigners = buffer.readUInt8(offset)
    offset += 1

    const numWritableSigners = buffer.readUInt8(offset)
    offset += 1

    const numWritableNonSigners = buffer.readUInt8(offset)
    offset += 1

    // Read account keys
    const accountKeysLen = buffer.readUInt32LE(offset)
    offset += 4

    const accountKeys: PublicKey[] = []
    for (let i = 0; i < accountKeysLen; i++) {
        accountKeys.push(new PublicKey(buffer.subarray(offset, offset + 32)))
        offset += 32
    }

    // Read instructions
    const instructionsLen = buffer.readUInt32LE(offset)
    offset += 4

    const instructions: MultisigCompiledInstruction[] = []
    for (let i = 0; i < instructionsLen; i++) {
        const programIdIndex = buffer.readUInt8(offset)
        offset += 1

        // Read account indexes
        const accountIndexesLen = buffer.readUInt32LE(offset)
        offset += 4

        const accountIndexes: number[] = []
        for (let j = 0; j < accountIndexesLen; j++) {
            accountIndexes.push(buffer.readUInt8(offset))
            offset += 1
        }

        // Read instruction data
        const dataLen = buffer.readUInt32LE(offset)
        offset += 4

        const data = buffer.subarray(offset, offset + dataLen)
        offset += dataLen

        instructions.push({
            programIdIndex,
            accountIndexes,
            data,
        })
    }

    return {
        numSigners,
        numWritableSigners,
        numWritableNonSigners,
        accountKeys,
        instructions,
    }
}

/**
 * Extract EID from instruction data (assumes LayerZero enforced options format)
 */
function extractEidFromInstruction(data: Buffer): number | null {
    // Format: [8 bytes function selector][2 bytes EID in little endian][...]
    if (data.length < 10) return null

    // EID is at bytes 8-9 (little endian)
    return data.readUInt16LE(8)
}

/**
 * Extract options from instruction data
 */
function extractOptionsFromInstruction(data: Buffer): string | null {
    // The options typically start after the function selector and EID
    // This is specific to the enforced options instruction format
    if (data.length < 36) return null

    // Extract the options portion (varies by instruction format)
    // For now, we'll return the full data as hex for comparison
    return data.toString('hex')
}

/**
 * Validate anchor account data against payload (enforced options format)
 */
async function validateEnforcedOptionsPayload(
    vaultTx: ReturnType<typeof decodeVaultTransaction>,
    payload: PayloadEntry[]
): Promise<boolean> {
    console.log('📦 Payload Type: Enforced Options Format (with hex data)')
    console.log()

    let allPassed = true

    const payloadEntry = payload[0]

    // Validate point.address matches one of the account keys
    console.log('1️⃣  Validating Account Address')
    console.log('─'.repeat(80))
    console.log(`   Expected (from payload): ${payloadEntry.point.address}`)

    const addressMatch = vaultTx.message.accountKeys.some((key) => key.toBase58() === payloadEntry.point.address)

    if (addressMatch) {
        console.log('   ✓ PASS - Address found in account keys')
    } else {
        console.log('   ✗ FAIL - Address not found in account keys')
        allPassed = false
    }
    console.log()

    // Validate EID from point matches
    console.log('2️⃣  Validating EID (from payload point)')
    console.log('─'.repeat(80))
    console.log(`   Expected EID: ${payloadEntry.point.eid}`)

    // For Solana, EID should be 30168 (Solana mainnet)
    if (payloadEntry.point.eid === 30168) {
        console.log('   ✓ PASS - EID is 30168 (Solana mainnet)')
    } else {
        console.log(`   ⚠ WARNING - EID is ${payloadEntry.point.eid} (expected 30168 for Solana mainnet)`)
    }
    console.log()

    // Validate instruction data is embedded in payload data
    console.log('3️⃣  Validating Instruction Data')
    console.log('─'.repeat(80))

    const payloadDataHex = payloadEntry.data.startsWith('0x')
        ? payloadEntry.data.substring(2)
        : payloadEntry.data

    let instructionMatches = 0
    vaultTx.message.instructions.forEach((ix, i) => {
        const ixDataHex = ix.data.toString('hex')
        console.log(`   Instruction #${i}:`)
        console.log(`     Data: ${ixDataHex}`)

        if (payloadDataHex.includes(ixDataHex)) {
            console.log(`     ✓ FOUND in payload data`)
            instructionMatches++

            // Extract and validate EID
            const eid = extractEidFromInstruction(ix.data)
            if (eid) {
                console.log(`     Decoded EID: ${eid}`)

                // Check if this EID is mentioned in the description
                if (payloadEntry.description.includes(`"eid": ${eid}`)) {
                    console.log(`     ✓ EID ${eid} matches description`)
                } else {
                    console.log(`     ⚠ EID ${eid} not found in description`)
                }
            }
        } else {
            console.log(`     ✗ NOT FOUND in payload data`)
            allPassed = false
        }
        console.log()
    })

    if (instructionMatches === vaultTx.message.instructions.length) {
        console.log('   ✓ PASS - All instructions found in payload')
    } else {
        console.log(`   ✗ FAIL - Only ${instructionMatches}/${vaultTx.message.instructions.length} instructions found`)
        allPassed = false
    }
    console.log()

    // Parse and validate description
    console.log('4️⃣  Validating Description')
    console.log('─'.repeat(80))
    console.log(`   Description: ${payloadEntry.description}`)
    console.log()

    return allPassed
}

/**
 * Validate anchor account data against payload (base58 transaction message format)
 */
async function validateBase58Payload(
    connection: Connection,
    vaultTx: ReturnType<typeof decodeVaultTransaction>,
    payload: Base58Payload
): Promise<boolean> {
    console.log('📦 Payload Type: Base58 Transaction Message Format')
    console.log()

    let allPassed = true

    // Validate multisig matches
    console.log('1️⃣  Validating Multisig PDA')
    console.log('─'.repeat(80))
    console.log(`   Expected (from payload): ${payload.multisigPda || payload.multisig}`)
    console.log(`   Actual (from anchor): ${vaultTx.multisig.toBase58()}`)

    if (vaultTx.multisig.toBase58() === (payload.multisigPda || payload.multisig)) {
        console.log('   ✓ PASS - Multisig PDA matches')
    } else {
        console.log('   ✗ FAIL - Multisig PDA does not match')
        allPassed = false
    }
    console.log()

    // Decode the base58 transaction message and compare instructions
    console.log('2️⃣  Validating Transaction Message')
    console.log('─'.repeat(80))

    try {
        const messageBytes = bs58.decode(payload.base58TransactionMessage)
        const message = Message.from(Buffer.from(messageBytes))

        console.log(`   Expected instructions (from payload): ${message.compiledInstructions.length}`)
        console.log(`   Actual instructions (from anchor): ${vaultTx.message.instructions.length}`)

        if (message.compiledInstructions.length === vaultTx.message.instructions.length) {
            console.log('   ✓ PASS - Instruction count matches')
        } else {
            console.log('   ✗ FAIL - Instruction count mismatch')
            allPassed = false
        }
        console.log()

        // Compare each instruction
        console.log('3️⃣  Validating Instruction Data')
        console.log('─'.repeat(80))

        for (let i = 0; i < Math.min(message.compiledInstructions.length, vaultTx.message.instructions.length); i++) {
            const payloadIx = message.compiledInstructions[i]
            const anchorIx = vaultTx.message.instructions[i]

            console.log(`   Instruction #${i}:`)
            
            // Compare instruction data
            const payloadDataHex = Buffer.from(payloadIx.data).toString('hex')
            const anchorDataHex = anchorIx.data.toString('hex')

            console.log(`     Payload data: ${payloadDataHex}`)
            console.log(`     Anchor data:  ${anchorDataHex}`)

            if (payloadDataHex === anchorDataHex) {
                console.log(`     ✓ PASS - Instruction data matches`)
            } else {
                console.log(`     ✗ FAIL - Instruction data mismatch`)
                allPassed = false
            }

            // Compare program ID
            const payloadProgram = message.accountKeys[payloadIx.programIdIndex]
            const anchorProgram = vaultTx.message.accountKeys[anchorIx.programIdIndex]

            console.log(`     Payload program: ${payloadProgram.toBase58()}`)
            console.log(`     Anchor program:  ${anchorProgram.toBase58()}`)

            if (payloadProgram.toBase58() === anchorProgram.toBase58()) {
                console.log(`     ✓ PASS - Program ID matches`)
            } else {
                console.log(`     ✗ FAIL - Program ID mismatch`)
                allPassed = false
            }
            console.log()
        }

        // Validate fee payer (vault)
        console.log('4️⃣  Validating Fee Payer (Vault)')
        console.log('─'.repeat(80))
        console.log(`   Expected (from payload): ${message.accountKeys[0].toBase58()}`)
        console.log(`   Actual (from anchor): ${vaultTx.message.accountKeys[0].toBase58()}`)

        if (message.accountKeys[0].toBase58() === vaultTx.message.accountKeys[0].toBase58()) {
            console.log('   ✓ PASS - Fee payer matches')
        } else {
            console.log('   ✗ FAIL - Fee payer mismatch')
            allPassed = false
        }
        console.log()

        // Display description and actions
        console.log('5️⃣  Transaction Details')
        console.log('─'.repeat(80))
        console.log(`   Description: ${payload.description}`)
        console.log(`   Actions:`)
        payload.actions.forEach((action, i) => {
            console.log(`     ${i + 1}. ${action}`)
        })
        console.log()

    } catch (error) {
        console.log(`   ✗ FAIL - Error decoding base58 transaction message: ${error}`)
        allPassed = false
    }

    return allPassed
}

/**
 * Validate anchor account data against payload
 */
async function validateAnchorData(
    connection: Connection,
    anchorAddress: PublicKey,
    payload: PayloadEntry[] | Base58Payload
): Promise<void> {
    console.log('🔍 Solana Anchor Data Validator')
    console.log('═'.repeat(80))
    console.log()

    // Fetch anchor account data
    console.log(`📡 Fetching anchor account: ${anchorAddress.toBase58()}`)
    const accountInfo = await connection.getAccountInfo(anchorAddress)

    if (!accountInfo) {
        throw new Error(`Account not found: ${anchorAddress.toBase58()}`)
    }

    console.log(`✓ Account found (${accountInfo.data.length} bytes)`)
    console.log()

    // Decode vault transaction
    console.log('🔓 Decoding VaultTransaction...')
    const vaultTx = decodeVaultTransaction(accountInfo.data)

    console.log(`  Multisig: ${vaultTx.multisig.toBase58()}`)
    console.log(`  Creator: ${vaultTx.creator.toBase58()}`)
    console.log(`  Transaction Index: ${vaultTx.index}`)
    console.log(`  Vault Index: ${vaultTx.vaultIndex}`)
    console.log(`  Instructions: ${vaultTx.message.instructions.length}`)
    console.log(`  Account Keys: ${vaultTx.message.accountKeys.length}`)
    console.log()

    // Display account keys
    console.log('📋 Account Keys:')
    vaultTx.message.accountKeys.forEach((key, i) => {
        console.log(`  #${i}: ${key.toBase58()}`)
    })
    console.log()

    // Display instructions
    console.log('📝 Instructions:')
    vaultTx.message.instructions.forEach((ix, i) => {
        console.log(`  Instruction #${i}:`)
        console.log(`    Program: ${vaultTx.message.accountKeys[ix.programIdIndex].toBase58()} (index #${ix.programIdIndex})`)
        console.log(`    Accounts: [${ix.accountIndexes.join(', ')}]`)
        console.log(`    Data (hex): ${ix.data.toString('hex')}`)
        console.log(`    Data (base64): ${ix.data.toString('base64')}`)

        const eid = extractEidFromInstruction(ix.data)
        if (eid) {
            console.log(`    Decoded EID: ${eid}`)
        }
        console.log()
    })

    // Now validate against payload
    console.log('═'.repeat(80))
    console.log('🔍 VALIDATION AGAINST PAYLOAD')
    console.log('═'.repeat(80))
    console.log()

    let allPassed = false

    // Detect payload format
    if (Array.isArray(payload)) {
        // Enforced options format
        allPassed = await validateEnforcedOptionsPayload(vaultTx, payload)
    } else if ('base58TransactionMessage' in payload) {
        // Base58 transaction message format
        allPassed = await validateBase58Payload(connection, vaultTx, payload)
    } else {
        console.log('❌ Unknown payload format')
        console.log('Expected either:')
        console.log('  - Array format with point.eid, point.address, data, description')
        console.log('  - Object format with base58TransactionMessage, multisig, etc.')
        return
    }

    // Final summary
    console.log('═'.repeat(80))
    if (allPassed) {
        console.log('✅ VALIDATION PASSED')
        console.log('═'.repeat(80))
        console.log()
        console.log('The anchor account data matches the payload file.')
    } else {
        console.log('❌ VALIDATION FAILED')
        console.log('═'.repeat(80))
        console.log()
        console.log('Some checks did not pass. Review the output above.')
    }
    console.log()
}

/**
 * Extract anchor address from Solana Explorer URL
 * Supports formats like:
 * - https://explorer.solana.com/address/DQQ7t7m8Uyn5JSeAnpTLSy18b7NbTLaTuRb1Nsogtcxp/anchor-account
 * - https://explorer.solana.com/address/DQQ7t7m8Uyn5JSeAnpTLSy18b7NbTLaTuRb1Nsogtcxp/anchor-account?cluster=mainnet-beta
 * - explorer.solana.com/address/DQQ7t7m8Uyn5JSeAnpTLSy18b7NbTLaTuRb1Nsogtcxp
 * - DQQ7t7m8Uyn5JSeAnpTLSy18b7NbTLaTuRb1Nsogtcxp (raw address)
 */
function parseAnchorAddress(input: string): { address: string; cluster?: string } {
    // If it doesn't contain 'explorer.solana.com', treat as raw address
    if (!input.includes('explorer.solana.com')) {
        return { address: input }
    }

    try {
        // Parse URL
        const url = new URL(input.startsWith('http') ? input : `https://${input}`)
        
        // Extract address from path: /address/{ADDRESS}/anchor-account or /address/{ADDRESS}
        const pathMatch = url.pathname.match(/\/address\/([A-Za-z0-9]+)/)
        if (!pathMatch) {
            throw new Error('Could not extract address from URL path')
        }

        const address = pathMatch[1]

        // Extract cluster from query parameters
        const cluster = url.searchParams.get('cluster') || undefined

        return { address, cluster }
    } catch (error) {
        throw new Error(`Invalid anchor address or URL: ${input}. Error: ${error}`)
    }
}

task('lz:oft:solana:validate-anchor-data', 'Validate Solana anchor account data against a payload file')
    .addParam('payloadFile', 'Path to the JSON payload file', undefined, types.string)
    .addOptionalParam('anchorAddress', 'Solana anchor account address (raw address)', undefined, types.string)
    .addOptionalParam('anchorUrl', 'Solana Explorer URL with anchor account', undefined, types.string)
    .addOptionalParam('rpc', 'Solana RPC endpoint URL', undefined, types.string)
    .addOptionalParam(
        'cluster',
        'Solana cluster (mainnet-beta, testnet, devnet)',
        'mainnet-beta',
        types.string
    )
    .setAction(async (taskArgs: ValidateArgs) => {
        // Load payload
        const payload = JSON.parse(fs.readFileSync(taskArgs.payloadFile, 'utf8'))

        // Parse anchor address from either URL or direct address
        let anchorAddressStr: string
        let detectedCluster: string | undefined

        if (taskArgs.anchorUrl) {
            const parsed = parseAnchorAddress(taskArgs.anchorUrl)
            anchorAddressStr = parsed.address
            detectedCluster = parsed.cluster
            console.log(`📍 Parsed from URL: ${anchorAddressStr}`)
            if (detectedCluster) {
                console.log(`   Detected cluster: ${detectedCluster}`)
            }
        } else if (taskArgs.anchorAddress) {
            const parsed = parseAnchorAddress(taskArgs.anchorAddress)
            anchorAddressStr = parsed.address
        } else {
            throw new Error('Must provide either --anchor-address or --anchor-url')
        }

        // Determine RPC endpoint (prefer explicit --cluster, then detected from URL, then default)
        const clusterToUse = taskArgs.cluster || detectedCluster || 'mainnet-beta'
        
        let rpcUrl = taskArgs.rpc
        if (!rpcUrl) {
            const clusterMap: { [key: string]: string } = {
                'mainnet-beta': 'https://api.mainnet-beta.solana.com',
                testnet: 'https://api.testnet.solana.com',
                devnet: 'https://api.devnet.solana.com',
            }
            rpcUrl = clusterMap[clusterToUse]
        }

        console.log(`Using RPC: ${rpcUrl} (${clusterToUse})`)
        console.log()

        // Create connection
        const connection = new Connection(rpcUrl, 'confirmed')

        // Parse anchor address
        const anchorAddress = new PublicKey(anchorAddressStr)

        // Validate
        await validateAnchorData(connection, anchorAddress, payload)
    })

