import { getAddress, type BrowserProvider } from 'ethers'
import { CHAIN_IDS } from '../config/contracts'
import { getReadContract, getWriteContract } from './blockchain'

export type CampaignCancellationEligibility = {
  creator: string
  isCreator: boolean
  cancelled: boolean
  frozen: boolean
  withdrawn: bigint
  status: number
  canCancel: boolean
}

export async function readCampaignCancellationEligibility(
  provider: BrowserProvider,
  account: string,
  campaignId: number,
): Promise<CampaignCancellationEligibility> {
  const crowdfunding = await getReadContract('Crowdfunding', provider)
  const [campaign, status] = await Promise.all([
    crowdfunding.getCampaign(campaignId),
    crowdfunding.status(campaignId),
  ])
  const creator = String(campaign.creator)
  const isCreator = getAddress(creator) === getAddress(account)
  const cancelled = Boolean(campaign.cancelled)
  const withdrawn = BigInt(campaign.withdrawn)

  return {
    creator,
    isCreator,
    cancelled,
    frozen: Boolean(campaign.frozen),
    withdrawn,
    status: Number(status),
    canCancel: isCreator && !cancelled && withdrawn === 0n,
  }
}

export async function cancelCampaign(
  provider: BrowserProvider,
  account: string,
  campaignId: number,
  onSubmitted: (hash: string) => void,
) {
  const eligibility = await readCampaignCancellationEligibility(provider, account, campaignId)
  if (!eligibility.isCreator) throw new Error('NOT_CREATOR')
  if (eligibility.cancelled) throw new Error('ALREADY_CANCELLED')
  if (eligibility.withdrawn > 0n) throw new Error('ALREADY_WITHDRAWN')

  const crowdfunding = await getWriteContract('Crowdfunding', provider, CHAIN_IDS.hardhat)
  const transaction = await crowdfunding.cancelCampaign(campaignId)
  onSubmitted(transaction.hash)
  const receipt = await transaction.wait()
  if (!receipt) throw new Error('TRANSACTION_NOT_CONFIRMED')

  for (const log of receipt.logs) {
    try {
      const parsed = crowdfunding.interface.parseLog(log)
      if (parsed?.name === 'CampaignCancelled' && BigInt(parsed.args.getValue('id')) === BigInt(campaignId)) {
        return { transactionHash: receipt.hash, campaignId: BigInt(parsed.args.getValue('id')) }
      }
    } catch {
      // Ignore receipt logs emitted by other contracts.
    }
  }

  throw new Error('CAMPAIGN_CANCELLED_EVENT_MISSING')
}
