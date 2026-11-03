import type { AuthSession } from '../services/auth';

export type ProtectedAccessState = 'loading' | 'allowed' | 'denied';

export function getProtectedAccessState(
  authLoading: boolean,
  walletReady: boolean,
  session: AuthSession | null,
  address: string | null,
  chainId: number | null,
): ProtectedAccessState {
  if (authLoading || !walletReady) return 'loading';
  if (!session || !address || chainId !== session.chainId || address.toLowerCase() !== session.address.toLowerCase()) return 'denied';
  return 'allowed';
}
