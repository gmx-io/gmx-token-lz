import { Transaction } from '@solana/web3.js'
import bs58 from 'bs58'

import { EndpointId } from '@layerzerolabs/lz-definitions'

export interface MultisigOptions {
    multisigKey?: string
    executeImmediately?: boolean
}

export interface MultisigResult {
    multisigAccount?: string
    payload?: string
    instructionData?: string
    transactionId?: string
    explorerUrl?: string
    dryRun?: boolean
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
        const payload = bs58.encode(serializedTransaction)

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
}
