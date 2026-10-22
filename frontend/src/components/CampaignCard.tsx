import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { Campaign } from '../data/campaigns';
import './CampaignCard.css';

export default function CampaignCard({ campaign }: { campaign: Campaign }) {
  const { t } = useTranslation();
  const progress = Math.min((campaign.raised / campaign.goal) * 100, 100);
  const title = t(campaign.titleKey);
  const statusKey = campaign.status.toLowerCase();
  return (
    <article className="campaign-card">
      <div className="campaign-card-image-wrap">
        <img className="campaign-card-image" src={campaign.image} alt="" loading="lazy" />
        <div className="campaign-card-badges"><span className="campaign-demo-badge">{t('card.demo')}</span><span className={`campaign-status campaign-status-${statusKey}`}>{t(`campaigns.${statusKey}`)}</span></div>
      </div>
      <div className="campaign-card-content">
        <h3>{title}</h3><p>{t(campaign.descriptionKey)}</p>
        <div className="campaign-funding">
          <div className="campaign-amounts"><span><strong>{campaign.raised} ETH</strong> {t('card.raised')}</span><span>{campaign.goal} ETH {t('card.goal')}</span></div>
          <div className="campaign-progress" role="progressbar" aria-label={t('card.progress', { title })} aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>
          <span className="campaign-percentage">{t('card.funded', { progress: Math.round(progress) })}</span>
        </div>
        <Link className="campaign-view-button" to="/campaigns">{t('card.view')}</Link>
      </div>
    </article>
  );
}
