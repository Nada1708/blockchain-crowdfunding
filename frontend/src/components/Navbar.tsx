import { Moon, Sun, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';
import fundoraIcon from '../assets/fundora-icon.png';
import './Navbar.css';

type NavbarProps = { theme: 'light' | 'dark'; toggleTheme: () => void };

export default function Navbar({ theme, toggleTheme }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage?.startsWith('fr') ? 'fr' : 'en';
  const links = [
    { label: t('nav.home'), to: '/' },
    { label: t('nav.campaigns'), to: '/campaigns' },
    { label: t('nav.create'), to: '/create' },
    { label: t('nav.governance'), to: '/governance' },
  ];

  return (
    <header className="fundora-navbar">
      <Link to="/" className="fundora-brand" onClick={() => setMenuOpen(false)}>
        <img className="fundora-brand-icon" src={fundoraIcon} alt="" aria-hidden="true" />
        <span>Fundora<span className="fundora-dot">.</span></span>
      </Link>
      <nav id="fundora-navigation" className={`fundora-nav ${menuOpen ? 'is-open' : ''}`} aria-label={t('nav.label')}>
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.to === '/'} onClick={() => setMenuOpen(false)}>{link.label}</NavLink>
        ))}
      </nav>
      <div className="fundora-actions">
        <button
          type="button"
          className="language-toggle"
          onClick={() => void i18n.changeLanguage(language === 'en' ? 'fr' : 'en')}
          aria-label={t('nav.language')}
          title={language === 'en' ? t('nav.french') : t('nav.english')}
        >
          <span>{language.toUpperCase()}</span>
        </button>
        <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={theme === 'dark' ? t('nav.light') : t('nav.dark')} title={theme === 'dark' ? t('nav.lightTitle') : t('nav.darkTitle')}>
          {theme === 'dark' ? <Sun size={20} strokeWidth={1.8} /> : <Moon size={20} strokeWidth={1.8} />}
        </button>
        <Link className="account-button" to="/welcome" aria-label={t('nav.account')} title={t('nav.account')} onClick={() => setMenuOpen(false)}>
          <UserRound size={20} strokeWidth={1.9} aria-hidden="true" />
        </Link>
        <button type="button" className="mobile-menu-toggle" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-controls="fundora-navigation" aria-label={menuOpen ? t('nav.close') : t('nav.open')}>
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>
    </header>
  );
}
