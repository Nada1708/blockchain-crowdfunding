import { BrowserProvider, formatEther, formatUnits } from 'ethers'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { CONTRACT_ABIS } from '../abi'
import { CHAIN_IDS, getContractAddress } from '../config/contracts'
import { useWallet } from '../hooks/useWallet'
import { cancelCampaign, readCampaignCancellationEligibility, type CampaignCancellationEligibility } from '../services/campaignCancellationTransactions'
import { contributeToCampaign, MINIMUM_CONTRIBUTION_ETH, parseContributionAmount } from '../services/contributionTransactions'
import type { OnChainCampaign } from '../services/onchain'
import { readRefundEligibility, refundCampaignContribution, type RefundEligibility } from '../services/refundTransactions'
import { readWithdrawalEligibility, withdrawCampaignFunds, type WithdrawalEligibility } from '../services/withdrawalTransactions'
import './CampaignCard.css'

type ContributionState = 'idle' | 'signature' | 'pending' | 'success' | 'error'
type RefundState = 'idle' | 'signature' | 'pending' | 'success' | 'error'
type CancellationState = 'idle' | 'signature' | 'pending' | 'success' | 'error'
type WithdrawalState = 'idle' | 'signature' | 'pending' | 'success' | 'error'

export default function OnChainCampaignCard({ campaign, onContributionConfirmed, refreshVersion }: { campaign: OnChainCampaign; onContributionConfirmed: () => void; refreshVersion: number }) {
  const { t } = useTranslation()
  const { address, chainId, refreshCfdBalance } = useWallet()
  const [amount, setAmount] = useState('')
  const [state, setState] = useState<ContributionState>('idle')
  const [transactionHash, setTransactionHash] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [mintedCfd, setMintedCfd] = useState('')
  const [refundResult, setRefundResult] = useState<{ key: string; value: RefundEligibility | null } | null>(null)
  const [refundState, setRefundState] = useState<RefundState>('idle')
  const [refundHash, setRefundHash] = useState('')
  const [refundError, setRefundError] = useState('')
  const [cancellationResult, setCancellationResult] = useState<{ key: string; value: CampaignCancellationEligibility | null } | null>(null)
  const [cancellationState, setCancellationState] = useState<CancellationState>('idle')
  const [cancellationHash, setCancellationHash] = useState('')
  const [cancellationError, setCancellationError] = useState('')
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [withdrawalResult, setWithdrawalResult] = useState<{ key: string; value: WithdrawalEligibility | null } | null>(null)
  const [withdrawalState, setWithdrawalState] = useState<WithdrawalState>('idle')
  const [withdrawalHash, setWithdrawalHash] = useState('')
  const [withdrawalError, setWithdrawalError] = useState('')
  const goal = Number(campaign.goalEth)
  const raised = Number(campaign.raisedEth)
  const progress = goal > 0 ? Math.min((raised / goal) * 100, 100) : 0
  const statusKey = campaign.status.toLowerCase()
  const title = campaign.metadata?.title || t('onchain.campaignFallback', { id: campaign.id })
  const isEligible = campaign.status === 'Active' && !campaign.frozen
  const isBusy = state === 'signature' || state === 'pending'
  const amountIsValid = parseContributionAmount(amount) !== null
  const contractConfigured = Boolean(getContractAddress(CHAIN_IDS.hardhat, 'Crowdfunding') && CONTRACT_ABIS.Crowdfunding)
  const canContribute = Boolean(isEligible && amountIsValid && address && chainId === CHAIN_IDS.hardhat && contractConfigured && !isBusy)
  const refundKey = `${address ?? ''}:${chainId ?? ''}:${campaign.id}:${refreshVersion}`
  const currentRefundResult = refundResult?.key === refundKey ? refundResult : undefined
  const refundEligibility = currentRefundResult?.value
  const refundBusy = refundState === 'signature' || refundState === 'pending'
  const refundVisible = refundState === 'success' || Boolean(refundEligibility?.contractRefundable && refundEligibility.contribution > 0n)
  const canRefund = Boolean(address && chainId === CHAIN_IDS.hardhat && contractConfigured && refundEligibility?.canRefund && !refundBusy)
  const cancellationKey = `${address ?? ''}:${chainId ?? ''}:${campaign.id}:${refreshVersion}`
  const currentCancellationResult = cancellationResult?.key === cancellationKey ? cancellationResult : undefined
  const cancellationEligibility = currentCancellationResult?.value
  const cancellationBusy = cancellationState === 'signature' || cancellationState === 'pending'
  const cancellationVisible = cancellationState === 'success' || Boolean(cancellationEligibility?.canCancel)
  const canCancel = Boolean(cancellationEligibility?.canCancel && contractConfigured && chainId === CHAIN_IDS.hardhat && !cancellationBusy)
  const withdrawalKey = `${address ?? ''}:${chainId ?? ''}:${campaign.id}:${refreshVersion}`
  const currentWithdrawalResult = withdrawalResult?.key === withdrawalKey ? withdrawalResult : undefined
  const withdrawalEligibility = currentWithdrawalResult?.value
  const withdrawalBusy = withdrawalState === 'signature' || withdrawalState === 'pending'
  const withdrawalVisible = withdrawalState === 'success' || Boolean(withdrawalEligibility?.isBeneficiary && withdrawalEligibility.authorizedRemaining > 0n)
  const canWithdraw = Boolean(withdrawalEligibility?.canWithdraw && contractConfigured && chainId === CHAIN_IDS.hardhat && !withdrawalBusy)

  useEffect(() => {
    if (!window.ethereum || !address || chainId !== CHAIN_IDS.hardhat) return
    let active = true
    void readRefundEligibility(new BrowserProvider(window.ethereum), address, campaign.id)
      .then((value) => { if (active) setRefundResult({ key: refundKey, value }) })
      .catch(() => { if (active) setRefundResult({ key: refundKey, value: null }) })
    return () => { active = false }
  }, [address, campaign.id, chainId, refundKey])

  useEffect(() => {
    if (!window.ethereum || !address || chainId !== CHAIN_IDS.hardhat) return
    let active = true
    void readCampaignCancellationEligibility(new BrowserProvider(window.ethereum), address, campaign.id)
      .then((value) => { if (active) setCancellationResult({ key: cancellationKey, value }) })
      .catch(() => { if (active) setCancellationResult({ key: cancellationKey, value: null }) })
    return () => { active = false }
  }, [address, campaign.id, cancellationKey, chainId])

  useEffect(() => {
    if (!window.ethereum || !address || chainId !== CHAIN_IDS.hardhat) return
    let active = true
    void readWithdrawalEligibility(new BrowserProvider(window.ethereum), address, campaign.id)
      .then((value) => { if (active) setWithdrawalResult({ key: withdrawalKey, value }) })
      .catch(() => { if (active) setWithdrawalResult({ key: withdrawalKey, value: null }) })
    return () => { active = false }
  }, [address, campaign.id, chainId, withdrawalKey])

  const submitContribution = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canContribute || !window.ethereum) return
    setState('signature')
    setErrorMessage('')
    setTransactionHash('')
    setMintedCfd('')

    try {
      const result = await contributeToCampaign(new BrowserProvider(window.ethereum), campaign.id, amount, (hash) => {
        setTransactionHash(hash)
        setState('pending')
      })
      setTransactionHash(result.transactionHash)
      setMintedCfd(formatUnits(result.cfdMinted, 18))
      setState('success')
      setAmount('')
      refreshCfdBalance()
      onContributionConfirmed()
    } catch (error) {
      const code = (error as { code?: number | string }).code
      const message = error instanceof Error ? error.message : ''
      const errorKey = code === 4001 || code === 'ACTION_REJECTED' ? 'rejected' : message.includes('Wrong network') ? 'wrongNetwork' : message === 'INVALID_CONTRIBUTION_AMOUNT' ? 'amount' : 'failed'
      setErrorMessage(t(`contribution.errors.${errorKey}`))
      setState('error')
    }
  }

  const requestRefund = async () => {
    if (!canRefund || !window.ethereum || !address) return
    setRefundState('signature')
    setRefundHash('')
    setRefundError('')
    try {
      const result = await refundCampaignContribution(new BrowserProvider(window.ethereum), address, campaign.id, (hash) => {
        setRefundHash(hash)
        setRefundState('pending')
      })
      setRefundHash(result.transactionHash)
      setRefundState('success')
      refreshCfdBalance()
      onContributionConfirmed()
    } catch (error) {
      const code = (error as { code?: number | string }).code
      const message = error instanceof Error ? error.message : ''
      const errorKey = code === 4001 || code === 'ACTION_REJECTED' ? 'rejected'
        : message.includes('Wrong network') ? 'wrongNetwork'
          : message === 'NOT_REFUNDABLE' ? 'notRefundable'
            : message === 'NOTHING_TO_REFUND' ? 'nothing'
              : message === 'CONTRACT_PAUSED' ? 'paused'
                : message === 'INSUFFICIENT_CFD' ? 'insufficientCfd' : 'failed'
      setRefundError(t(`refund.errors.${errorKey}`))
      setRefundState('error')
    }
  }

  const confirmCancellation = async () => {
    if (!canCancel || !window.ethereum || !address) return
    setCancellationState('signature')
    setCancellationHash('')
    setCancellationError('')
    try {
      const result = await cancelCampaign(new BrowserProvider(window.ethereum), address, campaign.id, (hash) => {
        setCancellationHash(hash)
        setCancellationState('pending')
      })
      setCancellationHash(result.transactionHash)
      setCancellationState('success')
      setConfirmationOpen(false)
      onContributionConfirmed()
    } catch (error) {
      const code = (error as { code?: number | string }).code
      const message = error instanceof Error ? error.message : ''
      const errorKey = code === 4001 || code === 'ACTION_REJECTED' ? 'rejected'
        : message.includes('Wrong network') ? 'wrongNetwork'
          : message === 'NOT_CREATOR' ? 'notCreator'
            : message === 'ALREADY_CANCELLED' ? 'alreadyCancelled'
              : message === 'ALREADY_WITHDRAWN' ? 'withdrawn' : 'failed'
      setCancellationError(t(`campaignCancellation.errors.${errorKey}`))
      setCancellationState('error')
    }
  }

  const withdrawFunds = async () => {
    if (!canWithdraw || !window.ethereum || !address) return
    setWithdrawalState('signature')
    setWithdrawalHash('')
    setWithdrawalError('')
    try {
      const result = await withdrawCampaignFunds(new BrowserProvider(window.ethereum), address, campaign.id, (hash) => {
        setWithdrawalHash(hash)
        setWithdrawalState('pending')
      })
      setWithdrawalHash(result.transactionHash)
      setWithdrawalState('success')
      onContributionConfirmed()
    } catch (error) {
      const code = (error as { code?: number | string }).code
      const message = error instanceof Error ? error.message : ''
      const errorKey = code === 4001 || code === 'ACTION_REJECTED' ? 'rejected'
        : message.includes('Wrong network') ? 'wrongNetwork'
          : message === 'NOT_BENEFICIARY' ? 'notBeneficiary'
            : message === 'CAMPAIGN_FROZEN' ? 'frozen'
              : message === 'CAMPAIGN_CANCELLED' ? 'cancelled'
                : message === 'CONTRACT_PAUSED' ? 'paused'
                  : message === 'NOTHING_TO_WITHDRAW' ? 'nothing'
                    : message === 'INSUFFICIENT_AVAILABLE_FUNDS' ? 'insufficientFunds' : 'failed'
      setWithdrawalError(t(`withdrawal.errors.${errorKey}`))
      setWithdrawalState('error')
    }
  }

  return (
    <article className="campaign-card onchain-campaign-card">
      {campaign.metadata?.imageUrl && <div className="campaign-card-image-wrap"><img className="campaign-card-image" src={campaign.metadata.imageUrl} alt="" loading="lazy" /></div>}
      <div className="campaign-card-content">
        <div className="campaign-card-badges onchain-card-badges"><span className="campaign-onchain-badge">{t('onchain.badge')}</span><span className={`campaign-status campaign-status-${statusKey}`}>{t(`onchain.status.${statusKey}`)}</span>{campaign.frozen && <span className="campaign-frozen-badge">{t('onchain.frozen')}</span>}</div>
        <h3>{title}</h3>
        <p>{campaign.metadata?.description || t('onchain.noDescription')}</p>
        <dl className="onchain-details"><div><dt>{t('onchain.cid')}</dt><dd>{campaign.cid || t('onchain.noCid')}</dd></div><div><dt>{t('onchain.deadline')}</dt><dd>{new Date(campaign.deadline * 1000).toLocaleString()}</dd></div></dl>
        {campaign.metadataUnavailable && <p className="onchain-metadata-warning">{t('onchain.metadataUnavailable')}</p>}
        <div className="campaign-funding"><div className="campaign-amounts"><span><strong>{campaign.raisedEth} ETH</strong> {t('campaignFinancials.totalRaised')}</span><span>{campaign.goalEth} ETH {t('card.goal')}</span></div><div className="campaign-progress" role="progressbar" aria-label={t('campaignFinancials.historicalProgressLabel', { title })} aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div><span className="campaign-percentage">{t('campaignFinancials.historicalProgress', { progress: Math.round(progress) })}</span></div>
        <dl className="campaign-financials">
          <div><dt>{t('campaignFinancials.totalRaised')}</dt><dd>{campaign.raisedEth} ETH</dd></div>
          <div><dt>{t('campaignFinancials.refunded')}</dt><dd>{campaign.refundedEth !== undefined ? `${campaign.refundedEth} ETH` : t('campaignFinancials.unavailable')}</dd></div>
          <div><dt>{t('campaignFinancials.withdrawn')}</dt><dd>{campaign.withdrawnEth} ETH</dd></div>
          <div><dt>{t('campaignFinancials.available')}</dt><dd>{campaign.availableFundsEth !== undefined ? `${campaign.availableFundsEth} ETH` : t('campaignFinancials.unavailable')}</dd></div>
        </dl>
        {!campaign.financialsVerified && <p className="onchain-metadata-warning">{t('campaignFinancials.historyUnavailable')}</p>}
        {isEligible ? (
          <form className="contribution-form" onSubmit={submitContribution} noValidate>
            <label htmlFor={`contribution-${campaign.id}`}>{t('contribution.label')}</label>
            <div className="contribution-controls"><input id={`contribution-${campaign.id}`} type="number" min={MINIMUM_CONTRIBUTION_ETH} step="any" inputMode="decimal" value={amount} onChange={(event) => { if (!isBusy) { setAmount(event.target.value); setState('idle'); setErrorMessage('') } }} placeholder={MINIMUM_CONTRIBUTION_ETH} disabled={isBusy} aria-invalid={Boolean(amount && !amountIsValid)} /><button type="submit" disabled={!canContribute}>{state === 'signature' ? t('contribution.signature') : state === 'pending' ? t('contribution.pending') : t('contribution.button')}</button></div>
            <small>{t('contribution.minimum', { amount: MINIMUM_CONTRIBUTION_ETH })}</small>
            {!address && <p className="contribution-note">{t('contribution.connect')}</p>}
            {address && chainId !== CHAIN_IDS.hardhat && <p className="contribution-note">{t('contribution.network')}</p>}
            {!contractConfigured && <p className="contribution-note">{t('contribution.contractMissing')}</p>}
            {amount && !amountIsValid && <p className="contribution-error">{t('contribution.errors.amount')}</p>}
            {errorMessage && <p className="contribution-error" role="alert">{errorMessage}</p>}
            {transactionHash && state === 'pending' && <p className="contribution-hash"><span>{t('contribution.hash')}</span><code>{transactionHash}</code></p>}
            {state === 'success' && <div className="contribution-success" role="status"><strong>{t('contribution.success')}</strong><span>{t('contribution.minted', { amount: mintedCfd })}</span><code>{transactionHash}</code></div>}
          </form>
        ) : <p className="contribution-closed">{t('contribution.closed')}</p>}
        {refundVisible && <section className="refund-panel" aria-label={t('refund.title')}>
          <h4>{t('refund.title')}</h4>
          {refundEligibility && <div className="refund-summary"><p>{t('refund.contribution', { amount: formatEther(refundEligibility.contribution) })}</p><p>{t('refund.amount', { amount: formatEther(refundEligibility.refundableEth) })}</p><p>{t('refund.burn', { amount: formatUnits(refundEligibility.cfdToBurn, 18) })}</p></div>}
          {refundEligibility?.paused && <p className="refund-error">{t('refund.errors.paused')}</p>}
          {refundEligibility && !refundEligibility.hasEnoughCfd && <p className="refund-error">{t('refund.errors.insufficientCfd')}</p>}
          {!contractConfigured && <p className="refund-error">{t('refund.errors.contractMissing')}</p>}
          {refundError && <p className="refund-error" role="alert">{refundError}</p>}
          <button type="button" disabled={!canRefund} onClick={() => void requestRefund()}>{refundState === 'signature' ? t('refund.signature') : refundState === 'pending' ? t('refund.pending') : t('refund.button')}</button>
          {refundHash && refundState === 'pending' && <p className="refund-hash"><span>{t('refund.hash')}</span><code>{refundHash}</code></p>}
          {refundState === 'success' && <div className="refund-success" role="status"><strong>{t('refund.success')}</strong><code>{refundHash}</code></div>}
        </section>}
        {cancellationVisible && <section className="campaign-cancellation" aria-label={t('campaignCancellation.title')}>
          {cancellationState === 'success' ? <div className="cancellation-success" role="status"><strong>{t('campaignCancellation.success')}</strong><code>{cancellationHash}</code></div> : confirmationOpen ? <div className="cancellation-confirmation" role="alertdialog" aria-labelledby={`cancel-title-${campaign.id}`} aria-describedby={`cancel-description-${campaign.id}`}>
            <h4 id={`cancel-title-${campaign.id}`}>{t('campaignCancellation.confirmTitle')}</h4>
            <p id={`cancel-description-${campaign.id}`}>{t('campaignCancellation.confirmDescription')}</p>
            <div><button type="button" className="cancel-confirm-button" disabled={!canCancel} onClick={() => void confirmCancellation()}>{cancellationState === 'signature' ? t('campaignCancellation.signature') : cancellationState === 'pending' ? t('campaignCancellation.pending') : t('campaignCancellation.confirm')}</button><button type="button" disabled={cancellationBusy} onClick={() => setConfirmationOpen(false)}>{t('campaignCancellation.keep')}</button></div>
          </div> : <button type="button" className="cancel-campaign-button" onClick={() => { setConfirmationOpen(true); setCancellationError('') }}>{t('campaignCancellation.button')}</button>}
          {cancellationError && <p className="cancellation-error" role="alert">{cancellationError}</p>}
          {cancellationHash && cancellationState === 'pending' && <p className="cancellation-hash"><span>{t('campaignCancellation.hash')}</span><code>{cancellationHash}</code></p>}
        </section>}
        {withdrawalVisible && <section className="withdrawal-panel" aria-label={t('withdrawal.title')}>
          <h4>{t('withdrawal.title')}</h4>
          {withdrawalEligibility && <dl><div><dt>{t('withdrawal.approved')}</dt><dd>{formatEther(withdrawalEligibility.approved)} ETH</dd></div><div><dt>{t('withdrawal.available')}</dt><dd>{withdrawalEligibility.availableFunds !== undefined ? `${formatEther(withdrawalEligibility.availableFunds)} ETH` : t('campaignFinancials.unavailable')}</dd></div><div><dt>{t('withdrawal.amount')}</dt><dd>{formatEther(withdrawalEligibility.authorizedRemaining)} ETH</dd></div></dl>}
          {withdrawalEligibility?.frozen && <p className="withdrawal-error">{t('withdrawal.errors.frozen')}</p>}
          {withdrawalEligibility?.cancelled && <p className="withdrawal-error">{t('withdrawal.errors.cancelled')}</p>}
          {withdrawalEligibility?.paused && <p className="withdrawal-error">{t('withdrawal.errors.paused')}</p>}
          {withdrawalEligibility && !withdrawalEligibility.financialsVerified && <p className="withdrawal-error">{t('withdrawal.errors.historyUnavailable')}</p>}
          {withdrawalEligibility && withdrawalEligibility.financialsVerified && withdrawalEligibility.availableFunds !== undefined && withdrawalEligibility.availableFunds < withdrawalEligibility.authorizedRemaining && <p className="withdrawal-error">{t('withdrawal.errors.insufficientFunds')}</p>}
          {withdrawalError && <p className="withdrawal-error" role="alert">{withdrawalError}</p>}
          <button type="button" disabled={!canWithdraw} onClick={() => void withdrawFunds()}>{withdrawalState === 'signature' ? t('withdrawal.signature') : withdrawalState === 'pending' ? t('withdrawal.pending') : t('withdrawal.button')}</button>
          {withdrawalHash && withdrawalState === 'pending' && <p className="withdrawal-hash"><span>{t('withdrawal.hash')}</span><code>{withdrawalHash}</code></p>}
          {withdrawalState === 'success' && <div className="withdrawal-success" role="status"><strong>{t('withdrawal.success')}</strong><code>{withdrawalHash}</code></div>}
        </section>}
      </div>
    </article>
  )
}
