import { formatEther } from 'ethers'
import { getHardhatReadProvider, getReadContract } from './blockchain'

export type OnChainCampaignStatus =
  | 'Active'
  | 'Successful'
  | 'Failed'
  | 'Cancelled'

export type CampaignMetadata = {
  title?: string
  description?: string
  imageUrl?: string
}

export type OnChainCampaign = {
  id: number
  cid: string
  beneficiary: string
  deadline: number
  frozen: boolean
  goalEth: string
  raisedEth: string
  approvedEth: string
  refundedEth?: string
  withdrawnEth: string
  availableFundsEth?: string
  financialsVerified: boolean
  status: OnChainCampaignStatus
  metadata?: CampaignMetadata
  metadataUnavailable: boolean
}

export type OnChainProposalState =
  | 'Active'
  | 'Defeated'
  | 'Succeeded'
  | 'Executed'

export type OnChainProposal = {
  id: number
  type: 'Freeze' | 'EarlyRelease'
  campaignId: number
  amountEth: string
  proposer: string
  snapshot: number
  voteEnd: number
  forVotes: bigint
  againstVotes: bigint
  quorum: bigint
  state: OnChainProposalState
}

const campaignStatuses: OnChainCampaignStatus[] = [
  'Active',
  'Successful',
  'Failed',
  'Cancelled',
]
const proposalStates: OnChainProposalState[] = [
  'Active',
  'Defeated',
  'Succeeded',
  'Executed',
]
const ipfsGateway = (
  import.meta.env.VITE_IPFS_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs'
).replace(/\/$/, '')

function ipfsUrl(value: string) {
  const path = value.startsWith('ipfs://') ? value.slice(7) : value
  return `${ipfsGateway}/${path}`
}

async function readMetadata(cid: string): Promise<CampaignMetadata | undefined> {
  if (!cid) return undefined

  const response = await fetch(ipfsUrl(cid))
  if (!response.ok) throw new Error(`IPFS gateway returned ${response.status}`)
  const data = (await response.json()) as Record<string, unknown>
  const title = typeof data.title === 'string' ? data.title : undefined
  const description =
    typeof data.description === 'string' ? data.description : undefined
  const imageValue =
    typeof data.imageCid === 'string'
      ? data.imageCid
      : typeof data.image === 'string'
        ? data.image
        : undefined

  return {
    title,
    description,
    imageUrl: imageValue ? ipfsUrl(imageValue) : undefined,
  }
}

export async function readOnChainCampaigns(): Promise<OnChainCampaign[]> {
  const contract = await getReadContract(
    'Crowdfunding',
    getHardhatReadProvider(),
  )
  const count = Number(await contract.campaignCount())
  const refundTotals = new Map<number, bigint>()
  const withdrawalTotals = new Map<number, bigint>()
  let eventHistoryAvailable = true

  try {
    const [refundEvents, withdrawalEvents] = await Promise.all([
      contract.queryFilter(contract.filters.RefundIssued(), 0, 'latest'),
      contract.queryFilter(contract.filters.WithdrawalExecuted(), 0, 'latest'),
    ])
    for (const event of refundEvents) {
      const parsed = contract.interface.parseLog(event)
      if (parsed?.name !== 'RefundIssued') continue
      const id = Number(parsed.args.getValue('id'))
      refundTotals.set(id, (refundTotals.get(id) ?? 0n) + BigInt(parsed.args.getValue('amount')))
    }
    for (const event of withdrawalEvents) {
      const parsed = contract.interface.parseLog(event)
      if (parsed?.name !== 'WithdrawalExecuted') continue
      const id = Number(parsed.args.getValue('id'))
      withdrawalTotals.set(id, (withdrawalTotals.get(id) ?? 0n) + BigInt(parsed.args.getValue('amount')))
    }
  } catch {
    eventHistoryAvailable = false
  }

  return Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const id = index + 1
      const [campaign, statusValue] = await Promise.all([
        contract.getCampaign(id),
        contract.status(id),
      ])
      const cid = String(campaign.cid)
      const raised = BigInt(campaign.raised)
      const withdrawn = BigInt(campaign.withdrawn)
      const refunded = refundTotals.get(id) ?? 0n
      const withdrawalsMatch = (withdrawalTotals.get(id) ?? 0n) === withdrawn
      const remaining = raised - withdrawn - refunded
      const financialsVerified = eventHistoryAvailable && withdrawalsMatch && remaining >= 0n
      let metadata: CampaignMetadata | undefined
      let metadataUnavailable = false

      if (cid) {
        try {
          metadata = await readMetadata(cid)
        } catch {
          metadataUnavailable = true
        }
      }

      return {
        id,
        cid,
        beneficiary: String(campaign.beneficiary),
        deadline: Number(campaign.deadline),
        frozen: Boolean(campaign.frozen),
        goalEth: formatEther(campaign.goal),
        raisedEth: formatEther(raised),
        approvedEth: formatEther(campaign.approved),
        refundedEth: financialsVerified ? formatEther(refunded) : undefined,
        withdrawnEth: formatEther(withdrawn),
        availableFundsEth: financialsVerified ? formatEther(remaining) : undefined,
        financialsVerified,
        status: campaignStatuses[Number(statusValue)] ?? 'Failed',
        metadata,
        metadataUnavailable,
      }
    }),
  )
}

export async function readOnChainProposals(): Promise<OnChainProposal[]> {
  const contract = await getReadContract(
    'CFDGovernance',
    getHardhatReadProvider(),
  )
  const count = Number(await contract.proposalCount())

  return Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const id = index + 1
      const [proposal, stateValue, quorum] = await Promise.all([
        contract.proposals(id),
        contract.state(id),
        contract.quorum(id),
      ])

      return {
        id,
        type: Number(proposal.pType) === 0 ? 'Freeze' : 'EarlyRelease',
        campaignId: Number(proposal.campaignId),
        amountEth: formatEther(proposal.amount),
        proposer: String(proposal.proposer),
        snapshot: Number(proposal.snapshot),
        voteEnd: Number(proposal.voteEnd),
        forVotes: BigInt(proposal.forVotes),
        againstVotes: BigInt(proposal.againstVotes),
        quorum: BigInt(quorum),
        state: proposalStates[Number(stateValue)] ?? 'Defeated',
      }
    }),
  )
}
