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

import { MultisigOptions, handleTransactionExecution } from './utils/multisigHelper'

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
    .addOptionalParam('multisigKey', 'Multisig account public key (if using multisig)', undefined, types.string)
    .addOptionalParam(
        'executeImmediately',
        'Execute transaction immediately (false to just generate payload)',
        true,
        types.boolean
    )
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

            // Use the multisig helper
            const result = await handleTransactionExecution(
                transaction,
                {
                    multisigKey: taskArgs.multisigKey,
                    executeImmediately: taskArgs.executeImmediately,
                },
                {
                    taskName: 'Inbound Rate Limit',
                    eid: taskArgs.eid,
                    executeTransaction: async () => {
                        transaction.sign(keypair)
                        const txId = await sendAndConfirmTransaction(connection, transaction, [keypair])

                        // Show updated peer info
                        const [peer] = new OftPDA(publicKey(taskArgs.programId)).peer(
                            publicKey(taskArgs.oftStore),
                            taskArgs.srcEid
                        )
                        const peerInfo = await oft.accounts.fetchPeerConfig({ rpc: umi.rpc }, peer)
                        console.log('\n📊 Updated Peer Configuration:')
                        console.dir({ peerInfo }, { depth: null })

                        return txId
                    },
                    additionalData: {
                        srcEid: taskArgs.srcEid,
                        capacity: taskArgs.capacity,
                        refillPerSecond: taskArgs.refillPerSecond,
                    },
                }
            )

            return result
        } catch (error) {
            console.error(`\n❌ Inbound rate limit operation failed:`, error)
            throw error
        }
    })
