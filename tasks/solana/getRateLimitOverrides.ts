import { PublicKey } from '@solana/web3.js'
import { task } from 'hardhat/config'

import { types } from '@layerzerolabs/devtools-evm-hardhat'
import { EndpointId } from '@layerzerolabs/lz-definitions'

import { createSolanaConnectionFactory } from '../common/utils'

interface Args {
    eid: EndpointId
    programId: string
    oftStore: string
    showRaw?: boolean
}

// Custom parser for YOUR OFTStore structure
function parseOFTStoreRaw(data: Buffer) {
    let offset = 8 // Skip discriminator

    // Parse OFTStore fields according to your program structure
    // Based on your state/oft.rs:

    // oft_type: OFTType (1 byte enum)
    const oftType = data.readUInt8(offset)
    offset += 1

    // ld2sd_rate: u64
    const ld2sdRate = data.readBigUInt64LE(offset)
    offset += 8

    // token_mint: Pubkey (32 bytes)
    const tokenMint = new PublicKey(data.slice(offset, offset + 32))
    offset += 32

    // token_escrow: Pubkey (32 bytes)
    const tokenEscrow = new PublicKey(data.slice(offset, offset + 32))
    offset += 32

    // endpoint_program: Pubkey (32 bytes)
    const endpointProgram = new PublicKey(data.slice(offset, offset + 32))
    offset += 32

    // bump: u8
    const bump = data.readUInt8(offset)
    offset += 1

    // tvl_ld: u64
    const tvlLd = data.readBigUInt64LE(offset)
    offset += 8

    // admin: Pubkey (32 bytes)
    const admin = new PublicKey(data.slice(offset, offset + 32))
    offset += 32

    // default_fee_bps: u16
    const defaultFeeBps = data.readUInt16LE(offset)
    offset += 2

    // paused: bool
    const paused = data.readUInt8(offset) === 1
    offset += 1

    // pauser: Option<Pubkey>
    const hasPauser = data.readUInt8(offset) === 1
    offset += 1
    let pauser = null
    if (hasPauser) {
        pauser = new PublicKey(data.slice(offset, offset + 32))
        offset += 32
    }

    // unpauser: Option<Pubkey>
    const hasUnpauser = data.readUInt8(offset) === 1
    offset += 1
    let unpauser = null
    if (hasUnpauser) {
        unpauser = new PublicKey(data.slice(offset, offset + 32))
        offset += 32
    }

    // rate_limit_override: Vec<Pubkey>
    const overrideCount = data.readUInt32LE(offset)
    offset += 4
    const rateLimitOverrides = []
    for (let i = 0; i < overrideCount; i++) {
        rateLimitOverrides.push(new PublicKey(data.slice(offset, offset + 32)))
        offset += 32
    }

    // max_rate_limit_overrides: u8
    const maxRateLimitOverrides = data.readUInt8(offset)
    offset += 1

    // rate_limit_override_guids: Vec<[u8; 32]>
    const guidCount = data.readUInt32LE(offset)
    offset += 4
    const rateLimitOverrideGuids = []
    for (let i = 0; i < guidCount; i++) {
        rateLimitOverrideGuids.push(data.slice(offset, offset + 32))
        offset += 32
    }

    // max_rate_limit_override_guid_count: u8
    const maxRateLimitOverrideGuidCount = data.readUInt8(offset)
    offset += 1

    return {
        oftType,
        ld2sdRate,
        tokenMint,
        tokenEscrow,
        endpointProgram,
        bump,
        tvlLd,
        admin,
        defaultFeeBps,
        paused,
        pauser,
        unpauser,
        rateLimitOverrides,
        maxRateLimitOverrides,
        rateLimitOverrideGuids,
        maxRateLimitOverrideGuidCount,
        totalParsedBytes: offset,
    }
}

