import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import './Navbar.css';

type NavbarProps = { theme: 'light' | 'dark'; toggleTheme: () => void };

export default function Navbar({ theme, toggleTheme }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const { address, chainId, isMetaMaskAvailable, isConnecting, error, cfdBalance, isCfdBalanceLoading, isSwitchingNetwork, networkError, connect, switchToHardhat, disconnectLocal, clearError } = useWallet();
  const language = i18n.resolvedLanguage?.startsWith('fr') ? 'fr' : 'en';
  const links = [
    { label: t('nav.home'), to: '/' },
    { label: t('nav.campaigns'), to: '/campaigns' },
    { label: t('nav.create'), to: '/create' },
    { label: t('nav.governance'), to: '/governance' },
  ];
  const shortAddress = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '';
  const isHardhatLocal = chainId === 31337;
  const networkLabel = chainId === 11155111 ? t('wallet.sepolia') : isHardhatLocal ? t('onchain.wallet.hardhatLocal') : chainId ? t('wallet.chain', { id: chainId }) : t('wallet.unknownNetwork');

  const handleWalletClick = () => {
    if (address) {
      setWalletOpen((open) => !open);
      return;
    }
    clearError();
    setWalletOpen(true);
    void connect();
  };

  return (
    <header className="fundora-navbar">
      <Link to="/" className="fundora-brand" onClick={() => setMenuOpen(false)}>
        <span className="fundora-logo-placeholder" aria-hidden="true">F</span>
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
        <button type="button" className="wallet-button" onClick={handleWalletClick} disabled={isConnecting} aria-expanded={address ? walletOpen : undefined} aria-controls={address ? 'wallet-panel' : undefined} title={address ? t('wallet.connectedAs', { address: shortAddress }) : t('wallet.connectTitle')}>
          {isConnecting ? t('wallet.connecting') : address ? shortAddress : t('nav.connect')}
        </button>
        {((address && walletOpen) || error) && (
          <div id="wallet-panel" className="wallet-panel" role="status">
            {error ? (
              <p className="wallet-error">{t(`wallet.errors.${error}`)}</p>
            ) : address ? (
              <>
                <div className="wallet-panel-row"><span>{t('wallet.network')}</span><strong className={isHardhatLocal ? '' : 'is-warning'}>{networkLabel}</strong></div>
                {!isHardhatLocal && <><p className="wallet-warning">{t('networkSwitch.wrongNetwork')}</p><button type="button" className="wallet-network-switch" onClick={() => void switchToHardhat()} disabled={isSwitchingNetwork}>{isSwitchingNetwork ? t('networkSwitch.switching') : t('networkSwitch.button')}</button></>}
                {networkError && <p className="wallet-error wallet-network-error" role="alert">{t(`networkSwitch.errors.${networkError}`)}</p>}
                {isHardhatLocal && <div className="wallet-panel-row wallet-balance"><span>{t('onchain.wallet.cfdBalance')}</span><strong>{isCfdBalanceLoading ? t('onchain.wallet.balanceLoading') : `${cfdBalance ?? '—'} CFD`}</strong></div>}
                <p className="wallet-local-note">{t('wallet.localNote')}</p>
                <button type="button" className="wallet-disconnect" onClick={() => { disconnectLocal(); setWalletOpen(false); }}>{t('wallet.disconnect')}</button>
              </>
            ) : !isMetaMaskAvailable ? (
              <p className="wallet-error">{t('wallet.errors.missing')}</p>
            ) : null}
          </div>
        )}
        <button type="button" className="mobile-menu-toggle" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-controls="fundora-navigation" aria-label={menuOpen ? t('nav.close') : t('nav.open')}>
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>
    </header>
  );
}
