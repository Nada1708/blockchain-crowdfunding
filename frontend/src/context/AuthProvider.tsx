import { BrowserProvider, getAddress } from 'ethers';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useWallet } from '../hooks/useWallet';
import { authService, type AuthSession } from '../services/auth';
import { AuthContext, type AuthError } from './auth-context';
import { confirmSessionRevocation, revalidateSessionExpiry, visibleWalletSession } from './auth-state';

const SIWE_CHAIN_ID = Number(import.meta.env.VITE_SIWE_CHAIN_ID ?? 31337);
const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

function allowedOrigin() {
  const configured = (import.meta.env.VITE_SIWE_ALLOWED_ORIGINS ?? DEFAULT_ORIGINS.join(','))
    .split(',')
    .map((value: string) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return configured.includes(window.location.origin) ? window.location.origin : null;
}

function rejected(error: unknown) {
  const code = (error as { code?: number | string }).code;
  return code === 4001 || code === 'ACTION_REJECTED';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { address, chainId, isMetaMaskAvailable, isWalletReady, walletEventId, disconnectLocal } = useWallet();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isExpiryValidating, setIsExpiryValidating] = useState(false);
  const [handledWalletEventId, setHandledWalletEventId] = useState(0);
  const [error, setError] = useState<AuthError>(null);
  const signingIn = useRef(false);
  const signingOut = useRef(false);
  const revoking = useRef(false);
  const revocationVersion = useRef(0);
  const authVersion = useRef(0);
  const expiryValidationPending = useRef(false);
  const mounted = useRef(true);
  const currentWallet = useRef({ address, chainId });

  useEffect(() => {
    currentWallet.current = { address, chainId };
  }, [address, chainId]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      revocationVersion.current += 1;
      authVersion.current += 1;
    };
  }, []);

  const beginRevocation = useCallback(() => {
    if (revoking.current) return;
    authVersion.current += 1;
    const version = ++revocationVersion.current;
    revoking.current = true;
    setIsRevoking(true);
    void confirmSessionRevocation(
      authService.logout,
      () => mounted.current && revocationVersion.current === version,
    ).then((result) => {
      if (result === 'confirmed' && mounted.current && revocationVersion.current === version) {
        setSession(null);
        setError(null);
      }
    }).finally(() => {
      if (!mounted.current || revocationVersion.current !== version) return;
      revoking.current = false;
      setIsRevoking(false);
    });
  }, []);

  const refreshSession = useCallback(async () => {
    const version = ++authVersion.current;
    setIsLoading(true);
    try {
      const result = await authService.session();
      if (!mounted.current || authVersion.current !== version) return;
      setSession(result.authenticated ? result : null);
      setError(null);
    } catch {
      if (!mounted.current || authVersion.current !== version) return;
      setSession(null);
      setError('api');
    } finally {
      if (mounted.current && authVersion.current === version) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const version = ++authVersion.current;
    void authService.session()
      .then((result) => {
        if (!active || authVersion.current !== version) return;
        setSession(result.authenticated ? result : null);
        setError(null);
      })
      .catch(() => { if (active && authVersion.current === version) setError('api'); })
      .finally(() => { if (active && authVersion.current === version) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (isLoading || walletEventId === 0 || walletEventId <= handledWalletEventId || revoking.current) return;
    setHandledWalletEventId(walletEventId);
    if (session) beginRevocation();
  }, [beginRevocation, handledWalletEventId, isLoading, session, walletEventId]);

  useEffect(() => {
    if (!session) return;
    const expiresAt = Math.min(Date.parse(session.idleExpiresAt), Date.parse(session.absoluteExpiresAt));
    const delay = Math.max(0, expiresAt - Date.now());
    const timeout = window.setTimeout(() => {
      if (expiryValidationPending.current) return;
      expiryValidationPending.current = true;
      const version = ++authVersion.current;
      const expiredSession = session;
      setIsExpiryValidating(true);
      void revalidateSessionExpiry(
        authService.session,
        () => mounted.current && authVersion.current === version && currentWallet.current.address?.toLowerCase() === expiredSession.address.toLowerCase() && currentWallet.current.chainId === expiredSession.chainId,
      ).then((result) => {
        if (result.status === 'stale') return;
        if (result.status === 'valid') {
          setSession(result.session);
          setError(null);
        } else {
          setSession(null);
          setError(result.status === 'expired' ? 'expired' : 'api');
        }
      }).finally(() => {
        expiryValidationPending.current = false;
        if (mounted.current) setIsExpiryValidating(false);
      });
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [session]);

  const visibleSession = visibleWalletSession(session, isWalletReady, address, chainId, isRevoking || isExpiryValidating);
  const visibleError = session && !isExpiryValidating && !visibleSession ? 'walletMismatch' : error;
  const revocationPending = Boolean(session && walletEventId > handledWalletEventId);

  const signIn = useCallback(async () => {
    if (signingIn.current || revoking.current || walletEventId > handledWalletEventId) return;
    if (!isMetaMaskAvailable || !window.ethereum) { setError('missingWallet'); return; }
    if (!address || chainId !== SIWE_CHAIN_ID) { setError('wrongNetwork'); return; }
    const origin = allowedOrigin();
    if (!origin) { setError('api'); return; }

    signingIn.current = true;
    authVersion.current += 1;
    setIsSigningIn(true);
    setError(null);
    const expectedAddress = address.toLowerCase();
    const walletIsCurrent = () => currentWallet.current.address?.toLowerCase() === expectedAddress
      && currentWallet.current.chainId === SIWE_CHAIN_ID;
    let verified = false;
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const signerAddress = getAddress(await signer.getAddress());
      if (signerAddress.toLowerCase() !== address.toLowerCase()) throw new Error('Wallet changed');
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== SIWE_CHAIN_ID) { setError('wrongNetwork'); return; }

      const { nonce } = await authService.nonce();
      const issuedAt = new Date();
      const expirationTime = new Date(issuedAt.getTime() + 4 * 60 * 1_000);
      const domain = new URL(origin).host;
      const message = `${domain} wants you to sign in with your Ethereum account:\n${signerAddress}\n\nSign in to Fundora. This signature does not create a blockchain transaction.\n\nURI: ${origin}\nVersion: 1\nChain ID: ${SIWE_CHAIN_ID}\nNonce: ${nonce}\nIssued At: ${issuedAt.toISOString()}\nExpiration Time: ${expirationTime.toISOString()}`;
      const signature = await signer.signMessage(message);
      if (!walletIsCurrent()) throw new Error('Wallet changed');
      await authService.verify(message, signature);
      verified = true;
      const result = await authService.session();
      if (!result.authenticated || result.address.toLowerCase() !== signerAddress.toLowerCase() || result.chainId !== SIWE_CHAIN_ID) {
        throw new Error('Session mismatch');
      }
      if (!walletIsCurrent()) throw new Error('Wallet changed');
      setSession(result);
      setError(null);
    } catch (caughtError) {
      if (verified) beginRevocation();
      setError(rejected(caughtError) ? 'rejected' : walletIsCurrent() ? 'api' : 'walletMismatch');
    } finally {
      signingIn.current = false;
      setIsSigningIn(false);
    }
  }, [address, beginRevocation, chainId, handledWalletEventId, isMetaMaskAvailable, walletEventId]);

  const signOut = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    authVersion.current += 1;
    setIsSigningOut(true);
    setError(null);
    try {
      await authService.logout();
      setSession(null);
      disconnectLocal();
    } catch {
      setError('api');
    } finally {
      signingOut.current = false;
      setIsSigningOut(false);
    }
  }, [disconnectLocal]);

  return <AuthContext.Provider value={{ session: visibleSession, isLoading: isLoading || !isWalletReady || isExpiryValidating, isSigningIn, isSigningOut, isRevoking: isRevoking || revocationPending, error: visibleError, signIn, signOut, refreshSession, clearError: () => setError(null) }}>{children}</AuthContext.Provider>;
}
