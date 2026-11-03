import { ArrowRight, CheckCircle2, Globe2, LogOut, Moon, ShieldCheck, Sun, WalletCards } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useWallet } from '../hooks/useWallet';
import fundoraLogo from '../assets/fundora-logo.png';
import './Welcome.css';

type WelcomeProps = { theme: 'light' | 'dark'; toggleTheme: () => void };

const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

export default function Welcome({ theme, toggleTheme }: WelcomeProps) {
  const navigate = useNavigate();
  const signInAttempted = useRef(false);
  const [showWalletChangeHelp, setShowWalletChangeHelp] = useState(false);
  const { t, i18n } = useTranslation();
  const { address, chainId, isMetaMaskAvailable, isWalletReady, hasExplicitConnection, isConnecting, connect, changeWallet, switchToHardhat, isSwitchingNetwork } = useWallet();
  const { session, isLoading, isSigningIn, isSigningOut, isRevoking, error, signIn, signOut, clearError } = useAuth();
  const isHardhat = chainId === 31337;
  const language = i18n.resolvedLanguage?.startsWith('fr') ? 'fr' : 'en';

  useEffect(() => {
    if (signInAttempted.current && session) navigate('/', { replace: true });
  }, [navigate, session]);

  const handleSignIn = () => {
    signInAttempted.current = true;
    void signIn();
  };

  const handleChangeWallet = async () => {
    const result = await changeWallet();
    setShowWalletChangeHelp(result === 'unsupported');
  };

  return (
    <div className="welcome-page">
      <div className="welcome-aurora" aria-hidden="true">
        <span className="welcome-halo welcome-halo-one" />
        <span className="welcome-halo welcome-halo-two" />
      </div>

      <header className="welcome-header">
        <Link to="/" className="welcome-brand" aria-label={t('auth.backHome')}>
          <img src={fundoraLogo} alt="Fundora — Blockchain Finance" />
        </Link>
        <div className="welcome-controls">
          <button type="button" className="welcome-control welcome-language" onClick={() => void i18n.changeLanguage(language === 'en' ? 'fr' : 'en')} aria-label={t('nav.language')} title={language === 'en' ? t('nav.french') : t('nav.english')}>
            <Globe2 size={18} aria-hidden="true" /><span>{language.toUpperCase()}</span>
          </button>
          <button type="button" className="welcome-control welcome-theme" onClick={toggleTheme} aria-label={theme === 'dark' ? t('nav.light') : t('nav.dark')} title={theme === 'dark' ? t('nav.lightTitle') : t('nav.darkTitle')}>
            {theme === 'dark' ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
          </button>
        </div>
      </header>

      <div className="welcome-main">
        <section className="welcome-shell" aria-labelledby="auth-title">
          <div className="auth-intro">
            <span className="auth-eyebrow"><ShieldCheck size={14} aria-hidden="true" />{t('auth.eyebrow')}</span>
            <h1 id="auth-title">{t('auth.title')}</h1>
            <p className="auth-lead">{t('auth.intro')}</p>
            <div className="auth-assurance">
              <span className="auth-assurance-icon"><ShieldCheck aria-hidden="true" /></span>
              <div><strong>{t('auth.noTransactionTitle')}</strong><span>{t('auth.noTransactionText')}</span></div>
            </div>
            <Link className="welcome-explore-link" to="/campaigns">{t('auth.exploreWithoutSigning')} <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>

          <div className="auth-card-wrap">
            <div className="auth-card" aria-busy={isLoading || isSigningIn || isSigningOut || isRevoking}>
              <div className="auth-card-heading">
                <div className={`auth-card-icon ${session ? 'is-success' : ''}`} aria-hidden="true">{session ? <CheckCircle2 /> : <WalletCards />}</div>
                <span className="auth-security-mark"><span />{t('auth.secureSession')}</span>
              </div>
              {isLoading ? (
                <><h2>{t('auth.loadingTitle')}</h2><p role="status">{t('auth.loading')}</p><span className="auth-loading-bar" aria-hidden="true" /></>
              ) : session ? (
                <>
                  <span className="auth-status is-authenticated">{t('auth.authenticated')}</span><h2>{t('auth.welcomeBack')}</h2>
                  <dl className="auth-session-details"><div><dt>{t('auth.address')}</dt><dd>{shortAddress(session.address)}</dd></div><div><dt>{t('auth.network')}</dt><dd>{t('auth.hardhat')}</dd></div></dl>
                  <button className="auth-button auth-button-secondary" type="button" onClick={() => void handleChangeWallet()} disabled={isRevoking}>{t('auth.changeWallet')}</button>
                  <button className="auth-button auth-button-secondary" type="button" onClick={() => void signOut()} disabled={isSigningOut}><LogOut size={18} aria-hidden="true" /> {isSigningOut ? t('auth.signingOut') : t('auth.signOut')}</button>
                  <p className="auth-footnote">{t('auth.walletStaysConnected')}</p>
                </>
              ) : !isMetaMaskAvailable ? (
                <><h2>{t('auth.walletMissingTitle')}</h2><p>{t('auth.walletMissing')}</p></>
              ) : !isWalletReady || !hasExplicitConnection || !address ? (
                <><h2>{t('auth.connectTitle')}</h2><p>{t('auth.connectText')}</p><button className="auth-button" type="button" onClick={() => void connect()} disabled={isConnecting || isRevoking}>{isConnecting ? t('wallet.connecting') : t('nav.connect')} <ArrowRight size={18} aria-hidden="true" /></button></>
              ) : !isHardhat ? (
                <><h2>{t('auth.networkTitle')}</h2><p>{t('auth.networkText')}</p><button className="auth-button" type="button" onClick={() => void switchToHardhat()} disabled={isSwitchingNetwork || isRevoking}>{isSwitchingNetwork ? t('networkSwitch.switching') : t('networkSwitch.button')}</button></>
              ) : (
                <><span className="auth-status">{t('auth.walletReady')}</span><h2>{t('auth.signInTitle')}</h2><p>{t('auth.signInText')}</p><div className="auth-wallet-summary"><span>{t('auth.address')}</span><strong>{shortAddress(address)}</strong></div><button className="auth-button" type="button" onClick={handleSignIn} disabled={isSigningIn || isRevoking}>{isSigningIn ? t('auth.signing') : t('auth.signIn')} <ShieldCheck size={18} aria-hidden="true" /></button><button className="auth-button auth-button-secondary" type="button" onClick={() => void handleChangeWallet()} disabled={isSigningIn || isRevoking}>{t('auth.changeWallet')}</button></>
              )}
              {showWalletChangeHelp && <p className="auth-footnote" role="note">{t('auth.changeWalletHelp')}</p>}
              {error && <div className="auth-error" role="alert"><span>{t(`auth.errors.${error}`)}</span><button type="button" onClick={clearError} aria-label={t('auth.dismiss')}>×</button></div>}
              <p className="auth-privacy-note"><ShieldCheck size={14} aria-hidden="true" />{t('auth.privacyNote')}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
