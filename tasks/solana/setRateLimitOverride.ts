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

interface SetOverrideArgs extends MultisigOptions {
    eid: EndpointId
    programId: string
    oftStore: string
    addresses: string[]
    actions: ('add' | 'remove')[]
}

task('lz:oft:solana:set-rate-limit-override', 'Manages rate limit override addresses (whitelist) for Solana OFT')
    .addParam('eid', 'Solana mainnet (30168) or testnet (40168)', undefined, types.eid)
    .addParam('programId', 'The OFT Program id')
    .addParam('oftStore', 'The OFTStore account')
    .addParam('addresses', 'Comma-separated list of addresses to add/remove', undefined, types.csv)
    .addParam(
        'actions',
        'Comma-separated list of actions (add/remove) corresponding to addresses',
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
    .setAction(async (taskArgs: SetOverrideArgs, hre) => {
        const privateKey = process.env.SOLANA_PRIVATE_KEY
        assert(!!privateKey, 'SOLANA_PRIVATE_KEY is not defined in the environment variables.')

        // Validate inputs
        if (taskArgs.addresses.length !== taskArgs.actions.length) {
            throw new Error('Number of addresses must match number of actions')
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

        console.log('\n📋 Rate Limit Override Management:')
        console.log('─'.repeat(50))
        console.log(`EID: ${taskArgs.eid}`)
        console.log(`OFT Store: ${taskArgs.oftStore}`)
        console.log(`Program ID: ${taskArgs.programId}`)
        console.log('\nOperations:')
        for (let i = 0; i < taskArgs.addresses.length; i++) {
            console.log(`  ${i + 1}. ${taskArgs.actions[i].toUpperCase()}: ${taskArgs.addresses[i]}`)
        }
        console.log('─'.repeat(50))

        try {
            // Convert addresses and actions to proper format
            const addressPublicKeys = taskArgs.addresses.map((addr) => new PublicKey(addr))
            const actionEnums = taskArgs.actions.map((action) => ({ [action]: {} })) // Anchor enum format

            // Create the instruction using Anchor
            // When using multisig, the multisig account is the admin (not the keypair)
            const adminPubkey = taskArgs.multisigKey ? new PublicKey(taskArgs.multisigKey) : keypair.publicKey

            const instruction = await program.methods
                .manageRateLimitOverride({
                    addresses: addressPublicKeys,
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
                    addresses: taskArgs.addresses,
                    actions: taskArgs.actions,
                }
            }

            // Handle simulation (regular, not base58)
            if (taskArgs.simulate) {
                const result = await simulateTransaction(connection, transaction, adminPubkey)
                return {
                    ...result,
                    addresses: taskArgs.addresses,
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
                        operationName: 'solana-set-rate-limit-override',
                        description: 'Address rate limit override',
                        actions: taskArgs.addresses.map((addr, i) => `${taskArgs.actions[i].toUpperCase()} ${addr}`).join(', '),
                    }
                )

                return {
                    multisigAccount: taskArgs.multisigKey,
                    payloadFile: filepath,
                    base58TransactionMessage: base58Message,
                    addresses: taskArgs.addresses,
                    actions: taskArgs.actions,
                }
            } else if (taskArgs.executeImmediately) {
                // Execute immediately
                console.log('\n⚡ Executing rate limit override...')

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
                    addresses: taskArgs.addresses,
                    actions: taskArgs.actions,
                }
            } else {
                console.log('\n🔍 Dry run - no transaction executed')
                console.log('Add --execute-immediately true to execute')
                console.log('Add --multisig-key <MULTISIG_PUBKEY> to generate multisig payload')

                return {
                    dryRun: true,
                    addresses: taskArgs.addresses,
                    actions: taskArgs.actions,
                }
            }
        } catch (error) {
            console.error(`\n❌ Rate limit override operation failed:`, error)
            throw error
        }
    })
