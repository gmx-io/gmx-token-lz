import fs from 'fs'
import path from 'path'

import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, VersionedTransaction, Message, TransactionMessage, MessageV0, AddressLookupTableAccount } from '@solana/web3.js'
import bs58 from 'bs58'
import * as multisig from '@sqds/multisig'

import { EndpointId } from '@layerzerolabs/lz-definitions'

/**
 * Load the OFT program IDL
 */
export function loadOftIDL() {
    const idlPath = path.join(__dirname, '../../../target/idl/oft.json')
    if (!fs.existsSync(idlPath)) {
        throw new Error(`IDL not found at ${idlPath}. Make sure you've built the program with 'anchor build'`)
    }
    return JSON.parse(fs.readFileSync(idlPath, 'utf8'))
}

export interface MultisigOptions {
    multisigKey?: string
    executeImmediately?: boolean
    simulate?: boolean
    multisigPda?: string // The actual Squads multisig PDA (different from vault)
    onlyBase58?: boolean // Just output base58 message without creating proposal
}

export interface MultisigResult {
    simulation?: any
    base58Message?: string
    [key: string]: any
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
 * Generate a Squads V4 compatible JSON payload with base58 transaction message
 */
export async function generateSquadsPayload(
    connection: Connection,
    instruction: TransactionInstruction,
    multisigKey: string,
    multisigPda: string | undefined,
    metadata: {
        description: string
        actions: string
        operationName?: string
    }
): Promise<{ payload: any; filename: string; filepath: string; base58Message: string }> {
    console.log('\n🔐 Squads V4 Multisig Payload Generated:')
    console.log('─'.repeat(50))
    console.log(`Vault: ${multisigKey}`)
    if (multisigPda) {
        console.log(`Multisig PDA: ${multisigPda}`)
    }

    // Generate base58 transaction message
    const vaultPda = new PublicKey(multisigKey)
    const { blockhash } = await connection.getLatestBlockhash()
    
    const legacyTransaction = new Transaction()
    legacyTransaction.add(instruction)
    legacyTransaction.recentBlockhash = blockhash
    legacyTransaction.feePayer = vaultPda
    
    const legacyMessage = legacyTransaction.compileMessage()
    const serializedLegacyMessage = legacyMessage.serialize()
    const base58Message = bs58.encode(Uint8Array.from(serializedLegacyMessage))

    console.log(`\n📋 Base58 Transaction Message:`)
    console.log(base58Message)

    // Create minimal payload
    const squadsPayload = {
        base58TransactionMessage: base58Message,
        multisig: multisigKey,
        ...(multisigPda && { multisigPda }),
        description: metadata.description,
        actions: metadata.actions.split(', '), // Convert to array
        timestamp: new Date().toISOString(),
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
    console.log('1. Go to app.squads.so and connect your wallet (as multisig member)')
    if (multisigPda) {
        console.log(`2. Navigate to multisig: ${multisigPda}`)
    }
    console.log('3. Click "Propose from Transaction Message"')
    console.log('4. Paste the base58 string from the JSON file')
    console.log('5. Squads will auto-parse and simulate')
    console.log('6. Other signers review and approve')
    console.log('7. Execute when threshold is reached')
    console.log('─'.repeat(50))

    return {
        payload: squadsPayload,
        filename,
        filepath,
        base58Message,
    }
}

/**
 * Add standard multisig parameters to any task
 */
export function addMultisigParams(task: any) {
    return task
        .addOptionalParam('multisigKey', 'Multisig vault/authority public key (if using multisig)', undefined, 'string')
        .addOptionalParam('multisigPda', 'Squads multisig PDA', undefined, 'string')
        .addOptionalParam(
            'executeImmediately',
            'Execute transaction immediately (false to just generate payload)',
            true,
            'boolean'
        )
        .addFlag('simulate', 'Simulate the transaction to verify it will work')
        .addFlag('onlyBase58', 'Output base58 transaction message for Squads UI')
}

/**
 * Generate base58-encoded transaction message for Squads UI
 */
export async function generateBase58TransactionMessage(
    connection: Connection,
    instruction: TransactionInstruction,
    vaultPda: PublicKey,
    simulate: boolean = false
): Promise<{ base58Message: string; message: TransactionMessage; simulation?: any }> {
    console.log('\n📦 Generating Base58 Transaction Message...')
    console.log('─'.repeat(50))

    const { blockhash } = await connection.getLatestBlockhash()
    
    // Create legacy Message format (what Squads expects)
    const legacyTransaction = new Transaction()
    legacyTransaction.add(instruction)
    legacyTransaction.recentBlockhash = blockhash
    legacyTransaction.feePayer = vaultPda
    
    // Compile to Message and serialize
    const legacyMessage = legacyTransaction.compileMessage()
    const serializedLegacyMessage = legacyMessage.serialize()
    const base58Message = bs58.encode(Uint8Array.from(serializedLegacyMessage))

    console.log(`Vault (Payer): ${vaultPda.toBase58()}`)
    console.log(`Blockhash: ${blockhash}`)
    console.log(`Instructions: 1`)
    console.log(`\n📋 Base58 Transaction Message:`)
    console.log(base58Message)
    
    // Create v0 message for simulation
    const transactionMessage = new TransactionMessage({
        payerKey: vaultPda,
        recentBlockhash: blockhash,
        instructions: [instruction],
    })
    const messageV0 = transactionMessage.compileToV0Message()

    // Simulate if requested
    let simulationResult
    if (simulate) {
        console.log(`\n🔍 Simulating transaction with vault as signer...`)
        console.log('─'.repeat(50))

        try {
            // Create a VersionedTransaction from the message
            const versionedTx = new VersionedTransaction(messageV0)
            
            // Simulate without signature verification
            const simulation = await connection.simulateTransaction(versionedTx, {
                sigVerify: false,
                commitment: 'confirmed',
            })

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

            simulationResult = simulation.value
        } catch (error) {
            console.error('❌ Simulation error:', error)
        }
    }

    console.log(`\n💡 Use this in Squads UI: "Propose from Transaction Message"`)
    console.log('─'.repeat(50))

    return { base58Message, message: transactionMessage, simulation: simulationResult }
}

