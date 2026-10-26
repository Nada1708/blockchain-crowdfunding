import { type BrowserProvider, parseEther } from 'ethers'
import { CHAIN_IDS } from '../config/contracts'
import { getWriteContract } from './blockchain'

export const MINIMUM_CONTRIBUTION_ETH = '0.01'

export type ContributionResult = {
  transactionHash: string
  amount: bigint
  cfdMinted: bigint
}

export function parseContributionAmount(value: string) {
  try {
    const amount = parseEther(value)
    return amount >= parseEther(MINIMUM_CONTRIBUTION_ETH) ? amount : null
  } catch {
    return null
  }
}

export async function contributeToCampaign(
  provider: BrowserProvider,
  campaignId: number,
  amountInput: string,
  onSubmitted: (hash: string) => void,
): Promise<ContributionResult> {
  const amount = parseContributionAmount(amountInput)
  if (amount === null) throw new Error('INVALID_CONTRIBUTION_AMOUNT')

  const crowdfunding = await getWriteContract(
    'Crowdfunding',
    provider,
    CHAIN_IDS.hardhat,
  )
  const contractMinimum = BigInt(await crowdfunding.MIN_CONTRIBUTION())
  if (amount < contractMinimum) throw new Error('INVALID_CONTRIBUTION_AMOUNT')

  const transaction = await crowdfunding.contribute(campaignId, {
    value: amount,
  })
  onSubmitted(transaction.hash)

  const receipt = await transaction.wait()
  if (!receipt) throw new Error('TRANSACTION_NOT_CONFIRMED')

  for (const log of receipt.logs) {
    try {
      const parsed = crowdfunding.interface.parseLog(log)
      if (
        parsed?.name === 'ContributionReceived' &&
        BigInt(parsed.args.getValue('id')) === BigInt(campaignId)
      ) {
        return {
          transactionHash: receipt.hash,
          amount: BigInt(parsed.args.getValue('amount')),
          cfdMinted: BigInt(parsed.args.getValue('cfdMinted')),
        }
      }
    } catch {
      // Ignore logs emitted by other contracts in the same transaction.
    }
  }

  throw new Error('CONTRIBUTION_EVENT_MISSING')
}
