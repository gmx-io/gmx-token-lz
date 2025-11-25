import assert from 'assert'

import { mplToolbox } from '@metaplex-foundation/mpl-toolbox'
import { createSignerFromKeypair, publicKey, signerIdentity } from '@metaplex-foundation/umi'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { fromWeb3JsKeypair, toWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters'
import { Keypair, PublicKey, sendAndConfirmTransaction } from '@solana/web3.js'
import bs58 from 'bs58'
import { task } from 'hardhat/config'

import { types } from '@layerzerolabs/devtools-evm-hardhat'
import { deserializeTransactionMessage } from '@layerzerolabs/devtools-solana'
import { EndpointId } from '@layerzerolabs/lz-definitions'
import { OftPDA, oft } from '@layerzerolabs/oft-v2-solana-sdk'
import { createOFTFactory } from '@layerzerolabs/ua-devtools-solana'

import { createSolanaConnectionFactory } from '../common/utils'

import { MultisigOptions, simulateTransaction, generateSquadsPayload, generateBase58TransactionMessage } from './utils/multisigHelper'

interface Args extends MultisigOptions {
    mint: string
    eid: EndpointId
    srcEid: EndpointId
    programId: string
    oftStore: string
    capacity: bigint
    refillPerSecond: bigint
}

task(
    'lz:oft:solana:inbound-rate-limit',
    "Sets the Solana and EVM rate limits from './scripts/solana/utils/constants.ts'"
)
    .addParam('mint', 'The OFT token mint public key')
    .addParam('programId', 'The OFT Program id')
    .addParam('eid', 'Solana mainnet (30168) or testnet (40168)', undefined, types.eid)
    .addParam('srcEid', 'The source endpoint ID', undefined, types.eid)
    .addParam('oftStore', 'The OFTStore account')
    .addParam('capacity', 'The capacity of the rate limit', undefined, types.bigint)
    .addParam('refillPerSecond', 'The refill rate of the rate limit', undefined, types.bigint)
    .addOptionalParam('multisigKey', 'Multisig vault/authority public key (if using multisig)', undefined, types.string)
    .addOptionalParam('multisigPda', 'Squads multisig PDA', undefined, types.string)
    .addOptionalParam(
        'executeImmediately',
        'Execute transaction immediately (false to just generate payload)',
        true,
        types.boolean
    )
    .addFlag('simulate', 'Simulate the transaction to verify it will work')
    .addFlag('onlyBase58', 'Output base58 transaction message for Squads UI')
    .setAction(async (taskArgs: Args, hre) => {
        const privateKey = process.env.SOLANA_PRIVATE_KEY
        assert(!!privateKey, 'SOLANA_PRIVATE_KEY is not defined in the environment variables.')

        const keypair = Keypair.fromSecretKey(bs58.decode(privateKey))
        const umiKeypair = fromWeb3JsKeypair(keypair)

        const connectionFactory = createSolanaConnectionFactory()
        const connection = await connectionFactory(taskArgs.eid)

        const umi = createUmi(connection.rpcEndpoint).use(mplToolbox())
        const umiWalletSigner = createSignerFromKeypair(umi, umiKeypair)
        umi.use(signerIdentity(umiWalletSigner))

        const solanaSdkFactory = createOFTFactory(
            () => toWeb3JsPublicKey(umiWalletSigner.publicKey),
            () => new PublicKey(taskArgs.programId),
            connectionFactory
        )
        const sdk = await solanaSdkFactory({
            address: new PublicKey(taskArgs.oftStore).toBase58(),
            eid: taskArgs.eid,
        })
        const solanaRateLimits = {
            capacity: taskArgs.capacity,
            refillPerSecond: taskArgs.refillPerSecond,
        }

        console.log('\n📋 Inbound Rate Limit Configuration:')
        console.log('─'.repeat(50))
        console.log(`EID: ${taskArgs.eid}`)
        console.log(`Source EID: ${taskArgs.srcEid}`)
        console.log(`OFT Store: ${taskArgs.oftStore}`)
        console.log(`Capacity: ${taskArgs.capacity} (${Number(taskArgs.capacity) / 1e9} tokens)`)
        console.log(
            `Refill Per Second: ${taskArgs.refillPerSecond} (${Number(taskArgs.refillPerSecond) / 1e9} tokens/sec)`
        )
        console.log('─'.repeat(50))

        try {
            // Get the transaction data from SDK
            const transactionData = await sdk.setInboundRateLimit(taskArgs.srcEid, solanaRateLimits)
            const transaction = deserializeTransactionMessage(transactionData.data)

            // Get admin pubkey (multisig or keypair)
            const adminPubkey = taskArgs.multisigKey ? new PublicKey(taskArgs.multisigKey) : keypair.publicKey

            // Extract instruction from transaction
            const instruction = transaction.instructions[0]

            // Handle base58 message generation
            if (taskArgs.onlyBase58) {
                if (!taskArgs.multisigKey) {
                    throw new Error('--multisig-key is required when using --only-base58')
                }

                const result = await generateBase58TransactionMessage(
                    connection,
                    instruction,
                    new PublicKey(taskArgs.multisigKey),
                    taskArgs.simulate
                )

                return {
                    ...result,
                    srcEid: taskArgs.srcEid,
                    capacity: taskArgs.capacity,
                    refillPerSecond: taskArgs.refillPerSecond,
                }
            }

            // Handle simulation
            if (taskArgs.simulate) {
                const result = await simulateTransaction(connection, transaction, adminPubkey)
                return {
                    ...result,
                    srcEid: taskArgs.srcEid,
                    capacity: taskArgs.capacity,
                    refillPerSecond: taskArgs.refillPerSecond,
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
                        operationName: 'solana-set-inbound-rate-limit',
                        description: 'Inbound rate limit configuration',
                        actions: `srcEid=${taskArgs.srcEid}, capacity=${taskArgs.capacity}, refillPerSecond=${taskArgs.refillPerSecond}`,
                    }
                )

                return {
                    multisigAccount: taskArgs.multisigKey,
                    payloadFile: filepath,
                    base58TransactionMessage: base58Message,
                    srcEid: taskArgs.srcEid,
                    capacity: taskArgs.capacity,
                    refillPerSecond: taskArgs.refillPerSecond,
                }
            } else if (taskArgs.executeImmediately) {
                // Execute immediately
                console.log('\n⚡ Executing inbound rate limit configuration...')

                transaction.sign(keypair)
                const txId = await sendAndConfirmTransaction(connection, transaction, [keypair])

                console.log('✅ Transaction successful!')
                console.log(`Transaction ID: ${txId}`)

                const isTestnet = taskArgs.eid === EndpointId.SOLANA_V2_TESTNET
                const explorerUrl = isTestnet
                    ? `https://solscan.io/tx/${txId}?cluster=devnet`
                    : `https://solscan.io/tx/${txId}`
                console.log(`Explorer: ${explorerUrl}`)

                // Show updated peer info
                const [peer] = new OftPDA(publicKey(taskArgs.programId)).peer(
                    publicKey(taskArgs.oftStore),
                    taskArgs.srcEid
                )
                const peerInfo = await oft.accounts.fetchPeerConfig({ rpc: umi.rpc }, peer)
                console.log('\n📊 Updated Peer Configuration:')
                console.dir({ peerInfo }, { depth: null })

                return {
                    transactionId: txId,
                    explorerUrl,
                    srcEid: taskArgs.srcEid,
                    capacity: taskArgs.capacity,
                    refillPerSecond: taskArgs.refillPerSecond,
                }
            } else {
                console.log('\n🔍 Dry run - no transaction executed')
                console.log('Add --execute-immediately true to execute')
                console.log('Add --multisig-key <MULTISIG_PUBKEY> to generate multisig payload')

                return {
                    dryRun: true,
                    srcEid: taskArgs.srcEid,
                    capacity: taskArgs.capacity,
                    refillPerSecond: taskArgs.refillPerSecond,
                }
            }
        } catch (error) {
            console.error(`\n❌ Inbound rate limit operation failed:`, error)
            throw error
        }
    })
