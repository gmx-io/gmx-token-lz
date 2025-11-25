import fs from 'fs'
import path from 'path'

import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js'
import bs58 from 'bs58'

import { EndpointId } from '@layerzerolabs/lz-definitions'

export interface MultisigOptions {
    multisigKey?: string
    executeImmediately?: boolean
    simulate?: boolean
}

export interface MultisigResult {
    multisigAccount?: string
    payload?: string
    payloadFile?: string
    instructionData?: string
    transactionId?: string
    explorerUrl?: string
    dryRun?: boolean
    simulation?: any
}

/**
 * Universal helper for handling multisig payload generation vs immediate execution
 * Can be used by any Solana task to add multisig support
 */
export async function handleTransactionExecution(
    transaction: Transaction,
    options: MultisigOptions,
    context: {
        taskName: string
        eid: number
        executeTransaction: () => Promise<string> // Function that executes and returns txId
        additionalData?: Record<string, any> // Any additional data to include in result
    }
): Promise<MultisigResult> {
    const { multisigKey, executeImmediately = true } = options
    const { taskName, eid, executeTransaction, additionalData = {} } = context

    if (multisigKey && !executeImmediately) {
        // Generate payload for multisig
        console.log(`\n🔐 Multisig Payload Generated for ${taskName}:`)
        console.log('─'.repeat(60))

        // Serialize the transaction for multisig
        const serializedTransaction = transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false,
        })
        const payload = bs58.encode(Uint8Array.from(serializedTransaction))

        console.log(`Multisig Account: ${multisigKey}`)
        console.log(`Transaction Payload (base58): ${payload}`)
        console.log('\n📝 Instructions for Multisig:')
        console.log('1. Share this payload with other signers')
        console.log('2. Use your multisig tool (like Squads) to create proposal')
        console.log('3. Other signers approve the proposal')
        console.log('4. Execute when threshold is reached')

        if (transaction.instructions.length > 0) {
            console.log('\n🔧 Raw Instruction Data:')
            transaction.instructions.forEach((ix, i) => {
                console.log(`Instruction ${i + 1} (hex): ${ix.data.toString('hex')}`)
            })
        }
        console.log('─'.repeat(60))

        return {
            multisigAccount: multisigKey,
            payload,
            instructionData: transaction.instructions[0]?.data.toString('hex'),
            ...additionalData,
        }
    } else if (executeImmediately) {
        // Execute immediately
        console.log(`\n⚡ Executing ${taskName}...`)

        const txId = await executeTransaction()

        console.log(`✅ ${taskName} successful!`)
        console.log(`Transaction ID: ${txId}`)

        // Get explorer link
        const isTestnet = eid === EndpointId.SOLANA_V2_TESTNET
        const explorerUrl = isTestnet ? `https://solscan.io/tx/${txId}?cluster=devnet` : `https://solscan.io/tx/${txId}`
        console.log(`Explorer: ${explorerUrl}`)

        return {
            transactionId: txId,
            explorerUrl,
            ...additionalData,
        }
    } else {
        // Just show what would happen
        console.log(`\n🔍 Dry run for ${taskName} - no transaction executed`)
        console.log('Add --execute-immediately true to execute')
        console.log('Add --multisig-key <MULTISIG_PUBKEY> to generate multisig payload')

        return {
            dryRun: true,
            ...additionalData,
        }
    }
}

/**
 * Simulate a Solana transaction without executing it
 */
export async function simulateTransaction(
    connection: Connection,
    transaction: Transaction,
    adminPubkey: PublicKey
): Promise<MultisigResult> {
    console.log('\n🔍 Simulating transaction...')
    console.log('─'.repeat(50))

    try {
        console.log(`Admin (will be simulated as signer): ${adminPubkey.toBase58()}`)
        console.log(`Fee Payer: ${transaction.feePayer?.toBase58()}`)
        console.log('Note: Simulation runs without actual signatures\n')

        // Simulate transaction (no signatures required for simulation)
        const simulation = await connection.simulateTransaction(transaction)

        if (simulation.value.err) {
            console.log('❌ Simulation failed:')
            console.log(JSON.stringify(simulation.value.err, null, 2))
            console.log('\n📋 Logs:')
            simulation.value.logs?.forEach((log) => console.log(`  ${log}`))
        } else {
            console.log('✅ Simulation successful!')
            console.log(`Compute units used: ${simulation.value.unitsConsumed}`)
            console.log('\n📋 Program Logs:')
            simulation.value.logs?.forEach((log) => console.log(`  ${log}`))
        }
        console.log('─'.repeat(50))

        return {
            simulation: simulation.value,
        }
    } catch (error) {
        console.error('❌ Simulation error:', error)
        throw error
    }
}

