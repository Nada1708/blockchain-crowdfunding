import { Camera, Scale, ShieldCheck, Snowflake } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import './GovernancePreview.css';

export default function GovernancePreview() {
  const { t } = useTranslation();
  const concepts = [{ title: t('governancePreview.voteTitle'), description: t('governancePreview.voteText'), icon: Scale }, { title: t('governancePreview.snapshotTitle'), description: t('governancePreview.snapshotText'), icon: Camera }, { title: t('governancePreview.releaseTitle'), description: t('governancePreview.releaseText'), icon: ShieldCheck }, { title: t('governancePreview.safeguardTitle'), description: t('governancePreview.safeguardText'), icon: Snowflake }];
  return (
    <section className="governance-preview" aria-labelledby="governance-preview-title">
      <div className="governance-preview-intro"><p className="governance-preview-eyebrow">{t('governancePreview.eyebrow')}</p><h2 id="governance-preview-title">{t('governancePreview.title')}</h2><p>{t('governancePreview.intro')}</p><p className="governance-preview-status" role="note">{t('governancePreview.status')}</p><Link className="governance-preview-cta" to="/governance">{t('governancePreview.cta')}</Link></div>
      <div className="governance-preview-grid">{concepts.map(({ title, description, icon: Icon }) => <article className="governance-preview-card" key={title}><span className="governance-preview-icon" aria-hidden="true"><Icon size={23} strokeWidth={1.8} /></span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div>
    </section>
  );
}
