import bs58 from 'bs58'
import { task, types } from 'hardhat/config'

interface HexToBase58Args {
    hex?: string
    payloadFile?: string
}

task('utils:hex-to-base58', 'Convert hex string(s) to base58 encoding')
    .addOptionalParam('hex', 'Hex string to convert (with or without 0x prefix)', undefined, types.string)
    .addOptionalParam('payloadFile', 'Path to JSON payload file containing hex data fields', undefined, types.string)
    .setAction(async ({ hex, payloadFile }: HexToBase58Args) => {
        if (!hex && !payloadFile) {
            throw new Error('Must provide either --hex or --payload-file parameter')
        }

        if (hex && payloadFile) {
            throw new Error('Cannot provide both --hex and --payload-file parameters. Choose one.')
        }

        if (hex) {
            // Convert single hex string
            const cleanHex = hex.replace('0x', '')
            
            if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
                throw new Error(`Invalid hex string: ${hex}`)
            }

            const bytes = Buffer.from(cleanHex, 'hex')
            const base58 = bs58.encode(Uint8Array.from(bytes))

            console.log('\n📝 Hex to Base58 Conversion:')
            console.log('─'.repeat(50))
            console.log(`Hex:    ${hex}`)
            console.log(`Base58: ${base58}`)
            console.log(`Bytes:  ${bytes.length}`)

            return { hex, base58, bytes: bytes.length }
        }

        if (payloadFile) {
            // Convert all data fields in payload file
            const fs = await import('fs')
            const path = await import('path')

            const filePath = path.resolve(process.cwd(), payloadFile)
            
            if (!fs.existsSync(filePath)) {
                throw new Error(`Payload file not found: ${filePath}`)
            }

            const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'))

            if (!Array.isArray(payload)) {
                throw new Error('Payload file must contain a JSON array')
            }

            console.log('\n📝 Hex to Base58 Conversion from Payload File:')
            console.log('─'.repeat(50))
            console.log(`File: ${payloadFile}`)
            console.log(`Items: ${payload.length}\n`)

            const results = payload.map((item, index) => {
                if (!item.data) {
                    console.warn(`⚠️  Item ${index}: No 'data' field found, skipping`)
                    return null
                }

                const cleanHex = item.data.replace('0x', '')
                const bytes = Buffer.from(cleanHex, 'hex')
                const base58 = bs58.encode(Uint8Array.from(bytes))

                console.log(`Item ${index}:`)
                console.log(`  Hex:    ${item.data.substring(0, 66)}${item.data.length > 66 ? '...' : ''}`)
                console.log(`  Base58: ${base58}`)
                console.log(`  Bytes:  ${bytes.length}`)
                console.log(`  Desc:   ${item.description || 'N/A'}`)
                console.log()

                return {
                    index,
                    hex: item.data,
                    base58,
                    bytes: bytes.length,
                    description: item.description,
                }
            }).filter(Boolean)

            return results
        }
    })

