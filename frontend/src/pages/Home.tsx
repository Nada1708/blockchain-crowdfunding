import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import CampaignCard from '../components/CampaignCard';
import GovernancePreview from '../components/GovernancePreview';
import HowItWorks from '../components/HowItWorks';
import { featuredCampaigns } from '../data/campaigns';
import './Home.css';

export default function Home() {
  const { t } = useTranslation();
  const heroRef = useRef<HTMLElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [impactMessage, setImpactMessage] = useState(0);

  useEffect(() => () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const interval = window.setInterval(() => {
      setImpactMessage((current) => (current + 1) % 3);
    }, 4200);
    return () => window.clearInterval(interval);
  }, []);

  const handleHeroPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (
      !window.matchMedia('(hover: hover) and (pointer: fine)').matches ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) return;

    const hero = heroRef.current;
    if (!hero) return;
    const bounds = hero.getBoundingClientRect();
    const offsetX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 18;
    const offsetY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 14;

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(() => {
      hero.style.setProperty('--aurora-x', `${offsetX}px`);
      hero.style.setProperty('--aurora-y', `${offsetY}px`);
      hero.style.setProperty('--card-rotate-x', `${-offsetY * 0.18}deg`);
      hero.style.setProperty('--card-rotate-y', `${offsetX * 0.22}deg`);
    });
  };

  const resetAuroraPosition = () => {
    heroRef.current?.style.setProperty('--aurora-x', '0px');
    heroRef.current?.style.setProperty('--aurora-y', '0px');
    heroRef.current?.style.setProperty('--card-rotate-x', '0deg');
    heroRef.current?.style.setProperty('--card-rotate-y', '0deg');
  };

  return <>
    <section ref={heroRef} id="home" className="hero" aria-labelledby="hero-title" onPointerMove={handleHeroPointerMove} onPointerLeave={resetAuroraPosition}>
      <div className="hero-aurora" aria-hidden="true">
        <span className="hero-aurora-halo hero-aurora-halo-one" />
        <span className="hero-aurora-halo hero-aurora-halo-two" />
        <span className="hero-aurora-halo hero-aurora-halo-three" />
        <span className="hero-aurora-halo hero-aurora-halo-four" />
      </div>
      <div className="hero-content"><p className="hero-eyebrow">{t('home.eyebrow')}</p><h1 id="hero-title">{t('home.title')} <span>{t('home.titleAccent')}</span></h1><p className="hero-description">{t('home.description')}</p><div className="hero-actions" aria-label={t('home.actions')}><Link className="hero-button hero-button-primary" to="/campaigns">{t('home.explore')}</Link><Link className="hero-button hero-button-secondary" to="/create">{t('home.create')}</Link></div></div>
      <div className="hero-visual" aria-hidden="true">
        <span className="impact-glow impact-glow-one" />
        <span className="impact-glow impact-glow-two" />
        <span className="impact-glow impact-glow-three" />
        <div className="impact-card">
          <div className="impact-card-top"><span className="impact-card-icon">F</span><span className="impact-card-status">{t('home.trust')}</span></div>
          <div className="impact-message" key={impactMessage}>
            <span>{[t('home.impact'), t('home.collective'), t('home.dao')][impactMessage]}</span>
            <strong>{[t('home.backed'), t('home.collectiveText'), t('home.daoText')][impactMessage]}</strong>
          </div>
          <div className="impact-progress"><span key={`progress-${impactMessage}`} /></div>
          <div className="impact-card-meta"><span>{t('home.transparent')}</span><span>{t('home.decentralized')}</span></div>
        </div>
      </div>
    </section>
    <section className="featured-campaigns" aria-labelledby="featured-campaigns-title"><div className="featured-campaigns-header"><div><p className="featured-campaigns-eyebrow">{t('home.featured')}</p><h2 id="featured-campaigns-title">{t('home.ideas')}</h2></div><p>{t('home.featuredDescription')}</p></div><p className="campaigns-demo-notice" role="note">{t('home.demoNotice')}</p><div className="campaigns-grid">{featuredCampaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)}</div></section>
    <HowItWorks /><GovernancePreview />
  </>;
}
