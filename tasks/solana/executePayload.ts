import { Keypair, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import bs58 from 'bs58'
import { task } from 'hardhat/config'

import { types } from '@layerzerolabs/devtools-evm-hardhat'
import { EndpointId } from '@layerzerolabs/lz-definitions'

import { createSolanaConnectionFactory } from '../common/utils'

interface ExecutePayloadArgs {
    payload: string
    eid: EndpointId
}

task('lz:solana:execute-payload', 'Execute a serialized Solana transaction payload using your private key')
    .addParam('payload', 'Base58 encoded transaction payload', undefined, types.string)
    .addParam('eid', 'Solana mainnet (30168) or testnet (40168)', EndpointId.SOLANA_V2_TESTNET, types.eid)
    .setAction(async ({ payload, eid }: ExecutePayloadArgs) => {
        const privateKey = process.env.SOLANA_PRIVATE_KEY
        if (!privateKey) {
            throw new Error('SOLANA_PRIVATE_KEY not found in .env file')
        }

        try {
            // Set up connection
            const connectionFactory = createSolanaConnectionFactory()
            const connection = await connectionFactory(eid)

            // Create keypair from private key
            const keypair = Keypair.fromSecretKey(bs58.decode(privateKey))

            console.log('🔍 Payload Execution Details:')
            console.log('─'.repeat(50))
            console.log(`Network: ${eid === EndpointId.SOLANA_V2_TESTNET ? 'Devnet' : 'Mainnet'}`)
            console.log(`Executor: ${keypair.publicKey.toBase58()}`)

            // Deserialize the transaction from the payload
            const transactionBuffer = bs58.decode(payload)
            const transaction = Transaction.from(transactionBuffer)

            console.log(`Fee Payer: ${transaction.feePayer?.toBase58()}`)
            console.log(`Instructions: ${transaction.instructions.length}`)
            console.log(`Original Blockhash: ${transaction.recentBlockhash}`)

            // Show instruction details
            transaction.instructions.forEach((ix, i) => {
                console.log(`Instruction ${i + 1}:`)
                console.log(`  Program: ${ix.programId.toBase58()}`)
                console.log(`  Data: ${ix.data.toString('hex')} (${ix.data.length} bytes)`)
                console.log(`  Accounts: ${ix.keys.length}`)
            })

            // Update recent blockhash (required for execution)
            const { blockhash } = await connection.getLatestBlockhash()
            transaction.recentBlockhash = blockhash

            console.log(`Updated Blockhash: ${blockhash}`)
            console.log('─'.repeat(50))

            console.log('\n⚡ Executing transaction...')

            // Execute the transaction
            const txId = await sendAndConfirmTransaction(connection, transaction, [keypair])

            console.log('✅ Transaction successful!')
            console.log(`Transaction ID: ${txId}`)

            // Get explorer link
            const isTestnet = eid === EndpointId.SOLANA_V2_TESTNET
            const explorerUrl = isTestnet
                ? `https://solscan.io/tx/${txId}?cluster=devnet`
                : `https://solscan.io/tx/${txId}`
            console.log(`Explorer: ${explorerUrl}`)

            return {
                transactionId: txId,
                explorerUrl,
                network: isTestnet ? 'devnet' : 'mainnet',
                executor: keypair.publicKey.toBase58(),
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            console.error('\n❌ Transaction failed:', errorMessage)

            // Try to get more details about the error
            if (error && typeof error === 'object' && 'logs' in error) {
                console.log('\n📋 Transaction Logs:')
                const logs = error.logs as string[]
                logs.forEach((log: string) => console.log(`  ${log}`))
            }

            // Provide helpful error context
            if (errorMessage.includes('signature verification')) {
                console.log('\n💡 This might be a multisig transaction that needs proper multisig execution.')
            } else if (errorMessage.includes('insufficient funds')) {
                console.log('\n💡 Make sure you have enough SOL for transaction fees.')
            } else if (errorMessage.includes('blockhash not found')) {
                console.log('\n💡 The transaction blockhash expired. This is normal for old payloads.')
            } else if (errorMessage.includes('Unsupported program id')) {
                console.log('\n💡 The program is not deployed or the program ID is incorrect.')
            }

            throw error
        }
    })