/**
 * Generate a Squads V4 compatible JSON payload
 */
export function generateSquadsPayload(
    instruction: TransactionInstruction,
    multisigKey: string,
    programId: string,
    oftStore: string,
    metadata: {
        description: string
        [key: string]: any
    }
): { payload: any; filename: string; filepath: string } {
    const adminPubkey = new PublicKey(multisigKey)
    const oftStorePubkey = new PublicKey(oftStore)

    console.log('\n🔐 Squads V4 Multisig Payload Generated:')
    console.log('─'.repeat(50))
    console.log(`Multisig: ${multisigKey}`)
    console.log('\n📄 Instruction Details:')
    console.log(`Program ID: ${programId}`)
    console.log(`Instruction Data (hex): ${instruction.data.toString('hex')}`)
    console.log('\nAccounts:')

    // Extract account metadata from the instruction
    const keys = instruction.keys.map((key, index) => {
        const roleDescriptions = []
        if (key.isSigner) roleDescriptions.push('signer')
        if (key.isWritable) roleDescriptions.push('writable')
        const roleStr = roleDescriptions.length > 0 ? ` (${roleDescriptions.join(', ')})` : ' (readonly)'

        // Get account name for display
        let accountName = 'Unknown'
        if (key.pubkey.equals(adminPubkey)) {
            accountName = 'Admin (Multisig)'
        } else if (key.pubkey.equals(oftStorePubkey)) {
            accountName = 'OFT Store'
        }

        console.log(`  ${index + 1}. ${accountName}${roleStr}: ${key.pubkey.toBase58()}`)

        return {
            pubkey: key.pubkey.toBase58(),
            isSigner: key.isSigner,
            isWritable: key.isWritable,
        }
    })

    // Create Squads V4 compatible JSON payload
    const squadsPayload = {
        multisig: multisigKey,
        instruction: {
            programId: programId,
            data: Array.from(instruction.data), // Convert Buffer to number array for JSON
            keys: keys,
        },
        metadata: {
            ...metadata,
            timestamp: new Date().toISOString(),
        },
    }

    // Generate filename with date at the start (YYYY-MM-DD format)
    const date = new Date().toISOString().split('T')[0]
    const operationName = metadata.operationName || 'solana-operation'
    const filename = `${date}_${operationName}.json`
    const payloadsDir = path.join(process.cwd(), 'payloads')

    // Ensure payloads directory exists
    if (!fs.existsSync(payloadsDir)) {
        fs.mkdirSync(payloadsDir, { recursive: true })
    }

    const filepath = path.join(payloadsDir, filename)
    fs.writeFileSync(filepath, JSON.stringify(squadsPayload, null, 2))

    console.log(`\n💾 Payload saved to: ./payloads/${filename}`)
    console.log('\n📝 Next Steps:')
    console.log('1. Go to app.squads.so and connect your wallet')
    console.log(`2. Navigate to multisig: ${multisigKey}`)
    console.log('3. Create a new proposal')
    console.log('4. Import the instruction using the JSON file above')
    console.log('5. Other signers review and approve')
    console.log('6. Execute when threshold is reached')
    console.log('─'.repeat(50))

    return {
        payload: squadsPayload,
        filename,
        filepath,
    }
}

/**
 * Add standard multisig parameters to any task
 */
export function addMultisigParams(task: any) {
    return task
        .addOptionalParam('multisigKey', 'Multisig account public key (if using multisig)', undefined, 'string')
        .addOptionalParam(
            'executeImmediately',
            'Execute transaction immediately (false to just generate payload)',
            true,
            'boolean'
        )
        .addOptionalParam('simulate', 'Simulate the transaction to verify it will work', false, 'boolean')
}
