import { type BrowserProvider, ZeroAddress, getAddress, parseEther } from 'ethers'
import { CHAIN_IDS } from '../config/contracts'
import { getReadContract, getWriteContract } from './blockchain'

export type ProposalKind = 'Freeze' | 'EarlyRelease'

export type ProposalEligibility = {
  active: boolean
  beneficiary: string
  currentVotingPower: bigint
  historicalVotingPower: bigint
  historicalSnapshot: bigint
  threshold: bigint
  isBeneficiary: boolean
}

export function parseEarlyReleaseAmount(value: string) {
  try {
    const amount = parseEther(value)
    return amount > 0n ? amount : null
  } catch {
    return null
  }
}

export async function readProposalEligibility(
  provider: BrowserProvider,
  account: string,
  campaignId: number,
): Promise<ProposalEligibility> {
  const [token, crowdfunding, governance] = await Promise.all([
    getReadContract('CFDToken', provider),
    getReadContract('Crowdfunding', provider),
    getReadContract('CFDGovernance', provider),
  ])
  const [active, beneficiary, clock, threshold, currentVotingPower] = await Promise.all([
    crowdfunding.isActive(campaignId),
    crowdfunding.beneficiaryOf(campaignId),
    token.clock(),
    governance.PROPOSAL_THRESHOLD(),
    token.getVotes(account),
  ])
  const historicalSnapshot = BigInt(clock) - 1n
  const historicalVotingPower = historicalSnapshot >= 0n
    ? BigInt(await token.getPastVotes(account, historicalSnapshot))
    : 0n

  return {
    active: Boolean(active),
    beneficiary: String(beneficiary),
    currentVotingPower: BigInt(currentVotingPower),
    historicalVotingPower,
    historicalSnapshot,
    threshold: BigInt(threshold),
    isBeneficiary:
      String(beneficiary) !== ZeroAddress &&
      getAddress(String(beneficiary)) === getAddress(account),
  }
}

export type ProposalCreationResult = {
  proposalId: bigint
  transactionHash: string
}

export async function createGovernanceProposal(
  provider: BrowserProvider,
  account: string,
  kind: ProposalKind,
  campaignId: number,
  amountInput: string,
  onSubmitted: (hash: string) => void,
): Promise<ProposalCreationResult> {
  const eligibility = await readProposalEligibility(provider, account, campaignId)
  if (!eligibility.active) throw new Error('CAMPAIGN_NOT_ACTIVE')

  let amount = 0n
  if (kind === 'Freeze') {
    if (eligibility.currentVotingPower < eligibility.threshold) {
      throw new Error('BELOW_PROPOSAL_THRESHOLD')
    }
  } else {
    if (!eligibility.isBeneficiary) throw new Error('NOT_BENEFICIARY')
    const parsedAmount = parseEarlyReleaseAmount(amountInput)
    if (parsedAmount === null) throw new Error('INVALID_AMOUNT')
    amount = parsedAmount
  }

  const governance = await getWriteContract(
    'CFDGovernance',
    provider,
    CHAIN_IDS.hardhat,
  )
  const transaction = await governance.propose(
    kind === 'Freeze' ? 0 : 1,
    campaignId,
    amount,
  )
  onSubmitted(transaction.hash)
  const receipt = await transaction.wait()
  if (!receipt) throw new Error('TRANSACTION_NOT_CONFIRMED')

  for (const log of receipt.logs) {
    try {
      const parsed = governance.interface.parseLog(log)
      if (
        parsed?.name === 'ProposalCreated' &&
        BigInt(parsed.args.getValue('campaignId')) === BigInt(campaignId)
      ) {
        return {
          proposalId: BigInt(parsed.args.getValue('id')),
          transactionHash: receipt.hash,
        }
      }
    } catch {
      // Ignore logs that do not belong to CFDGovernance.
    }
  }

  throw new Error('PROPOSAL_CREATED_EVENT_MISSING')
}
