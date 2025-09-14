import assert from 'assert'

import { BigNumber, ethers } from 'ethers'
import { type DeployFunction } from 'hardhat-deploy/types'

import { OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat'

import layerzeroConfigFunction from '../layerzero.config'

const contractName = 'GMX_Adapter'

const deploy: DeployFunction = async (hre) => {
    const { getNamedAccounts, deployments } = hre

    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()

    assert(deployer, 'Missing named deployer account')

    console.log(`Network: ${hre.network.name}`)
    console.log(`Deployer: ${deployer}`)

    const currentEid = hre.network.config.eid

    const minterBurnerAddress = hre.network.config.oftAdapter?.tokenAddress

    // Get all destination endpoints from the layerzero config
    const layerzeroConfig = await layerzeroConfigFunction()

    // Extract all unique endpoint IDs from the contracts
    const allDstEnds = layerzeroConfig.contracts
        .map((contractInfo: { contract: OmniPointHardhat }) => contractInfo.contract.eid)
        .filter((eid: number, index: number, self: number[]) => self.indexOf(eid) === index) // Remove duplicates

    console.log('allDstEnds', allDstEnds)

    // Get decimals using a low-level call to avoid needing ERC20 artifact
    const decimalsCall = await hre.ethers.provider.call({
        to: minterBurnerAddress,
        data: '0x313ce567', // decimals() function selector
    })
    const decimals = parseInt(decimalsCall, 16) // convert hex to decimal

    const rateLimitConfigs: RateLimitConfig[] = allDstEnds
        .filter((eid) => eid !== currentEid)
        .map((eid) => ({
            dstEid: eid,
            limit: BigNumber.from(ethers.utils.parseUnits('10000', decimals)), // 10k GMX
            window: BigNumber.from(4 * 60 * 60), // 4 hours in seconds
        }))

    if (!minterBurnerAddress) {
        throw new Error(
            `oftAdapter.tokenAddress not configured on hardhat network config, skipping GMX_Adapter deployment`
        )
    }

    const endpointV2Deployment = await hre.deployments.get('EndpointV2')
    const { address } = await deploy(contractName, {
        from: deployer,
        args: [
            rateLimitConfigs,
            minterBurnerAddress, // token address
            minterBurnerAddress, // token address implementing IMintableBurnable
            endpointV2Deployment.address, // LayerZero's EndpointV2 address
            deployer, // owner
        ],
        log: true,
        skipIfAlreadyDeployed: true,
    })

    console.log(`Deployed contract: ${contractName}, network: ${hre.network.name}, address: ${address}`)
}

type RateLimitConfig = {
    dstEid: number
    limit: BigNumber
    window: BigNumber
}

deploy.tags = [contractName]

export default deploy
