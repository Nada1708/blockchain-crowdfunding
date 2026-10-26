import { type BrowserProvider, parseEther } from 'ethers'
import { CHAIN_IDS } from '../config/contracts'
import { getWriteContract } from './blockchain'

export type CreateCampaignInput = {
  beneficiary: string
  goalEth: string
  durationDays: number
  metadataCid: string
}

export type CreateCampaignResult = {
  campaignId: bigint
  transactionHash: string
}

export function isValidIpfsCid(value: string) {
  return (
    /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(value) ||
    /^b[a-z2-7]{20,}$/i.test(value)
  )
}

export async function createCampaignOnChain(
  provider: BrowserProvider,
  input: CreateCampaignInput,
  onSubmitted: (hash: string) => void,
): Promise<CreateCampaignResult> {
  if (!isValidIpfsCid(input.metadataCid)) {
    throw new Error('INVALID_IPFS_CID')
  }

  const crowdfunding = await getWriteContract(
    'Crowdfunding',
    provider,
    CHAIN_IDS.hardhat,
  )
  const durationSeconds = BigInt(input.durationDays) * 24n * 60n * 60n
  const transaction = await crowdfunding.createCampaign(
    input.beneficiary,
    parseEther(input.goalEth),
    durationSeconds,
    `ipfs://${input.metadataCid}`,
  )
  onSubmitted(transaction.hash)

  const receipt = await transaction.wait()
  if (!receipt) throw new Error('TRANSACTION_NOT_CONFIRMED')

  for (const log of receipt.logs) {
    try {
      const parsed = crowdfunding.interface.parseLog(log)
      if (parsed?.name === 'CampaignCreated') {
        const campaignId = parsed.args.getValue('id')
        return {
          campaignId: BigInt(campaignId),
          transactionHash: receipt.hash,
        }
      }
    } catch {
      // The receipt may include logs from other contracts; only ABI matches matter.
    }
  }

  throw new Error('CAMPAIGN_CREATED_EVENT_MISSING')
}
