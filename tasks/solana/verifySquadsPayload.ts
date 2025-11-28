import fs from 'fs'

import { Message } from '@solana/web3.js'
import bs58 from 'bs58'
import { task } from 'hardhat/config'

import { types } from '@layerzerolabs/devtools-evm-hardhat'

interface VerifyArgs {
    payloadFile: string
    squadsData?: string
}

task('lz:oft:solana:verify-squads-payload', 'Verify a Squads payload matches what you see in Squads UI')
    .addParam('payloadFile', 'Path to the JSON payload file', undefined, types.string)
    .addOptionalParam('squadsData', 'Base64 or base58 instruction data from Squads UI to verify', undefined, types.string)
    .setAction(async (taskArgs: VerifyArgs) => {
        const payload = JSON.parse(fs.readFileSync(taskArgs.payloadFile, 'utf8'))

        console.log('🔍 Squads Payload Verification Tool\n')
        console.log(`Payload File: ${taskArgs.payloadFile}`)
        console.log('Timestamp:', payload.timestamp)

        // Decode the base58 transaction message from our JSON
        const base58Message = payload.base58TransactionMessage
        console.log('\n📦 Base58 Transaction Message:\n')
        console.log(base58Message)

        const messageBytes = bs58.decode(base58Message)
        const message = Message.from(Buffer.from(messageBytes))

        // Get the instruction data
        const compiledIx = message.compiledInstructions[0]
        const instructionData = compiledIx.data

        console.log('\n📋 Instruction Data (Multiple Formats):\n')
        console.log('Base58:', bs58.encode(instructionData))
        console.log('Base64:', Buffer.from(instructionData).toString('base64'))
        console.log('Hex:   ', Buffer.from(instructionData).toString('hex'))

        console.log('\n📊 Message Details:\n')
        console.log('Recent Blockhash:', message.recentBlockhash)
        console.log('Fee Payer (Vault):', message.accountKeys[0].toBase58())
        console.log('Program ID:', message.accountKeys[message.compiledInstructions[0].programIdIndex].toBase58())

        console.log('\n🏦 Accounts in Instruction:\n')
        const accountKeys = message.accountKeys
        compiledIx.accountKeyIndexes.forEach((index: number, i: number) => {
            const pubkey = accountKeys[index]
            const isSigner = message.isAccountSigner(index)
            const isWritable = message.isAccountWritable(index)
            const flags = []
            if (isSigner) flags.push('signer')
            if (isWritable) flags.push('writable')
            console.log(`  ${i + 1}. ${pubkey.toBase58()} (${flags.join(', ') || 'readonly'})`)
        })

        console.log('💡 To Verify Against Squads UI:')
        console.log('\n1. Compare Instruction Data:')
        console.log('   - Squads shows in base64 or base58')
        console.log('   - Match against formats shown above')
        console.log('\n2. Verify Accounts:')
        console.log('   - Order must match exactly')
        console.log('   - Check signer/writable flags match')
        console.log('\n3. Check Program ID:')
        console.log('   - Must be:', message.accountKeys[message.compiledInstructions[0].programIdIndex].toBase58())

        // Interactive verification
        if (taskArgs.squadsData) {
            console.log('\n✅ Verifying Against Squads Data:\n')
            
            // Try to match against base64 or base58
            const ourBase64 = Buffer.from(instructionData).toString('base64')
            const ourBase58 = bs58.encode(instructionData)
            
            if (taskArgs.squadsData === ourBase64) {
                console.log('✅ PERFECT MATCH! Squads has the correct payload (base64 format).')
            } else if (taskArgs.squadsData === ourBase58) {
                console.log('✅ PERFECT MATCH! Squads has the correct payload (base58 format).')
            } else {
                console.log('❌ MISMATCH! Different instruction data.')
                console.log('Squads shows:', taskArgs.squadsData)
                console.log('Our base64: ', ourBase64)
                console.log('Our base58: ', ourBase58)
            }
        } else {
            console.log('\n💡 To verify against Squads UI data:')
            console.log('  Add --squads-data "<BASE64_OR_BASE58_FROM_SQUADS>"')
            console.log('\nExample:')
            console.log('  pnpm hardhat lz:oft:solana:verify-squads-payload \\')
            console.log(`    --payload-file "${taskArgs.payloadFile}" \\`)
            console.log('    --squads-data "4Ebx4z6yamEBAAAA..."')
        }

        return {
            instructionDataBase64: Buffer.from(instructionData).toString('base64'),
            instructionDataBase58: bs58.encode(instructionData),
            instructionDataHex: Buffer.from(instructionData).toString('hex'),
            accounts: compiledIx.accountKeyIndexes.map((index: number) => ({
                pubkey: accountKeys[index].toBase58(),
                isSigner: message.isAccountSigner(index),
                isWritable: message.isAccountWritable(index),
            })),
            programId: message.accountKeys[message.compiledInstructions[0].programIdIndex].toBase58(),
            blockhash: message.recentBlockhash,
        }
    })

