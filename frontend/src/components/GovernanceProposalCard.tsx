import { CalendarDays, LockKeyhole } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { GovernanceProposal } from '../data/governanceProposals';
import './GovernanceProposalCard.css';

export default function GovernanceProposalCard({ proposal }: { proposal: GovernanceProposal }) {
  const { t } = useTranslation();
  const totalVotes = proposal.votesFor + proposal.votesAgainst;
  const quorumProgress = Math.min((totalVotes / proposal.quorum) * 100, 100);
  const forProgress = totalVotes ? (proposal.votesFor / totalVotes) * 100 : 0;
  const statusKey = proposal.status.toLowerCase();
  const typeKey = proposal.type === 'Freeze' ? 'freeze' : 'earlyRelease';

  return (
    <article className="proposal-card">
      <div className="proposal-card-top">
        <div className="proposal-badges">
          <span className="proposal-demo">DEMO</span>
          <span className={`proposal-status proposal-status-${statusKey}`}>{t(`governance.status.${statusKey}`)}</span>
        </div>
        <span className={`proposal-type proposal-type-${proposal.type.toLowerCase()}`}><LockKeyhole size={14} aria-hidden="true" />{t(`governance.types.${typeKey}`)}</span>
      </div>

      <p className="proposal-campaign">{t('governance.card.campaign')}: <strong>{t(proposal.campaignKey)}</strong></p>
      <h2>{t(proposal.titleKey)}</h2>
      <p className="proposal-description">{t(proposal.descriptionKey)}</p>
      <p className="proposal-period"><CalendarDays size={16} aria-hidden="true" />{t(proposal.periodKey)}</p>

      <div className="proposal-votes">
        <div className="proposal-vote-labels"><span>{t('governance.card.for')} <strong>{proposal.votesFor.toLocaleString()}</strong></span><span>{t('governance.card.against')} <strong>{proposal.votesAgainst.toLocaleString()}</strong></span></div>
        <div className="proposal-vote-bar" aria-label={t('governance.card.voteProgress')} role="img"><span style={{ width: `${forProgress}%` }} /></div>
      </div>

      <div className="proposal-quorum">
        <div><span>{t('governance.card.quorum')}</span><strong>{Math.round(quorumProgress)}%</strong></div>
        <div className="proposal-quorum-bar" role="progressbar" aria-label={t('governance.card.quorumProgress')} aria-valuenow={Math.round(quorumProgress)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${quorumProgress}%` }} /></div>
        <small>{t('governance.card.quorumDetail', { votes: totalVotes.toLocaleString(), quorum: proposal.quorum.toLocaleString() })}</small>
      </div>

      <div className="proposal-actions">
        <button type="button" disabled title={t('governance.actions.disabled')}>{t('governance.actions.vote')}</button>
        <button type="button" disabled title={t('governance.actions.disabled')}>{t('governance.actions.execute')}</button>
      </div>
    </article>
  );
}
