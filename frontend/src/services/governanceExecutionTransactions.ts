import type { BrowserProvider } from 'ethers'
import { CHAIN_IDS } from '../config/contracts'
import { getReadContract, getWriteContract } from './blockchain'

export type ProposalExecutionResult = {
  transactionHash: string
  proposalId: bigint
}

export async function executeGovernanceProposal(
  provider: BrowserProvider,
  proposalId: number,
  onSubmitted: (hash: string) => void,
): Promise<ProposalExecutionResult> {
  const governanceRead = await getReadContract('CFDGovernance', provider)
  const state = Number(await governanceRead.state(proposalId))
  if (state !== 2) throw new Error('PROPOSAL_NOT_SUCCEEDED')

  const governance = await getWriteContract('CFDGovernance', provider, CHAIN_IDS.hardhat)
  const transaction = await governance.execute(proposalId)
  onSubmitted(transaction.hash)
  const receipt = await transaction.wait()
  if (!receipt) throw new Error('TRANSACTION_NOT_CONFIRMED')

  for (const log of receipt.logs) {
    try {
      const parsed = governance.interface.parseLog(log)
      if (parsed?.name === 'ProposalExecuted' && BigInt(parsed.args.getValue('id')) === BigInt(proposalId)) {
        return { transactionHash: receipt.hash, proposalId: BigInt(parsed.args.getValue('id')) }
      }
    } catch {
      // Ignore receipt logs emitted by other contracts.
    }
  }

  throw new Error('PROPOSAL_EXECUTED_EVENT_MISSING')
}
