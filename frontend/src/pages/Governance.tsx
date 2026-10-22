import { Camera, Coins, Info } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import GovernanceProposalCard from '../components/GovernanceProposalCard';
import { governanceProposals, type ProposalStatus } from '../data/governanceProposals';
import './Governance.css';

type StatusFilter = 'All' | ProposalStatus;
const filters: StatusFilter[] = ['All', 'Active', 'Passed', 'Rejected'];

export default function Governance() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<StatusFilter>('All');
  const proposals = filter === 'All' ? governanceProposals : governanceProposals.filter((proposal) => proposal.status === filter);
  const activeCount = governanceProposals.filter((proposal) => proposal.status === 'Active').length;
  const passedCount = governanceProposals.filter((proposal) => proposal.status === 'Passed').length;

  return (
    <section className="route-page governance-page" aria-labelledby="governance-page-title">
      <div className="governance-heading">
        <div><p className="route-page-eyebrow">{t('governance.eyebrow')}</p><h1 id="governance-page-title">{t('governance.title')}</h1><p className="route-page-intro">{t('governance.intro')}</p></div>
        <p className="governance-demo-note"><Info size={16} aria-hidden="true" />{t('governance.demo')}</p>
      </div>

      <div className="governance-summary" aria-label={t('governance.summary.label')}>
        <article><span>{t('governance.summary.total')}</span><strong>{governanceProposals.length}</strong></article>
        <article><span>{t('governance.summary.active')}</span><strong>{activeCount}</strong></article>
        <article><span>{t('governance.summary.passed')}</span><strong>{passedCount}</strong></article>
      </div>

      <section className="governance-education" aria-labelledby="governance-education-title">
        <div className="governance-education-heading"><p>{t('governance.education.eyebrow')}</p><h2 id="governance-education-title">{t('governance.education.title')}</h2></div>
        <article><Coins aria-hidden="true" /><div><h3>{t('governance.education.cfdTitle')}</h3><p>{t('governance.education.cfdText')}</p></div></article>
        <article><Camera aria-hidden="true" /><div><h3>{t('governance.education.snapshotTitle')}</h3><p>{t('governance.education.snapshotText')}</p></div></article>
      </section>

      <div className="governance-list-heading">
        <div><p className="route-page-eyebrow">{t('governance.list.eyebrow')}</p><h2>{t('governance.list.title')}</h2></div>
        <div className="governance-filters" aria-label={t('governance.filters.label')}>{filters.map((status) => <button key={status} type="button" className={filter === status ? 'is-active' : ''} aria-pressed={filter === status} onClick={() => setFilter(status)}>{t(`governance.filters.${status.toLowerCase()}`)}</button>)}</div>
      </div>

      <p className="governance-result-count" aria-live="polite">{t('governance.list.results', { count: proposals.length })}</p>
      <div className="governance-proposals">{proposals.map((proposal) => <GovernanceProposalCard key={proposal.id} proposal={proposal} />)}</div>
      <p className="governance-disabled-note">{t('governance.actions.note')}</p>
    </section>
  );
}
