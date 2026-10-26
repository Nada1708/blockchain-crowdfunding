import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CampaignCard from '../components/CampaignCard';
import OnChainCampaignCard from '../components/OnChainCampaignCard';
import { featuredCampaigns, type CampaignStatus } from '../data/campaigns';
import { readOnChainCampaigns, type OnChainCampaign } from '../services/onchain';
import './Campaigns.css';

type StatusFilter = 'All' | CampaignStatus;
const filters: StatusFilter[] = ['All', 'Active', 'Successful', 'Failed'];

export default function Campaigns() {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('All');
  const [onChainCampaigns, setOnChainCampaigns] = useState<OnChainCampaign[]>([]);
  const [onChainState, setOnChainState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    void readOnChainCampaigns()
      .then((campaigns) => { if (active) { setOnChainCampaigns(campaigns); setOnChainState('ready'); } })
      .catch(() => { if (active) setOnChainState('error'); });
    return () => { active = false; };
  }, [reload]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(i18n.language);
    return featuredCampaigns.filter((campaign) => {
      const title = t(campaign.titleKey).toLocaleLowerCase(i18n.language);
      const description = t(campaign.descriptionKey).toLocaleLowerCase(i18n.language);
      return (status === 'All' || campaign.status === status) && (!normalized || title.includes(normalized) || description.includes(normalized));
    });
  }, [query, status, t, i18n.language]);
  const filterLabel = (filter: StatusFilter) => t(`campaigns.${filter.toLowerCase()}`);
  return (
    <section className="route-page campaigns-page" aria-labelledby="campaigns-page-title">
      <div className="campaigns-page-heading"><p className="route-page-eyebrow">{t('campaigns.eyebrow')}</p><h1 id="campaigns-page-title">{t('campaigns.title')}</h1><p className="route-page-intro">{t('onchain.campaignsIntro')}</p></div>
      <section className="onchain-section" aria-labelledby="onchain-campaigns-title">
        <div className="onchain-section-heading"><div><p className="route-page-eyebrow">{t('onchain.liveEyebrow')}</p><h2 id="onchain-campaigns-title">{t('onchain.campaignsTitle')}</h2></div><span>{t('onchain.hardhatNetwork')}</span></div>
        {onChainState === 'loading' && <div className="onchain-state" role="status">{t('onchain.loadingCampaigns')}</div>}
        {onChainState === 'error' && <div className="onchain-state onchain-state-error" role="alert"><p>{t('onchain.readError')}</p><button type="button" onClick={() => { setOnChainState('loading'); setReload((value) => value + 1); }}>{t('onchain.retry')}</button></div>}
        {onChainState === 'ready' && onChainCampaigns.length === 0 && <div className="onchain-state"><p>{t('onchain.emptyCampaigns')}</p></div>}
        {onChainState === 'ready' && onChainCampaigns.length > 0 && <div className="campaigns-grid campaigns-results-grid">{onChainCampaigns.map((campaign) => <OnChainCampaignCard key={campaign.id} campaign={campaign} refreshVersion={reload} onContributionConfirmed={() => setReload((value) => value + 1)} />)}</div>}
      </section>
      <div className="demo-section-heading"><p className="route-page-eyebrow">DEMO</p><h2>{t('onchain.demoCampaignsTitle')}</h2></div>
      <div className="campaigns-toolbar" aria-label={t('campaigns.toolbar')}><label className="campaigns-search"><span className="sr-only">{t('campaigns.searchLabel')}</span><Search size={19} strokeWidth={1.8} aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('campaigns.searchPlaceholder')} /></label><div className="campaigns-status-filters" aria-label={t('campaigns.filterLabel')}>{filters.map((filter) => <button key={filter} type="button" className={status === filter ? 'is-active' : ''} onClick={() => setStatus(filter)} aria-pressed={status === filter}>{filterLabel(filter)}</button>)}</div></div>
      <div className="campaigns-results-heading" aria-live="polite"><p><strong>{filtered.length}</strong> {t('campaigns.result', { count: filtered.length }).replace(String(filtered.length), '').trim()}</p><span>{t('campaigns.demoData')}</span></div>
      {filtered.length ? <div className="campaigns-grid campaigns-results-grid">{filtered.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)}</div> : <div className="campaigns-empty-state"><Search size={28} strokeWidth={1.6} aria-hidden="true" /><h2>{t('campaigns.emptyTitle')}</h2><p>{t('campaigns.emptyText')}</p><button type="button" onClick={() => { setQuery(''); setStatus('All'); }}>{t('campaigns.reset')}</button></div>}
    </section>
  );
}
