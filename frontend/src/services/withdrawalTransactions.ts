import { getAddress, type BrowserProvider } from 'ethers'
import { CHAIN_IDS } from '../config/contracts'
import { getReadContract, getWriteContract } from './blockchain'

export type WithdrawalEligibility = {
  beneficiary: string
  isBeneficiary: boolean
  approved: bigint
  withdrawn: bigint
  authorizedRemaining: bigint
  availableFunds?: bigint
  contractBalance: bigint
  frozen: boolean
  cancelled: boolean
  paused: boolean
  status: number
  financialsVerified: boolean
  canWithdraw: boolean
}

export async function readWithdrawalEligibility(
  provider: BrowserProvider,
  account: string,
  campaignId: number,
): Promise<WithdrawalEligibility> {
  const crowdfunding = await getReadContract('Crowdfunding', provider)
  const [campaign, status, paused, contractBalance] = await Promise.all([
    crowdfunding.getCampaign(campaignId),
    crowdfunding.status(campaignId),
    crowdfunding.paused(),
    provider.getBalance(await crowdfunding.getAddress()),
  ])
  const approved = BigInt(campaign.approved)
  const withdrawn = BigInt(campaign.withdrawn)
  const authorizedRemaining = approved - withdrawn
  const beneficiary = String(campaign.beneficiary)
  const isBeneficiary = getAddress(beneficiary) === getAddress(account)
  let availableFunds: bigint | undefined
  let financialsVerified = false

  try {
    const refundEvents = await crowdfunding.queryFilter(
      crowdfunding.filters.RefundIssued(campaignId),
      0,
      'latest',
    )
    const refunded = refundEvents.reduce((total, event) => {
      const parsed = crowdfunding.interface.parseLog(event)
      return parsed?.name === 'RefundIssued'
        ? total + BigInt(parsed.args.getValue('amount'))
        : total
    }, 0n)
    const remaining = BigInt(campaign.raised) - withdrawn - refunded
    if (remaining >= 0n) {
      availableFunds = remaining
      financialsVerified = true
    }
  } catch {
    // Without complete refund logs, per-campaign available funds are unknown.
  }

  const frozen = Boolean(campaign.frozen)
  const cancelled = Boolean(campaign.cancelled)
  const isPaused = Boolean(paused)
  const hasLiquidity = availableFunds !== undefined &&
    availableFunds >= authorizedRemaining &&
    BigInt(contractBalance) >= authorizedRemaining

  return {
    beneficiary,
    isBeneficiary,
    approved,
    withdrawn,
    authorizedRemaining,
    availableFunds,
    contractBalance: BigInt(contractBalance),
    frozen,
    cancelled,
    paused: isPaused,
    status: Number(status),
    financialsVerified,
    canWithdraw: isBeneficiary && !frozen && !cancelled && !isPaused && authorizedRemaining > 0n && hasLiquidity,
  }
}

export async function withdrawCampaignFunds(
  provider: BrowserProvider,
  account: string,
  campaignId: number,
  onSubmitted: (hash: string) => void,
) {
  const eligibility = await readWithdrawalEligibility(provider, account, campaignId)
  if (!eligibility.isBeneficiary) throw new Error('NOT_BENEFICIARY')
  if (eligibility.frozen) throw new Error('CAMPAIGN_FROZEN')
  if (eligibility.cancelled) throw new Error('CAMPAIGN_CANCELLED')
  if (eligibility.paused) throw new Error('CONTRACT_PAUSED')
  if (eligibility.authorizedRemaining === 0n) throw new Error('NOTHING_TO_WITHDRAW')
  if (!eligibility.financialsVerified || eligibility.availableFunds === undefined || eligibility.availableFunds < eligibility.authorizedRemaining || eligibility.contractBalance < eligibility.authorizedRemaining) {
    throw new Error('INSUFFICIENT_AVAILABLE_FUNDS')
  }

  const crowdfunding = await getWriteContract('Crowdfunding', provider, CHAIN_IDS.hardhat)
  const transaction = await crowdfunding.withdrawFunds(campaignId)
  onSubmitted(transaction.hash)
  const receipt = await transaction.wait()
  if (!receipt) throw new Error('TRANSACTION_NOT_CONFIRMED')

  for (const log of receipt.logs) {
    try {
      const parsed = crowdfunding.interface.parseLog(log)
      if (
        parsed?.name === 'WithdrawalExecuted' &&
        BigInt(parsed.args.getValue('id')) === BigInt(campaignId) &&
        String(parsed.args.getValue('beneficiary')).toLowerCase() === account.toLowerCase()
      ) {
        return {
          transactionHash: receipt.hash,
          amount: BigInt(parsed.args.getValue('amount')),
        }
      }
    } catch {
      // Ignore receipt logs emitted by other contracts.
    }
  }

  throw new Error('WITHDRAWAL_EXECUTED_EVENT_MISSING')
}
