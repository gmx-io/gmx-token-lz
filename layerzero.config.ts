import { EndpointId } from '@layerzerolabs/lz-definitions'
import { ExecutorOptionType } from '@layerzerolabs/lz-v2-utilities'
import { generateConnectionsConfig } from '@layerzerolabs/metadata-tools'
import { OAppEnforcedOption, OAppOmniGraphHardhat, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat'

import { getOftStoreAddress } from './tasks/solana'

// Note:  Do not use address for EVM OmniPointHardhat contracts.  Contracts are loaded using hardhat-deploy.
// If you do use an address, ensure artifacts exists.
const arbitrumContract: OmniPointHardhat = {
    eid: EndpointId.ARBITRUM_V2_MAINNET,
    contractName: 'GMX_LockboxAdapter',
}

const avalancheContract: OmniPointHardhat = {
    eid: EndpointId.AVALANCHE_V2_MAINNET,
    contractName: 'GMX_MintBurnAdapter',
}

const solanaContract: OmniPointHardhat = {
    eid: EndpointId.SOLANA_V2_MAINNET,
    address: getOftStoreAddress(EndpointId.SOLANA_V2_MAINNET),
}

const EVM_ENFORCED_OPTIONS: OAppEnforcedOption[] = [
    {
        msgType: 1,
        optionType: ExecutorOptionType.LZ_RECEIVE,
        gas: 80_000,
        value: 0,
    },
]

const CU_LIMIT = 200000 // This represents the CU limit for executing the `lz_receive` function on Solana.
const SPL_TOKEN_ACCOUNT_RENT_VALUE = 2039280 // This figure represents lamports (https://solana.com/docs/references/terminology#lamport) on Solana. Read below for more details.
/*
 *  Elaboration on `value` when sending OFTs to Solana:
 *   When sending OFTs to Solana, SOL is needed for rent (https://solana.com/docs/core/accounts#rent) to initialize the recipient's token account.
 *   The `2039280` lamports value is the exact rent value needed for SPL token accounts (0.00203928 SOL).
 *   For Token2022 token accounts, you will need to increase `value` to a higher amount, which depends on the token account size, which in turn depends on the extensions that you enable.
 */

const SOLANA_ENFORCED_OPTIONS: OAppEnforcedOption[] = [
    {
        msgType: 1,
        optionType: ExecutorOptionType.LZ_RECEIVE,
        gas: CU_LIMIT,
        value: SPL_TOKEN_ACCOUNT_RENT_VALUE,
    },
]

const BlockConfirmations = {
    [EndpointId.ARBITRUM_V2_MAINNET]: 20,
    [EndpointId.AVALANCHE_V2_MAINNET]: 12,
    [EndpointId.SOLANA_V2_MAINNET]: 32,
}

const DVNs: [string[], [string[], number]] = [
    ['LayerZero Labs', 'Canary'], // Required DVNs
    [['Deutsche Telekom', 'Horizen'], 1], // Optional DVNs, threshold
]

// Learn about Message Execution Options: https://docs.layerzero.network/v2/developers/solana/oft/account#message-execution-options
// Learn more about the Simple Config Generator - https://docs.layerzero.network/v2/developers/evm/technical-reference/simple-config
export default async function () {
    // note: pathways declared here are automatically bidirectional
    // if you declare A,B there's no need to declare B,A
    const connections = await generateConnectionsConfig([
        [
            arbitrumContract, // Chain A contract
            avalancheContract, // Chain B contract
            DVNs,
            [BlockConfirmations[EndpointId.ARBITRUM_V2_MAINNET], BlockConfirmations[EndpointId.AVALANCHE_V2_MAINNET]], // [A to B confirmations, B to A confirmations]
            [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS], // Chain B enforcedOptions, Chain A enforcedOptions
        ],

        [
            solanaContract, // Chain A contract
            arbitrumContract, // Chain B contract
            DVNs,
            [BlockConfirmations[EndpointId.SOLANA_V2_MAINNET], BlockConfirmations[EndpointId.ARBITRUM_V2_MAINNET]], // [A to B confirmations, B to A confirmations]
            [EVM_ENFORCED_OPTIONS, SOLANA_ENFORCED_OPTIONS], // Chain B enforcedOptions, Chain A enforcedOptions
        ],

        [
            solanaContract, // Chain A contract
            avalancheContract, // Chain B contract
            DVNs,
            [BlockConfirmations[EndpointId.SOLANA_V2_MAINNET], BlockConfirmations[EndpointId.AVALANCHE_V2_MAINNET]], // [A to B confirmations, B to A confirmations]
            [EVM_ENFORCED_OPTIONS, SOLANA_ENFORCED_OPTIONS], // Chain B enforcedOptions, Chain A enforcedOptions
        ],
    ])

    const contracts: OAppOmniGraphHardhat['contracts'] = [
        {
            contract: arbitrumContract,
            config: {
                owner: '0x8D1d2e24eC641eDC6a1ebe0F3aE7af0EBC573e0D',
                delegate: '0x8D1d2e24eC641eDC6a1ebe0F3aE7af0EBC573e0D',
            },
        },
        {
            contract: avalancheContract,
            config: {
                owner: '0x8D1d2e24eC641eDC6a1ebe0F3aE7af0EBC573e0D',
                delegate: '0x8D1d2e24eC641eDC6a1ebe0F3aE7af0EBC573e0D',
            },
        },
        {
            contract: solanaContract,
            config: {
                owner: 'EwXp4sepbKE7aoSn6Q4APR26BKWoqsc7hKq8NtCUpC1K',
                delegate: 'EwXp4sepbKE7aoSn6Q4APR26BKWoqsc7hKq8NtCUpC1K',
            },
        },
    ]

    return {
        contracts,
        connections,
    }
}
