import { createContext } from 'react';
import type { AuthSession } from '../services/auth';

export type AuthError = 'api' | 'expired' | 'missingWallet' | 'wrongNetwork' | 'rejected' | 'walletMismatch' | null;

export type AuthContextValue = {
  session: AuthSession | null;
  isLoading: boolean;
  isSigningIn: boolean;
  isSigningOut: boolean;
  isRevoking: boolean;
  error: AuthError;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
