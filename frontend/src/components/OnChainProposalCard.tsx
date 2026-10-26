import { BrowserProvider, formatUnits } from 'ethers'
import { CalendarDays, LockKeyhole } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CONTRACT_ABIS } from '../abi'
import { CHAIN_IDS, getContractAddress } from '../config/contracts'
import { useWallet } from '../hooks/useWallet'
import { executeGovernanceProposal } from '../services/governanceExecutionTransactions'
import { castGovernanceVote, readVoteEligibility, type VoteEligibility } from '../services/governanceVoteTransactions'
import type { OnChainProposal } from '../services/onchain'
import './GovernanceProposalCard.css'

function percentage(value: bigint, total: bigint) {
  return total === 0n ? 0 : Number((value * 10_000n) / total) / 100
}

function cfd(value: bigint) {
  return Number(formatUnits(value, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

type VoteState = 'idle' | 'signature' | 'pending' | 'success' | 'error'
type ExecutionState = 'idle' | 'signature' | 'pending' | 'success' | 'error'

export default function OnChainProposalCard({ proposal, onGovernanceChanged }: { proposal: OnChainProposal; onGovernanceChanged: () => void }) {
  const { t } = useTranslation()
  const { address, chainId } = useWallet()
  const [eligibilityResult, setEligibilityResult] = useState<{ key: string; value: VoteEligibility | null } | null>(null)
  const [voteState, setVoteState] = useState<VoteState>('idle')
  const [transactionHash, setTransactionHash] = useState('')
  const [confirmedWeight, setConfirmedWeight] = useState<bigint | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [executionState, setExecutionState] = useState<ExecutionState>('idle')
  const [executionHash, setExecutionHash] = useState('')
  const [executionError, setExecutionError] = useState('')
  const total = proposal.forVotes + proposal.againstVotes
  const quorumProgress = Math.min(percentage(total, proposal.quorum), 100)
  const forProgress = percentage(proposal.forVotes, total)
  const stateKey = proposal.state.toLowerCase()
  const typeKey = proposal.type === 'Freeze' ? 'freeze' : 'earlyRelease'
  const isBusy = voteState === 'signature' || voteState === 'pending'
  const isExecuting = executionState === 'signature' || executionState === 'pending'
  const isCorrectNetwork = chainId === CHAIN_IDS.hardhat
  const governanceConfigured = Boolean(getContractAddress(CHAIN_IDS.hardhat, 'CFDGovernance') && CONTRACT_ABIS.CFDGovernance)
  const eligibilityKey = `${address ?? ''}:${chainId ?? ''}:${proposal.id}:${proposal.state}`
  const shouldReadEligibility = Boolean(window.ethereum && address && isCorrectNetwork && proposal.state === 'Active')
  const currentEligibilityResult = eligibilityResult?.key === eligibilityKey ? eligibilityResult : undefined
  const eligibility = currentEligibilityResult?.value
  const eligibilityState = !shouldReadEligibility ? 'idle'
    : currentEligibilityResult === undefined ? 'loading'
      : eligibility === null ? 'error' : 'ready'
  const canVote = Boolean(
    proposal.state === 'Active' &&
      address &&
      isCorrectNetwork &&
      eligibilityState === 'ready' &&
      eligibility?.active &&
      !eligibility.hasVoted &&
      eligibility.votingPower > 0n &&
      !isBusy,
  )

  useEffect(() => {
    if (!window.ethereum || !address || !isCorrectNetwork || proposal.state !== 'Active') return

    let active = true
    void readVoteEligibility(new BrowserProvider(window.ethereum), address, proposal.id)
      .then((value) => { if (active) setEligibilityResult({ key: eligibilityKey, value }) })
      .catch(() => { if (active) setEligibilityResult({ key: eligibilityKey, value: null }) })
    return () => { active = false }
  }, [address, eligibilityKey, isCorrectNetwork, proposal.id, proposal.state])

  const vote = async (support: boolean) => {
    if (!canVote || !window.ethereum || !address) return
    setVoteState('signature')
    setTransactionHash('')
    setConfirmedWeight(null)
    setErrorMessage('')
    try {
      const result = await castGovernanceVote(
        new BrowserProvider(window.ethereum),
        address,
        proposal.id,
        support,
        (hash) => { setTransactionHash(hash); setVoteState('pending') },
      )
      setTransactionHash(result.transactionHash)
      setConfirmedWeight(result.weight)
      setVoteState('success')
      setEligibilityResult((current) => current?.key === eligibilityKey && current.value
        ? { key: eligibilityKey, value: { ...current.value, hasVoted: true } }
        : current)
      onGovernanceChanged()
    } catch (error) {
      const code = (error as { code?: number | string }).code
      const message = error instanceof Error ? error.message : ''
      const key = code === 4001 || code === 'ACTION_REJECTED' ? 'rejected'
        : message.includes('Wrong network') ? 'wrongNetwork'
          : message === 'ALREADY_VOTED' ? 'alreadyVoted'
            : message === 'NO_VOTING_POWER' ? 'noVotingPower'
              : message === 'VOTING_CLOSED' ? 'inactive' : 'failed'
      setErrorMessage(t(`daoVote.errors.${key}`))
      setVoteState('error')
    }
  }

  const executeProposal = async () => {
    if (proposal.state !== 'Succeeded' || !window.ethereum || !address || !isCorrectNetwork || !governanceConfigured || isExecuting) return
    setExecutionState('signature')
    setExecutionHash('')
    setExecutionError('')
    try {
      const result = await executeGovernanceProposal(
        new BrowserProvider(window.ethereum),
        proposal.id,
        (hash) => { setExecutionHash(hash); setExecutionState('pending') },
      )
      setExecutionHash(result.transactionHash)
      setExecutionState('success')
      onGovernanceChanged()
    } catch (error) {
      const code = (error as { code?: number | string }).code
      const message = error instanceof Error ? error.message : ''
      const key = code === 4001 || code === 'ACTION_REJECTED' ? 'rejected'
        : message.includes('Wrong network') ? 'wrongNetwork'
          : message === 'PROPOSAL_NOT_SUCCEEDED' ? 'notSucceeded' : 'failed'
      setExecutionError(t(`daoExecute.errors.${key}`))
      setExecutionState('error')
    }
  }

  return (
    <article className="proposal-card">
      <div className="proposal-card-top">
        <div className="proposal-badges"><span className="proposal-onchain">{t('onchain.badge')}</span><span className={`proposal-status proposal-status-${stateKey}`}>{t(`onchain.proposalState.${stateKey}`)}</span></div>
        <span className={`proposal-type proposal-type-${proposal.type.toLowerCase()}`}><LockKeyhole size={14} aria-hidden="true" />{t(`governance.types.${typeKey}`)}</span>
      </div>
      <p className="proposal-campaign">{t('governance.card.campaign')}: <strong>#{proposal.campaignId}</strong></p>
      <h2>{t('onchain.proposalTitle', { id: proposal.id })}</h2>
      <p className="proposal-description">{proposal.type === 'EarlyRelease' ? t('onchain.releaseAmount', { amount: proposal.amountEth }) : t('onchain.freezeDescription')}</p>
      <p className="proposal-period"><CalendarDays size={16} aria-hidden="true" />{t('onchain.voteEnds', { date: new Date(proposal.voteEnd * 1000).toLocaleString() })}</p>
      <p className="proposal-snapshot">{t('onchain.snapshot', { block: proposal.snapshot })}</p>
      <div className="proposal-votes">
        <div className="proposal-vote-labels"><span>{t('governance.card.for')} <strong>{cfd(proposal.forVotes)} CFD</strong></span><span>{t('governance.card.against')} <strong>{cfd(proposal.againstVotes)} CFD</strong></span></div>
        <div className="proposal-vote-bar" role="img" aria-label={t('onchain.voteProgress')}><span style={{ width: `${forProgress}%` }} /></div>
      </div>
      <div className="proposal-quorum">
        <div><span>{t('governance.card.quorum')}</span><strong>{Math.round(quorumProgress)}%</strong></div>
        <div className="proposal-quorum-bar" role="progressbar" aria-label={t('onchain.quorumProgress')} aria-valuenow={Math.round(quorumProgress)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${quorumProgress}%` }} /></div>
        <small>{t('onchain.quorumDetail', { votes: cfd(total), quorum: cfd(proposal.quorum) })}</small>
      </div>
      {proposal.state === 'Active' && <div className="onchain-vote-panel">
        {eligibilityState === 'loading' && <p role="status">{t('daoVote.loading')}</p>}
        {eligibilityState === 'error' && <p className="onchain-vote-error" role="alert">{t('daoVote.errors.eligibility')}</p>}
        {!address && <p>{t('daoVote.connect')}</p>}
        {address && !isCorrectNetwork && <p className="onchain-vote-error">{t('daoVote.errors.wrongNetwork')}</p>}
        {eligibility && <p>{t('daoVote.weight', { weight: cfd(eligibility.votingPower), snapshot: eligibility.snapshot.toString() })}</p>}
        {eligibility?.hasVoted && <p className="onchain-vote-status">{t('daoVote.alreadyVoted')}</p>}
        {eligibility && !eligibility.hasVoted && eligibility.votingPower === 0n && <p className="onchain-vote-error">{t('daoVote.errors.noVotingPower')}</p>}
        {errorMessage && <p className="onchain-vote-error" role="alert">{errorMessage}</p>}
        <div className="proposal-actions">
          <button type="button" disabled={!canVote} onClick={() => void vote(true)}>{voteState === 'signature' ? t('daoVote.signature') : voteState === 'pending' ? t('daoVote.pending') : t('daoVote.for')}</button>
          <button type="button" disabled={!canVote} onClick={() => void vote(false)}>{voteState === 'signature' ? t('daoVote.signature') : voteState === 'pending' ? t('daoVote.pending') : t('daoVote.against')}</button>
        </div>
        {transactionHash && voteState === 'pending' && <p className="onchain-vote-hash"><span>{t('daoVote.hash')}</span><code>{transactionHash}</code></p>}
        {voteState === 'success' && confirmedWeight !== null && <p className="onchain-vote-success" role="status">{t('daoVote.success', { weight: cfd(confirmedWeight) })}</p>}
      </div>}
      {proposal.state === 'Succeeded' && <div className="onchain-execution-panel">
        {!address && <p>{t('daoExecute.connect')}</p>}
        {address && !isCorrectNetwork && <p className="onchain-vote-error">{t('daoExecute.errors.wrongNetwork')}</p>}
        {!governanceConfigured && <p className="onchain-vote-error">{t('daoExecute.errors.contractMissing')}</p>}
        {executionError && <p className="onchain-vote-error" role="alert">{executionError}</p>}
        <button className="proposal-execute-button" type="button" disabled={!address || !isCorrectNetwork || !governanceConfigured || isExecuting} onClick={() => void executeProposal()}>{executionState === 'signature' ? t('daoExecute.signature') : executionState === 'pending' ? t('daoExecute.pending') : t('daoExecute.button')}</button>
        {executionHash && executionState === 'pending' && <p className="onchain-vote-hash"><span>{t('daoExecute.hash')}</span><code>{executionHash}</code></p>}
        {executionState === 'success' && <p className="onchain-vote-success" role="status">{t('daoExecute.success')}</p>}
      </div>}
      {proposal.state !== 'Active' && proposal.state !== 'Succeeded' && <div className="proposal-actions"><button type="button" disabled>{t('governance.actions.vote')}</button><button type="button" disabled>{t('governance.actions.execute')}</button></div>}
    </article>
  )
}
