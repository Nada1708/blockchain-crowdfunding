import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useWallet } from '../hooks/useWallet';
import { getProtectedAccessState } from './protected-route-state';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { session, isLoading } = useAuth();
  const { address, chainId, isWalletReady } = useWallet();
  const access = getProtectedAccessState(isLoading, isWalletReady, session, address, chainId);

  if (access === 'loading') return <div className="protected-route-loading" role="status" aria-live="polite" />;
  if (access === 'denied') return <Navigate to="/welcome" replace state={{ from: location.pathname }} />;
  return children;
}
