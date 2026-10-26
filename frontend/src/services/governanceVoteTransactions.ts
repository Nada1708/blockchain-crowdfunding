import type { BrowserProvider } from 'ethers'
import { CHAIN_IDS } from '../config/contracts'
import { getReadContract, getWriteContract } from './blockchain'

export type VoteEligibility = {
  active: boolean
  hasVoted: boolean
  votingPower: bigint
  snapshot: bigint
  voteEnd: bigint
}

export async function readVoteEligibility(
  provider: BrowserProvider,
  account: string,
  proposalId: number,
): Promise<VoteEligibility> {
  const [governance, token] = await Promise.all([
    getReadContract('CFDGovernance', provider),
    getReadContract('CFDToken', provider),
  ])
  const [proposal, state, hasVoted] = await Promise.all([
    governance.proposals(proposalId),
    governance.state(proposalId),
    governance.hasVoted(proposalId, account),
  ])
  const snapshot = BigInt(proposal.snapshot)
  const votingPower = BigInt(await token.getPastVotes(account, snapshot))

  return {
    active: Number(state) === 0,
    hasVoted: Boolean(hasVoted),
    votingPower,
    snapshot,
    voteEnd: BigInt(proposal.voteEnd),
  }
}

export type VoteResult = {
  transactionHash: string
  weight: bigint
}

export async function castGovernanceVote(
  provider: BrowserProvider,
  account: string,
  proposalId: number,
  support: boolean,
  onSubmitted: (hash: string) => void,
): Promise<VoteResult> {
  const eligibility = await readVoteEligibility(provider, account, proposalId)
  if (!eligibility.active) throw new Error('VOTING_CLOSED')
  if (eligibility.hasVoted) throw new Error('ALREADY_VOTED')
  if (eligibility.votingPower === 0n) throw new Error('NO_VOTING_POWER')

  const governance = await getWriteContract(
    'CFDGovernance',
    provider,
    CHAIN_IDS.hardhat,
  )
  const transaction = await governance.castVote(proposalId, support)
  onSubmitted(transaction.hash)
  const receipt = await transaction.wait()
  if (!receipt) throw new Error('TRANSACTION_NOT_CONFIRMED')

  for (const log of receipt.logs) {
    try {
      const parsed = governance.interface.parseLog(log)
      if (
        parsed?.name === 'VoteCast' &&
        BigInt(parsed.args.getValue('id')) === BigInt(proposalId) &&
        String(parsed.args.getValue('voter')).toLowerCase() === account.toLowerCase() &&
        Boolean(parsed.args.getValue('support')) === support
      ) {
        return {
          transactionHash: receipt.hash,
          weight: BigInt(parsed.args.getValue('weight')),
        }
      }
    } catch {
      // Ignore receipt logs emitted by other contracts.
    }
  }

  throw new Error('VOTE_CAST_EVENT_MISSING')
}
