import { EndpointId } from '@layerzerolabs/lz-definitions'
import { ExecutorOptionType } from '@layerzerolabs/lz-v2-utilities'
import { generateConnectionsConfig } from '@layerzerolabs/metadata-tools'
import { OAppEnforcedOption, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat'

import { getOftStoreAddress } from './tasks/solana'

// Note:  Do not use address for EVM OmniPointHardhat contracts.  Contracts are loaded using hardhat-deploy.
// If you do use an address, ensure artifacts exists.
const arbitrumContract: OmniPointHardhat = {
    eid: EndpointId.ARBITRUM_V2_MAINNET,
    contractName: 'GMX_Adapter',
}

const avalancheContract: OmniPointHardhat = {
    eid: EndpointId.AVALANCHE_V2_MAINNET,
    contractName: 'GMX_Adapter',
}

const solanaContract: OmniPointHardhat = {
    eid: EndpointId.SOLANA_V2_TESTNET,
    address: getOftStoreAddress(EndpointId.SOLANA_V2_TESTNET),
}

const EVM_ENFORCED_OPTIONS: OAppEnforcedOption[] = [
    {
        msgType: 1,
        optionType: ExecutorOptionType.LZ_RECEIVE,
        gas: 80_000,
        value: 0,
    },
]

const SOLANA_ENFORCED_OPTIONS: OAppEnforcedOption[] = [
    {
        msgType: 1,
        optionType: ExecutorOptionType.LZ_RECEIVE,
        gas: 200_000,
        value: 2_500_000,
    },
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
            [
                ['LayerZero Labs', 'Canary'], // Required DVNs
                [['Deutsche Telekom', 'Horizen'], 1], // Optional DVNs, threshold
            ],
            [20, 12], // [A to B confirmations, B to A confirmations]
            [EVM_ENFORCED_OPTIONS, SOLANA_ENFORCED_OPTIONS], // Chain A enforcedOptions, Chain B enforcedOptions
        ],

        /* @notice Need DVNs on Solana - Deutsche Telekom and Canary don't exist
        [
            solanaContract, // Chain A contract
            arbitrumContract, // Chain B contract
            [
                ['LayerZero Labs'], // Required DVNs
                [['Horizen'], 1], // Optional DVNs, threshold
            ],
            [32, 20], // [A to B confirmations, B to A confirmations]
            [SOLANA_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS], // Chain A enforcedOptions, Chain B enforcedOptions
        ],

        [
            solanaContract, // Chain A contract
            avalancheContract, // Chain B contract
            [
                ['LayerZero Labs'], // Required DVNs
                [['Horizen'], 1], // Optional DVNs, threshold
            ],
            [10, 12], // [A to B confirmations, B to A confirmations]
            [EVM_ENFORCED_OPTIONS, SOLANA_ENFORCED_OPTIONS], // Chain A enforcedOptions, Chain B enforcedOptions
        ],
        */
    ])

    const contracts = [{ contract: arbitrumContract }, { contract: avalancheContract }, { contract: solanaContract }]

    return {
        contracts,
        connections,
    }
}
