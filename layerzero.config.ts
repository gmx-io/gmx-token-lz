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

const SOLANA_ENFORCED_OPTIONS: OAppEnforcedOption[] = [
    {
        msgType: 1,
        optionType: ExecutorOptionType.LZ_RECEIVE,
        gas: 200_000,
        value: 2_500_000,
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

    const contracts = [{ contract: arbitrumContract }, { contract: avalancheContract }, { contract: solanaContract }]

    return {
        contracts,
        connections,
    }
}
