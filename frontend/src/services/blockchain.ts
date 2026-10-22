import {
  BrowserProvider,
  Contract,
  type Eip1193Provider,
  type Provider,
  type Signer,
} from 'ethers'
import { CONTRACT_ABIS } from '../abi'
import {
  NETWORK_NAMES,
  getContractAddress,
  isSupportedChainId,
  type FundoraContractName,
  type SupportedChainId,
} from '../config/contracts'

export class BlockchainConfigurationError extends Error {
  override name = 'BlockchainConfigurationError'
}

export class UnsupportedNetworkError extends Error {
  override name = 'UnsupportedNetworkError'
}

export class WrongNetworkError extends Error {
  override name = 'WrongNetworkError'
}

function requireSupportedChain(chainId: bigint): SupportedChainId {
  const numericChainId = Number(chainId)

  if (!Number.isSafeInteger(numericChainId) || !isSupportedChainId(numericChainId)) {
    throw new UnsupportedNetworkError(
      `Unsupported network (chain ID ${chainId.toString()}). Use Hardhat Local (31337) or Sepolia (11155111).`,
    )
  }

  return numericChainId
}

function requireContractConfiguration(
  contractName: FundoraContractName,
  chainId: SupportedChainId,
) {
  const address = getContractAddress(chainId, contractName)
  const abi = CONTRACT_ABIS[contractName]

  if (!address) {
    throw new BlockchainConfigurationError(
      `${contractName} has no configured address for ${NETWORK_NAMES[chainId]} (chain ID ${chainId}).`,
    )
  }

  if (!abi) {
    throw new BlockchainConfigurationError(
      `${contractName} has no generated Hardhat ABI available in src/abi.`,
    )
  }

  return { abi, address }
}

export function createMetaMaskProvider(provider: Eip1193Provider) {
  return new BrowserProvider(provider)
}

export async function getReadContract(
  contractName: FundoraContractName,
  provider: Provider,
): Promise<Contract> {
  const network = await provider.getNetwork()
  const chainId = requireSupportedChain(network.chainId)
  const { abi, address } = requireContractConfiguration(contractName, chainId)

  return new Contract(address, abi, provider)
}

export async function assertWriteNetwork(
  provider: Provider,
  expectedChainId: SupportedChainId,
) {
  const network = await provider.getNetwork()
  const activeChainId = requireSupportedChain(network.chainId)

  if (activeChainId !== expectedChainId) {
    throw new WrongNetworkError(
      `Wrong network: connected to ${NETWORK_NAMES[activeChainId]} (chain ID ${activeChainId}), expected ${NETWORK_NAMES[expectedChainId]} (chain ID ${expectedChainId}).`,
    )
  }

  return activeChainId
}

export async function getWriteContract(
  contractName: FundoraContractName,
  provider: BrowserProvider,
  expectedChainId: SupportedChainId,
): Promise<Contract> {
  const chainId = await assertWriteNetwork(provider, expectedChainId)
  const signer = await provider.getSigner()
  const { abi, address } = requireContractConfiguration(contractName, chainId)

  return new Contract(address, abi, signer)
}

export async function getWriteContractWithSigner(
  contractName: FundoraContractName,
  signer: Signer,
  expectedChainId: SupportedChainId,
): Promise<Contract> {
  if (!signer.provider) {
    throw new BlockchainConfigurationError(
      'The signer is not connected to a provider, so its network cannot be verified.',
    )
  }

  const chainId = await assertWriteNetwork(signer.provider, expectedChainId)
  const { abi, address } = requireContractConfiguration(contractName, chainId)

  return new Contract(address, abi, signer)
}
