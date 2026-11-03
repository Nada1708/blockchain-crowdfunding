import type { AuthSession } from '../services/auth';
import type { SessionResponse } from '../services/auth';

export type SessionExpiryResult =
  | { status: 'valid'; session: AuthSession }
  | { status: 'expired' }
  | { status: 'temporary-error' }
  | { status: 'stale' };

export async function revalidateSessionExpiry(
  loadSession: () => Promise<SessionResponse>,
  isCurrent: () => boolean,
): Promise<SessionExpiryResult> {
  try {
    const result = await loadSession();
    if (!isCurrent()) return { status: 'stale' };
    return result.authenticated
      ? { status: 'valid', session: result }
      : { status: 'expired' };
  } catch {
    return isCurrent() ? { status: 'temporary-error' } : { status: 'stale' };
  }
}

export function sessionMatchesWallet(session: AuthSession, address: string | null, chainId: number | null) {
  return Boolean(address && chainId === session.chainId && address.toLowerCase() === session.address.toLowerCase());
}

export function shouldRevokeForWalletChange(session: AuthSession | null, walletReady: boolean, address: string | null, chainId: number | null) {
  return Boolean(session && walletReady && !sessionMatchesWallet(session, address, chainId));
}

export function visibleWalletSession(
  session: AuthSession | null,
  walletReady: boolean,
  address: string | null,
  chainId: number | null,
  revoking: boolean,
) {
  return session && walletReady && !revoking && sessionMatchesWallet(session, address, chainId) ? session : null;
}

export async function confirmSessionRevocation(
  logout: () => Promise<unknown>,
  isCurrent: () => boolean,
  retryDelayMs = 750,
): Promise<'confirmed' | 'cancelled'> {
  while (isCurrent()) {
    try {
      await logout();
      return isCurrent() ? 'confirmed' : 'cancelled';
    } catch {
      if (!isCurrent()) return 'cancelled';
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  return 'cancelled';
}
