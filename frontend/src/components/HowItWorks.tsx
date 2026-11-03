import { CirclePlus, Coins, HandCoins, Vote } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './HowItWorks.css';

export default function HowItWorks() {
  const { t } = useTranslation();
  const steps = [{ title: t('how.createTitle'), description: t('how.createText'), icon: CirclePlus }, { title: t('how.fundTitle'), description: t('how.fundText'), icon: HandCoins }, { title: t('how.tokensTitle'), description: t('how.tokensText'), icon: Coins }, { title: t('how.daoTitle'), description: t('how.daoText'), icon: Vote }];
  return (
    <section className="how-it-works" aria-labelledby="how-it-works-title">
      <div className="how-it-works-heading"><p className="how-it-works-eyebrow">{t('how.eyebrow')}</p><h2 id="how-it-works-title">{t('how.title')}</h2><p>{t('how.intro')}</p></div>
      <ol className="how-it-works-grid">{steps.map(({ title, description, icon: Icon }, index) => <li className="how-it-works-step" key={title}><div className="how-it-works-step-top"><span className="how-it-works-icon" aria-hidden="true"><Icon size={25} strokeWidth={1.8} /></span><span className="how-it-works-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span></div><h3>{title}</h3><p>{description}</p></li>)}</ol>
    </section>
  );
}
