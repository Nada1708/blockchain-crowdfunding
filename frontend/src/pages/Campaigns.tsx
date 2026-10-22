import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CampaignCard from '../components/CampaignCard';
import { featuredCampaigns, type CampaignStatus } from '../data/campaigns';
import './Campaigns.css';

type StatusFilter = 'All' | CampaignStatus;
const filters: StatusFilter[] = ['All', 'Active', 'Successful', 'Failed'];

export default function Campaigns() {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('All');
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
      <div className="campaigns-page-heading"><p className="route-page-eyebrow">{t('campaigns.eyebrow')}</p><h1 id="campaigns-page-title">{t('campaigns.title')}</h1><p className="route-page-intro">{t('campaigns.intro')}</p></div>
      <div className="campaigns-toolbar" aria-label={t('campaigns.toolbar')}><label className="campaigns-search"><span className="sr-only">{t('campaigns.searchLabel')}</span><Search size={19} strokeWidth={1.8} aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('campaigns.searchPlaceholder')} /></label><div className="campaigns-status-filters" aria-label={t('campaigns.filterLabel')}>{filters.map((filter) => <button key={filter} type="button" className={status === filter ? 'is-active' : ''} onClick={() => setStatus(filter)} aria-pressed={status === filter}>{filterLabel(filter)}</button>)}</div></div>
      <div className="campaigns-results-heading" aria-live="polite"><p><strong>{filtered.length}</strong> {t('campaigns.result', { count: filtered.length }).replace(String(filtered.length), '').trim()}</p><span>{t('campaigns.demoData')}</span></div>
      {filtered.length ? <div className="campaigns-grid campaigns-results-grid">{filtered.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)}</div> : <div className="campaigns-empty-state"><Search size={28} strokeWidth={1.6} aria-hidden="true" /><h2>{t('campaigns.emptyTitle')}</h2><p>{t('campaigns.emptyText')}</p><button type="button" onClick={() => { setQuery(''); setStatus('All'); }}>{t('campaigns.reset')}</button></div>}
    </section>
  );
}
