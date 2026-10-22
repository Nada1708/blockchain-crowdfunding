import { createContext } from 'react';

export type WalletError = 'missing' | 'rejected' | 'requestPending' | 'connection' | null;

export type WalletContextValue = {
  address: string | null;
  chainId: number | null;
  isMetaMaskAvailable: boolean;
  isConnecting: boolean;
  error: WalletError;
  isSepolia: boolean;
  connect: () => Promise<void>;
  disconnectLocal: () => void;
  clearError: () => void;
};

export const WalletContext = createContext<WalletContextValue | null>(null);
