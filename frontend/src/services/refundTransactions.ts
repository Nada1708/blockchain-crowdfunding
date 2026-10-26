import type { BrowserProvider } from 'ethers'
import { CHAIN_IDS } from '../config/contracts'
import { getReadContract, getWriteContract } from './blockchain'

export type RefundEligibility = {
  contribution: bigint
  refundableEth: bigint
  cfdToBurn: bigint
  cfdBalance: bigint
  status: number
  frozen: boolean
  cancelled: boolean
  failed: boolean
  paused: boolean
  contractRefundable: boolean
  hasEnoughCfd: boolean
  canRefund: boolean
}

export async function readRefundEligibility(
  provider: BrowserProvider,
  account: string,
  campaignId: number,
): Promise<RefundEligibility> {
  const [crowdfunding, token] = await Promise.all([
    getReadContract('Crowdfunding', provider),
    getReadContract('CFDToken', provider),
  ])
  const [campaign, contribution, status, rate, paused, cfdBalance, block] = await Promise.all([
    crowdfunding.getCampaign(campaignId),
    crowdfunding.contributions(campaignId, account),
    crowdfunding.status(campaignId),
    crowdfunding.RATE(),
    crowdfunding.paused(),
    token.balanceOf(account),
    provider.getBlock('latest'),
  ])
  if (!block) throw new Error('LATEST_BLOCK_UNAVAILABLE')

  const paid = BigInt(contribution)
  const raised = BigInt(campaign.raised)
  const withdrawn = BigInt(campaign.withdrawn)
  const failed = BigInt(block.timestamp) >= BigInt(campaign.deadline) && raised < BigInt(campaign.goal)
  const frozen = Boolean(campaign.frozen)
  const cancelled = Boolean(campaign.cancelled)
  const contractRefundable = frozen || cancelled || failed
  const cfdToBurn = paid * BigInt(rate)
  const tokenBalance = BigInt(cfdBalance)
  const refundableEth = paid > 0n && raised > 0n
    ? (paid * (raised - withdrawn)) / raised
    : 0n
  const hasEnoughCfd = tokenBalance >= cfdToBurn

  return {
    contribution: paid,
    refundableEth,
    cfdToBurn,
    cfdBalance: tokenBalance,
    status: Number(status),
    frozen,
    cancelled,
    failed,
    paused: Boolean(paused),
    contractRefundable,
    hasEnoughCfd,
    canRefund: contractRefundable && paid > 0n && hasEnoughCfd && !paused,
  }
}

export type RefundResult = {
  transactionHash: string
  amount: bigint
  cfdBurned: bigint
}

export async function refundCampaignContribution(
  provider: BrowserProvider,
  account: string,
  campaignId: number,
  onSubmitted: (hash: string) => void,
): Promise<RefundResult> {
  const eligibility = await readRefundEligibility(provider, account, campaignId)
  if (!eligibility.contractRefundable) throw new Error('NOT_REFUNDABLE')
  if (eligibility.contribution === 0n) throw new Error('NOTHING_TO_REFUND')
  if (eligibility.paused) throw new Error('CONTRACT_PAUSED')
  if (!eligibility.hasEnoughCfd) throw new Error('INSUFFICIENT_CFD')

  const crowdfunding = await getWriteContract('Crowdfunding', provider, CHAIN_IDS.hardhat)
  const transaction = await crowdfunding.refund(campaignId)
  onSubmitted(transaction.hash)
  const receipt = await transaction.wait()
  if (!receipt) throw new Error('TRANSACTION_NOT_CONFIRMED')

  for (const log of receipt.logs) {
    try {
      const parsed = crowdfunding.interface.parseLog(log)
      if (
        parsed?.name === 'RefundIssued' &&
        BigInt(parsed.args.getValue('id')) === BigInt(campaignId) &&
        String(parsed.args.getValue('contributor')).toLowerCase() === account.toLowerCase()
      ) {
        return {
          transactionHash: receipt.hash,
          amount: BigInt(parsed.args.getValue('amount')),
          cfdBurned: BigInt(parsed.args.getValue('cfdBurned')),
        }
      }
    } catch {
      // Ignore receipt logs emitted by other contracts.
    }
  }

  throw new Error('REFUND_ISSUED_EVENT_MISSING')
}
