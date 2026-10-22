import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  const { t } = useTranslation();
  const links = [{ label: t('nav.home'), to: '/' }, { label: t('nav.campaigns'), to: '/campaigns' }, { label: t('footer.create'), to: '/create' }, { label: t('nav.governance'), to: '/governance' }];
  return (
    <footer className="fundora-footer">
      <div className="fundora-footer-content">
        <div className="fundora-footer-brand-block">
          <Link className="fundora-footer-brand" to="/"><span className="fundora-footer-logo" aria-hidden="true">F</span><span>Fundora<span className="fundora-footer-dot">.</span></span></Link>
          <p>{t('footer.description')}</p>
        </div>
        <nav className="fundora-footer-nav" aria-label={t('footer.navigationLabel')}><h2>{t('footer.navigation')}</h2><ul>{links.map((link) => <li key={link.to}><NavLink to={link.to} end={link.to === '/'}>{link.label}</NavLink></li>)}</ul></nav>
        <div className="fundora-footer-network"><h2>{t('footer.network')}</h2><p>{t('footer.ethereum')}</p><span>{t('footer.sepolia')}</span></div>
      </div>
      <div className="fundora-footer-bottom"><p>{t('footer.rights', { year: new Date().getFullYear() })}</p><p>{t('footer.preview')}</p></div>
    </footer>
  );
}
