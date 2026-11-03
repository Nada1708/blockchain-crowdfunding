import { createContext } from 'react';

export type WalletError = 'missing' | 'rejected' | 'requestPending' | 'connection' | null;
export type WalletNetworkError = 'rejected' | 'failed' | null;

export type WalletContextValue = {
  address: string | null;
  chainId: number | null;
  isMetaMaskAvailable: boolean;
  isWalletReady: boolean;
  hasExplicitConnection: boolean;
  walletEventId: number;
  isConnecting: boolean;
  error: WalletError;
  isSepolia: boolean;
  cfdBalance: string | null;
  isCfdBalanceLoading: boolean;
  isSwitchingNetwork: boolean;
  networkError: WalletNetworkError;
  connect: () => Promise<void>;
  changeWallet: () => Promise<'changed' | 'unsupported' | 'rejected'>;
  switchToHardhat: () => Promise<void>;
  refreshCfdBalance: () => void;
  disconnectLocal: () => void;
  clearError: () => void;
};

export const WalletContext = createContext<WalletContextValue | null>(null);
