import { BrowserProvider, formatUnits, parseEther } from 'ethers'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { CONTRACT_ABIS } from '../abi'
import { CHAIN_IDS, getContractAddress } from '../config/contracts'
import { useWallet } from '../hooks/useWallet'
import {
  createGovernanceProposal,
  parseEarlyReleaseAmount,
  readProposalEligibility,
  type ProposalEligibility,
  type ProposalKind,
} from '../services/governanceTransactions'
import { readOnChainCampaigns, readOnChainProposals, type OnChainCampaign, type OnChainProposal } from '../services/onchain'

type TransactionState = 'idle' | 'signature' | 'pending' | 'success' | 'error'

export default function GovernanceProposalForm({ onProposalConfirmed, refreshVersion }: { onProposalConfirmed: () => void; refreshVersion: number }) {
  const { t } = useTranslation()
  const { address, chainId } = useWallet()
  const [campaigns, setCampaigns] = useState<OnChainCampaign[]>([])
  const [proposals, setProposals] = useState<OnChainProposal[]>([])
  const [campaignsState, setCampaignsState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [kind, setKind] = useState<ProposalKind>('Freeze')
  const [campaignId, setCampaignId] = useState('')
  const [amount, setAmount] = useState('')
  const [eligibilityResult, setEligibilityResult] = useState<{ key: string; value: ProposalEligibility | null } | null>(null)
  const [state, setState] = useState<TransactionState>('idle')
  const [transactionHash, setTransactionHash] = useState('')
  const [proposalId, setProposalId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false)
  const [completedFormKey, setCompletedFormKey] = useState<string | null>(null)
  const submissionLock = useRef(false)

  useEffect(() => {
    let active = true
    void Promise.all([readOnChainCampaigns(), readOnChainProposals()])
      .then(([campaignItems, proposalItems]) => { if (active) { setCampaigns(campaignItems); setProposals(proposalItems); setCampaignsState('ready') } })
      .catch(() => { if (active) setCampaignsState('error') })
    return () => { active = false }
  }, [refreshVersion])

  const selectedId = Number(campaignId)
  const eligibilityKey = `${address ?? ''}:${chainId ?? ''}:${selectedId}`
  useEffect(() => {
    if (!window.ethereum || !address || chainId !== CHAIN_IDS.hardhat || !Number.isInteger(selectedId) || selectedId <= 0) return
    let active = true
    const provider = new BrowserProvider(window.ethereum)
    void readProposalEligibility(provider, address, selectedId)
      .then((value) => { if (active) setEligibilityResult({ key: eligibilityKey, value }) })
      .catch(() => { if (active) setEligibilityResult({ key: eligibilityKey, value: null }) })
    return () => { active = false }
  }, [address, chainId, eligibilityKey, selectedId])

  const activeCampaigns = useMemo(
    () => campaigns.filter((campaign) => campaign.status === 'Active' && !campaign.frozen),
    [campaigns],
  )
  const eligibility = eligibilityResult?.key === eligibilityKey ? eligibilityResult.value : undefined
  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedId)
  const isBusy = state === 'signature' || state === 'pending'
  const parsedAmount = kind === 'EarlyRelease' ? parseEarlyReleaseAmount(amount) : 0n
  const formKey = `${kind}:${selectedId}:${parsedAmount?.toString() ?? 'invalid'}`
  const duplicateProposals = proposals.filter((proposal) =>
    proposal.type === kind &&
    proposal.campaignId === selectedId &&
    ['Active', 'Succeeded', 'Executed'].includes(proposal.state) &&
    parseEther(proposal.amountEth) === parsedAmount,
  )
  const duplicateRequiresAcknowledgement = duplicateProposals.length > 0
  const pendingEarlyRelease = proposals
    .filter((proposal) => proposal.type === 'EarlyRelease' && proposal.campaignId === selectedId && ['Active', 'Succeeded'].includes(proposal.state))
    .reduce((total, proposal) => total + parseEther(proposal.amountEth), 0n)
  const capacityExceeded = Boolean(
    kind === 'EarlyRelease' &&
    parsedAmount !== null &&
    selectedCampaign &&
    parseEther(selectedCampaign.approvedEth) + pendingEarlyRelease + parsedAmount > parseEther(selectedCampaign.raisedEth),
  )
  const amountValid = kind === 'Freeze' || parseEarlyReleaseAmount(amount) !== null
  const kindEligible = kind === 'Freeze'
    ? Boolean(eligibility && eligibility.currentVotingPower >= eligibility.threshold)
    : Boolean(eligibility?.isBeneficiary)
  const contractsConfigured = Boolean(
    getContractAddress(CHAIN_IDS.hardhat, 'CFDGovernance') &&
      getContractAddress(CHAIN_IDS.hardhat, 'CFDToken') &&
      CONTRACT_ABIS.CFDGovernance &&
      CONTRACT_ABIS.CFDToken,
  )
  const canSubmit = Boolean(
    address && chainId === CHAIN_IDS.hardhat && selectedId > 0 && eligibility?.active && kindEligible && amountValid && contractsConfigured && !isBusy && !confirmationOpen && !capacityExceeded && completedFormKey !== formKey,
  )

  const resetTransaction = () => {
    if (isBusy) return
    submissionLock.current = false
    setConfirmationOpen(false)
    setDuplicateAcknowledged(false)
    setCompletedFormKey(null)
    setState('idle')
    setErrorMessage('')
    setTransactionHash('')
    setProposalId('')
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit || submissionLock.current) return
    submissionLock.current = true
    setConfirmationOpen(true)
    setDuplicateAcknowledged(false)
  }

  const confirmSubmission = async () => {
    if (!window.ethereum || !address || isBusy || (duplicateRequiresAcknowledgement && !duplicateAcknowledged)) return
    setState('signature')
    setErrorMessage('')
    setTransactionHash('')
    setProposalId('')

    try {
      const result = await createGovernanceProposal(
        new BrowserProvider(window.ethereum), address, kind, selectedId, amount,
        (hash) => { setTransactionHash(hash); setState('pending') },
      )
      setTransactionHash(result.transactionHash)
      setProposalId(result.proposalId.toString())
      setState('success')
      setConfirmationOpen(false)
      setCompletedFormKey(formKey)
      onProposalConfirmed()
    } catch (error) {
      const code = (error as { code?: number | string }).code
      const message = error instanceof Error ? error.message : ''
      const key = code === 4001 || code === 'ACTION_REJECTED' ? 'rejected'
        : message.includes('Wrong network') ? 'wrongNetwork'
          : message === 'BELOW_PROPOSAL_THRESHOLD' ? 'threshold'
            : message === 'NOT_BENEFICIARY' ? 'beneficiary'
              : message === 'INVALID_AMOUNT' ? 'amount'
                : message === 'CAMPAIGN_NOT_ACTIVE' ? 'inactive' : 'failed'
      setErrorMessage(t(`proposalForm.errors.${key}`))
      setState('error')
      setConfirmationOpen(false)
      submissionLock.current = false
    }
  }

  const cancelConfirmation = () => {
    if (isBusy) return
    submissionLock.current = false
    setConfirmationOpen(false)
    setDuplicateAcknowledged(false)
  }

  const explicitReset = () => {
    setCompletedFormKey(null)
    resetTransaction()
  }

  return (
    <section className="proposal-creation" aria-labelledby="proposal-creation-title">
      <div className="proposal-creation-heading"><p className="route-page-eyebrow">{t('proposalForm.eyebrow')}</p><h2 id="proposal-creation-title">{t('proposalForm.title')}</h2><p>{t('proposalForm.intro')}</p></div>
      <form onSubmit={submit} noValidate>
        <fieldset disabled={isBusy || confirmationOpen}>
          <legend>{t('proposalForm.type')}</legend>
          <label><input type="radio" name="proposal-kind" value="Freeze" checked={kind === 'Freeze'} onChange={() => { setKind('Freeze'); setAmount(''); resetTransaction() }} />{t('governance.types.freeze')}</label>
          <label><input type="radio" name="proposal-kind" value="EarlyRelease" checked={kind === 'EarlyRelease'} onChange={() => { setKind('EarlyRelease'); resetTransaction() }} />{t('governance.types.earlyRelease')}</label>
        </fieldset>
        <label className="proposal-field"><span>{t('proposalForm.campaign')}</span><select value={campaignId} onChange={(event) => { setCampaignId(event.target.value); resetTransaction() }} disabled={isBusy || confirmationOpen || campaignsState !== 'ready'}><option value="">{campaignsState === 'loading' ? t('proposalForm.loadingCampaigns') : t('proposalForm.chooseCampaign')}</option>{activeCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.metadata?.title || t('onchain.campaignFallback', { id: campaign.id })}</option>)}</select></label>
        {campaignsState === 'error' && <p className="proposal-form-error">{t('onchain.readError')}</p>}
        {campaignsState === 'ready' && activeCampaigns.length === 0 && <p className="proposal-form-note">{t('proposalForm.noCampaigns')}</p>}
        {kind === 'EarlyRelease' && <label className="proposal-field"><span>{t('proposalForm.amount')}</span><input type="number" min="0" step="any" inputMode="decimal" value={amount} onChange={(event) => { if (!isBusy && !confirmationOpen) { setAmount(event.target.value); resetTransaction() } }} disabled={confirmationOpen} aria-invalid={Boolean(amount && !amountValid)} aria-describedby={amount && !amountValid ? 'proposal-amount-error' : undefined} placeholder="0.01" /></label>}
        {kind === 'EarlyRelease' && amount && !amountValid && <p id="proposal-amount-error" className="proposal-form-error">{t('proposalForm.errors.amount')}</p>}
        {eligibility === undefined && address && campaignId && chainId === CHAIN_IDS.hardhat && <p className="proposal-form-note">{t('proposalForm.checking')}</p>}
        {eligibility === null && <p className="proposal-form-error">{t('proposalForm.errors.eligibility')}</p>}
        {eligibility && kind === 'Freeze' && <p className="proposal-form-note">{t('proposalForm.currentVotingPower', { votes: Number(formatUnits(eligibility.currentVotingPower, 18)).toLocaleString(), threshold: Number(formatUnits(eligibility.threshold, 18)).toLocaleString() })}</p>}
        {eligibility && kind === 'Freeze' && <p className="proposal-form-note">{t('proposalForm.historicalVotingPower', { votes: Number(formatUnits(eligibility.historicalVotingPower, 18)).toLocaleString(), snapshot: eligibility.historicalSnapshot.toString() })}</p>}
        {eligibility && kind === 'Freeze' && <p className="proposal-form-note">{t('proposalForm.contractAuthority')}</p>}
        {eligibility && kind === 'Freeze' && !kindEligible && <p className="proposal-form-error">{t('proposalForm.errors.threshold')}</p>}
        {eligibility && kind === 'EarlyRelease' && !eligibility.isBeneficiary && <p className="proposal-form-error">{t('proposalForm.errors.beneficiary')}</p>}
        {duplicateRequiresAcknowledgement && <p className="proposal-duplicate-warning" role="alert">{t('proposalSafety.duplicateWarning', { ids: duplicateProposals.map((proposal) => `#${proposal.id}`).join(', ') })}</p>}
        {capacityExceeded && <p className="proposal-form-error" role="alert">{t('proposalSafety.capacityExceeded')}</p>}
        {!address && <p className="proposal-form-note">{t('proposalForm.connect')}</p>}
        {address && chainId !== CHAIN_IDS.hardhat && <p className="proposal-form-error">{t('proposalForm.errors.wrongNetwork')}</p>}
        {!contractsConfigured && <p className="proposal-form-error">{t('proposalForm.contractMissing')}</p>}
        {errorMessage && <p className="proposal-form-error" role="alert">{errorMessage}</p>}
        <button className="proposal-submit" type="submit" disabled={!canSubmit}>{completedFormKey === formKey ? t('proposalSafety.createdLocked') : t('proposalForm.button')}</button>
        {confirmationOpen && <div className="proposal-confirmation" role="alertdialog" aria-labelledby="proposal-confirmation-title" aria-describedby="proposal-confirmation-description">
          <h3 id="proposal-confirmation-title">{t('proposalSafety.confirmTitle')}</h3>
          <p id="proposal-confirmation-description">{t('proposalSafety.confirmDescription')}</p>
          <dl><div><dt>{t('proposalForm.type')}</dt><dd>{t(`governance.types.${kind === 'Freeze' ? 'freeze' : 'earlyRelease'}`)}</dd></div><div><dt>{t('proposalForm.campaign')}</dt><dd>{selectedCampaign?.metadata?.title || t('onchain.campaignFallback', { id: selectedId })} (#{selectedId})</dd></div><div><dt>{t('proposalSafety.requestedAmount')}</dt><dd>{kind === 'Freeze' ? '0 ETH' : `${amount} ETH`}</dd></div></dl>
          {duplicateRequiresAcknowledgement && <label className="proposal-duplicate-ack"><input type="checkbox" checked={duplicateAcknowledged} onChange={(event) => setDuplicateAcknowledged(event.target.checked)} />{t('proposalSafety.duplicateAcknowledge')}</label>}
          <div className="proposal-confirmation-actions"><button type="button" onClick={() => void confirmSubmission()} disabled={isBusy || (duplicateRequiresAcknowledgement && !duplicateAcknowledged)}>{state === 'signature' ? t('proposalForm.signature') : state === 'pending' ? t('proposalForm.pending') : t('proposalSafety.confirm')}</button><button type="button" onClick={cancelConfirmation} disabled={isBusy}>{t('proposalSafety.cancel')}</button></div>
        </div>}
        {transactionHash && state === 'pending' && <p className="proposal-transaction"><span>{t('proposalForm.hash')}</span><code>{transactionHash}</code></p>}
        {state === 'success' && <div className="proposal-form-success" role="status"><strong>{t('proposalForm.success', { id: proposalId })}</strong><code>{transactionHash}</code><button type="button" onClick={explicitReset}>{t('proposalSafety.reset')}</button></div>}
      </form>
    </section>
  )
}