task('lz:oft:solana:get-rate-limit-overrides', 'Gets rate limit overrides using raw account data parsing')
    .addParam('eid', 'Solana mainnet (30168) or testnet (40168)', undefined, types.eid)
    .addParam('programId', 'The OFT Program id')
    .addParam('oftStore', 'The OFTStore account')
    .addOptionalParam('showRaw', 'Show raw account data', false, types.boolean)
    .setAction(async (taskArgs: Args, _) => {
        try {
            const connectionFactory = createSolanaConnectionFactory()
            const connection = await connectionFactory(taskArgs.eid)

            console.log('\n📋 Raw Rate Limit Override Status:')
            console.log('═'.repeat(60))
            console.log(`EID: ${taskArgs.eid}`)
            console.log(`Program ID: ${taskArgs.programId}`)
            console.log(`OFT Store: ${taskArgs.oftStore}`)
            console.log('═'.repeat(60))

            // Get raw account data
            const accountInfo = await connection.getAccountInfo(new PublicKey(taskArgs.oftStore))

            if (!accountInfo) {
                console.log('❌ OFT Store account not found')
                return
            }

            console.log(`📦 Account Size: ${accountInfo.data.length} bytes`)
            console.log(`💰 Account Lamports: ${accountInfo.lamports} (${accountInfo.lamports / 1e9} SOL)`)

            // Parse using our custom parser
            const oftStoreData = parseOFTStoreRaw(accountInfo.data)

            console.log('\n🏷️  ADDRESS OVERRIDES (Raw Parse):')
            console.log('─'.repeat(60))

            if (oftStoreData.rateLimitOverrides.length > 0) {
                console.log(`✅ ${oftStoreData.rateLimitOverrides.length} address(es) whitelisted:`)
                oftStoreData.rateLimitOverrides.forEach((address, index) => {
                    console.log(`   ${index + 1}. ${address.toBase58()}`)
                })
            } else {
                console.log('❌ No addresses whitelisted')
            }
            console.log(
                `📊 Capacity: ${oftStoreData.rateLimitOverrides.length}/${oftStoreData.maxRateLimitOverrides} addresses used`
            )

            console.log('\n🔑 GUID OVERRIDES (Raw Parse):')
            console.log('─'.repeat(60))

            if (oftStoreData.rateLimitOverrideGuids.length > 0) {
                console.log(`✅ ${oftStoreData.rateLimitOverrideGuids.length} GUID(s) can bypass:`)
                oftStoreData.rateLimitOverrideGuids.forEach((guid, index) => {
                    console.log(`   ${index + 1}. ${guid.toString('hex')}`)
                })
            } else {
                console.log('❌ No GUIDs can bypass')
            }
            console.log(
                `📊 Capacity: ${oftStoreData.rateLimitOverrideGuids.length}/${oftStoreData.maxRateLimitOverrideGuidCount} GUIDs used`
            )

            console.log('\n⚙️  OFT STORE CONFIGURATION (Raw Parse):')
            console.log('─'.repeat(60))
            console.log(`Admin: ${oftStoreData.admin.toBase58()}`)
            console.log(`Token Mint: ${oftStoreData.tokenMint.toBase58()}`)
            console.log(`Token Escrow: ${oftStoreData.tokenEscrow.toBase58()}`)
            console.log(`Default Fee (BPS): ${oftStoreData.defaultFeeBps}`)
            console.log(`Paused: ${oftStoreData.paused}`)
            console.log(`Pauser: ${oftStoreData.pauser ? oftStoreData.pauser.toBase58() : 'Not set'}`)
            console.log(`Unpauser: ${oftStoreData.unpauser ? oftStoreData.unpauser.toBase58() : 'Not set'}`)
            console.log(`Total Value Locked: ${oftStoreData.tvlLd} (${Number(oftStoreData.tvlLd) / 1e9} tokens)`)
            console.log(`Bump: ${oftStoreData.bump}`)

            if (taskArgs.showRaw) {
                console.log('\n🔍 Raw Account Data (first 200 bytes):')
                console.log('─'.repeat(60))
                console.log(accountInfo.data.slice(0, 200).toString('hex'))
            }

            console.log('═'.repeat(60))

            return {
                addressOverrides: oftStoreData.rateLimitOverrides.map((addr) => addr.toBase58()),
                guidOverrides: oftStoreData.rateLimitOverrideGuids.map((guid) => guid.toString('hex')),
                maxAddresses: oftStoreData.maxRateLimitOverrides,
                maxGuids: oftStoreData.maxRateLimitOverrideGuidCount,
                admin: oftStoreData.admin.toBase58(),
                paused: oftStoreData.paused,
                tvl: oftStoreData.tvlLd,
                totalParsedBytes: oftStoreData.totalParsedBytes,
            }
        } catch (error) {
            console.error('❌ Failed to parse raw rate limit overrides:', error)
            throw error
        }
    })
