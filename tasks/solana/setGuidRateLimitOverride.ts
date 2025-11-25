import assert from 'assert'
import fs from 'fs'
import path from 'path'

import * as anchor from '@coral-xyz/anchor'
import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor'
import { Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import bs58 from 'bs58'
import { task } from 'hardhat/config'

import { types } from '@layerzerolabs/devtools-evm-hardhat'
import { EndpointId } from '@layerzerolabs/lz-definitions'

import { createSolanaConnectionFactory } from '../common/utils'

import { MultisigOptions, simulateTransaction, generateSquadsPayload, generateBase58TransactionMessage, loadOftIDL } from './utils/multisigHelper'

interface SetGuidOverrideArgs extends MultisigOptions {
    eid: EndpointId
    programId: string
    oftStore: string
    guids: string[]
    actions: ('add' | 'remove')[]
}

// Convert hex or base58 GUID string to [u8; 32] array
function parseGuid(guidStr: string): number[] {
    let bytes: Uint8Array

    // Remove '0x' prefix if present
    if (guidStr.startsWith('0x')) {
        guidStr = guidStr.slice(2)
    }

    // Try to parse as hex (most common for GUIDs)
    if (/^[0-9a-fA-F]{64}$/.test(guidStr)) {
        bytes = new Uint8Array(
            guidStr.match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
        )
    }
    // Try to parse as base58
    else {
        try {
            bytes = bs58.decode(guidStr)
        } catch {
            throw new Error(
                `Invalid GUID format: ${guidStr}. Must be 64-char hex string (with optional 0x prefix) or base58 string`
            )
        }
    }

    if (bytes.length !== 32) {
        throw new Error(`GUID must be exactly 32 bytes. Got ${bytes.length} bytes from: ${guidStr}`)
    }

    return Array.from(bytes)
}

task('lz:oft:solana:set-guid-rate-limit-override', 'Manages GUID-based rate limit overrides for Solana OFT')
    .addParam('eid', 'Solana mainnet (30168) or testnet (40168)', undefined, types.eid)
    .addParam('programId', 'The OFT Program id')
    .addParam('oftStore', 'The OFTStore account')
    .addParam('guids', 'Comma-separated list of GUIDs (hex or base58)', undefined, types.csv)
    .addParam(
        'actions',
        'Comma-separated list of actions (add/remove) corresponding to GUIDs',
        undefined,
        types.csv
    )
    .addOptionalParam('multisigKey', 'Multisig vault/authority public key (if using multisig)', undefined, types.string)
    .addOptionalParam('multisigPda', 'Squads multisig PDA (required if using --create-proposal)', undefined, types.string)
    .addOptionalParam(
        'executeImmediately',
        'Execute transaction immediately (false to just generate payload)',
        true,
        types.boolean
    )
    .addFlag('simulate', 'Simulate the transaction to verify it will work')
    .addFlag('onlyBase58', 'Output base58 transaction message for Squads UI')
    .setAction(async (taskArgs: SetGuidOverrideArgs, hre) => {
        const privateKey = process.env.SOLANA_PRIVATE_KEY
        assert(!!privateKey, 'SOLANA_PRIVATE_KEY is not defined in the environment variables.')

        // Validate inputs
        if (taskArgs.guids.length !== taskArgs.actions.length) {
            throw new Error('Number of GUIDs must match number of actions')
        }

        for (const action of taskArgs.actions) {
            if (action !== 'add' && action !== 'remove') {
                throw new Error('Actions must be either "add" or "remove"')
            }
        }

        const keypair = Keypair.fromSecretKey(bs58.decode(privateKey))
        const connectionFactory = createSolanaConnectionFactory()
        const connection = await connectionFactory(taskArgs.eid)

        // Set up Anchor
        const wallet = new Wallet(keypair)
        const provider = new AnchorProvider(connection, wallet, {})
        anchor.setProvider(provider)

        // Load the IDL and create program
        const idl = loadOftIDL()
        const program = new Program(idl, new PublicKey(taskArgs.programId), provider)

        console.log('\n📋 GUID Rate Limit Override Management:')
        console.log('─'.repeat(50))
        console.log(`EID: ${taskArgs.eid}`)
        console.log(`OFT Store: ${taskArgs.oftStore}`)
        console.log(`Program ID: ${taskArgs.programId}`)
        console.log('\nOperations:')
        for (let i = 0; i < taskArgs.guids.length; i++) {
            console.log(`  ${i + 1}. ${taskArgs.actions[i].toUpperCase()}: ${taskArgs.guids[i]}`)
        }
        console.log('─'.repeat(50))

        try {
            // Convert GUIDs to [u8; 32] arrays
            const guidArrays = taskArgs.guids.map((guid) => parseGuid(guid))

            // Convert actions to Anchor enum format
            const actionEnums = taskArgs.actions.map((action) => ({ [action]: {} }))

            // Create the instruction using Anchor
            // When using multisig, the multisig account is the admin (not the keypair)
            const adminPubkey = taskArgs.multisigKey 
                ? new PublicKey(taskArgs.multisigKey)
                : keypair.publicKey
            
            const instruction = await program.methods
                .manageRateLimitOverrideGuid({
                    guids: guidArrays,
                    actions: actionEnums,
                })
                .accounts({
                    admin: adminPubkey,
                    oftStore: new PublicKey(taskArgs.oftStore),
                })
                .instruction()

            // Create transaction
            const transaction = new Transaction().add(instruction)
            const { blockhash } = await connection.getLatestBlockhash()
            transaction.recentBlockhash = blockhash
            transaction.feePayer = taskArgs.multisigKey ? new PublicKey(taskArgs.multisigKey) : keypair.publicKey

            // Handle base58 message generation (takes precedence over regular simulation)
            if (taskArgs.onlyBase58) {
                if (!taskArgs.multisigKey) {
                    throw new Error('--multisig-key is required when using --only-base58')
                }

                const result = await generateBase58TransactionMessage(
                    connection,
                    instruction,
                    new PublicKey(taskArgs.multisigKey),
                    taskArgs.simulate // Pass simulate flag through
                )

                return {
                    ...result,
                    guids: taskArgs.guids,
                    actions: taskArgs.actions,
                }
            }

            // Handle simulation (regular, not base58)
            if (taskArgs.simulate) {
                const result = await simulateTransaction(connection, transaction, adminPubkey)
                return {
                    ...result,
                    guids: taskArgs.guids,
                    actions: taskArgs.actions,
                }
            }

            if (taskArgs.multisigKey && !taskArgs.executeImmediately) {
                // Generate Squads V4 compatible payload
                const { filepath, base58Message } = await generateSquadsPayload(
                    connection,
                    instruction,
                    taskArgs.multisigKey,
                    taskArgs.multisigPda,
                    {
                        operationName: 'solana-set-guid-rate-limit-override',
                        description: 'GUID rate limit override',
                        actions: taskArgs.guids.map((guid, i) => `${taskArgs.actions[i].toUpperCase()} ${guid}`).join(', '),
                    }
                )

                return {
                    multisigAccount: taskArgs.multisigKey,
                    payloadFile: filepath,
                    base58TransactionMessage: base58Message,
                    guids: taskArgs.guids,
                    actions: taskArgs.actions,
                }
            } else if (taskArgs.executeImmediately) {
                // Execute immediately
                console.log('\n⚡ Executing GUID rate limit override...')

                const txId = await sendAndConfirmTransaction(connection, transaction, [keypair])

                console.log('✅ Transaction successful!')
                console.log(`Transaction ID: ${txId}`)

                const isTestnet = taskArgs.eid === EndpointId.SOLANA_V2_TESTNET
                const explorerUrl = isTestnet
                    ? `https://solscan.io/tx/${txId}?cluster=devnet`
                    : `https://solscan.io/tx/${txId}`
                console.log(`Explorer: ${explorerUrl}`)

                return {
                    transactionId: txId,
                    explorerUrl,
                    guids: taskArgs.guids,
                    actions: taskArgs.actions,
                }
            } else {
                console.log('\n🔍 Dry run - no transaction executed')
                console.log('Add --execute-immediately true to execute')
                console.log('Add --multisig-key <MULTISIG_PUBKEY> to generate multisig payload')

                return {
                    dryRun: true,
                    guids: taskArgs.guids,
                    actions: taskArgs.actions,
                }
            }
        } catch (error) {
            console.error(`\n❌ GUID rate limit override operation failed:`, error)
            throw error
        }
    })

