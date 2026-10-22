import { ZeroAddress, isAddress } from 'ethers'

export const CHAIN_IDS = {
  hardhat: 31337,
  sepolia: 11155111,
} as const

export type SupportedChainId = (typeof CHAIN_IDS)[keyof typeof CHAIN_IDS]
export type FundoraContractName =
  | 'CFDToken'
  | 'Crowdfunding'
  | 'CFDGovernance'

type ContractAddresses = Record<FundoraContractName, string | undefined>

export const NETWORK_NAMES: Record<SupportedChainId, string> = {
  [CHAIN_IDS.hardhat]: 'Hardhat Local',
  [CHAIN_IDS.sepolia]: 'Sepolia',
}

function optionalAddress(value: string | undefined, variableName: string) {
  const address = value?.trim()

  if (!address) return undefined

  if (!isAddress(address) || address === ZeroAddress) {
    throw new Error(
      `${variableName} must contain a valid, non-zero Ethereum contract address.`,
    )
  }

  return address
}

export const CONTRACT_ADDRESSES: Record<SupportedChainId, ContractAddresses> = {
  [CHAIN_IDS.hardhat]: {
    CFDToken: optionalAddress(
      import.meta.env.VITE_HARDHAT_CFD_TOKEN_ADDRESS,
      'VITE_HARDHAT_CFD_TOKEN_ADDRESS',
    ),
    Crowdfunding: optionalAddress(
      import.meta.env.VITE_HARDHAT_CROWDFUNDING_ADDRESS,
      'VITE_HARDHAT_CROWDFUNDING_ADDRESS',
    ),
    CFDGovernance: optionalAddress(
      import.meta.env.VITE_HARDHAT_CFD_GOVERNANCE_ADDRESS,
      'VITE_HARDHAT_CFD_GOVERNANCE_ADDRESS',
    ),
  },
  [CHAIN_IDS.sepolia]: {
    CFDToken: optionalAddress(
      import.meta.env.VITE_SEPOLIA_CFD_TOKEN_ADDRESS,
      'VITE_SEPOLIA_CFD_TOKEN_ADDRESS',
    ),
    Crowdfunding: optionalAddress(
      import.meta.env.VITE_SEPOLIA_CROWDFUNDING_ADDRESS,
      'VITE_SEPOLIA_CROWDFUNDING_ADDRESS',
    ),
    CFDGovernance: optionalAddress(
      import.meta.env.VITE_SEPOLIA_CFD_GOVERNANCE_ADDRESS,
      'VITE_SEPOLIA_CFD_GOVERNANCE_ADDRESS',
    ),
  },
}

export function isSupportedChainId(chainId: number): chainId is SupportedChainId {
  return chainId === CHAIN_IDS.hardhat || chainId === CHAIN_IDS.sepolia
}

export function getContractAddress(
  chainId: SupportedChainId,
  contractName: FundoraContractName,
) {
  return CONTRACT_ADDRESSES[chainId][contractName]
}
