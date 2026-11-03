import { BrowserProvider, formatUnits } from 'ethers';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { getReadContract } from '../services/blockchain';
import { WalletContext, type WalletError, type WalletNetworkError } from './wallet-context';
import { isWalletPermissionUnsupported } from './wallet-state';

type EthereumProvider = {
  isMetaMask?: boolean;
  request: (request: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: 'accountsChanged' | 'chainChanged' | 'disconnect', listener: (...args: unknown[]) => void) => void;
  removeListener: (event: 'accountsChanged' | 'chainChanged' | 'disconnect', listener: (...args: unknown[]) => void) => void;
};

declare global { interface Window { ethereum?: EthereumProvider } }

const SEPOLIA_CHAIN_ID = 11155111;
const parseChainId = (value: unknown) => typeof value === 'string' ? Number.parseInt(value, 16) : typeof value === 'number' ? value : null;

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isWalletReady, setIsWalletReady] = useState(!window.ethereum?.isMetaMask);
  const [hasExplicitConnection, setHasExplicitConnection] = useState(false);
  const [walletEventId, setWalletEventId] = useState(0);
  const [error, setError] = useState<WalletError>(null);
  const [networkError, setNetworkError] = useState<WalletNetworkError>(null);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [balanceResult, setBalanceResult] = useState<{ address: string; value: string | null } | null>(null);
  const [balanceRefresh, setBalanceRefresh] = useState(0);
  const locallyDisconnected = useRef(false);
  const connecting = useRef(false);
  const currentAddress = useRef(address);
  const currentChainId = useRef(chainId);
  const ethereum = window.ethereum;
  const isMetaMaskAvailable = Boolean(ethereum?.isMetaMask);

  useEffect(() => {
    currentAddress.current = address;
    currentChainId.current = chainId;
  }, [address, chainId]);

  useEffect(() => {
    if (!ethereum?.isMetaMask) return;
    let active = true;
    const readExistingConnection = async () => {
      try {
        const [accountsResult, chainResult] = await Promise.all([ethereum.request({ method: 'eth_accounts' }), ethereum.request({ method: 'eth_chainId' })]);
        if (!active) return;
        const initialAddress = (accountsResult as string[])[0] ?? null;
        const initialChainId = parseChainId(chainResult);
        currentAddress.current = initialAddress;
        currentChainId.current = initialChainId;
        setAddress(initialAddress);
        setChainId(initialChainId);
      } catch { if (active) setError('connection'); }
      finally { if (active) setIsWalletReady(true); }
    };
    const handleAccountsChanged = (...args: unknown[]) => {
      const nextAddress = (args[0] as string[])[0] ?? null;
      const changed = nextAddress?.toLowerCase() !== currentAddress.current?.toLowerCase();
      if (!locallyDisconnected.current) {
        currentAddress.current = nextAddress;
        setAddress(nextAddress);
        if (!nextAddress) setHasExplicitConnection(false);
      }
      if (changed) setWalletEventId((value) => value + 1);
    };
    const handleChainChanged = (...args: unknown[]) => {
      const nextChainId = parseChainId(args[0]);
      const changed = nextChainId !== currentChainId.current;
      currentChainId.current = nextChainId;
      setChainId(nextChainId);
      setNetworkError(null);
      if (changed) setWalletEventId((value) => value + 1);
    };
    const handleDisconnect = () => {
      currentAddress.current = null;
      currentChainId.current = null;
      setAddress(null);
      setChainId(null);
      setHasExplicitConnection(false);
      setWalletEventId((value) => value + 1);
    };
    void readExistingConnection();
    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);
    ethereum.on('disconnect', handleDisconnect);
    return () => { active = false; ethereum.removeListener('accountsChanged', handleAccountsChanged); ethereum.removeListener('chainChanged', handleChainChanged); ethereum.removeListener('disconnect', handleDisconnect); };
  }, [ethereum]);

  useEffect(() => {
    let active = true;
    if (!ethereum?.isMetaMask || !address || chainId !== 31337) {
      return;
    }

    const provider = new BrowserProvider(ethereum);
    void getReadContract('CFDToken', provider)
      .then((token) => token.balanceOf(address))
      .then((balance) => { if (active) setBalanceResult({ address, value: formatUnits(balance, 18) }); })
      .catch(() => { if (active) setBalanceResult({ address, value: null }); });

    return () => { active = false; };
  }, [address, chainId, ethereum, balanceRefresh]);

  const connect = useCallback(async () => {
    if (connecting.current) return;
    if (!ethereum?.isMetaMask) { setError('missing'); return; }
    connecting.current = true;
    locallyDisconnected.current = false;
    setIsConnecting(true);
    setError(null);
    try {
      const provider = new BrowserProvider(ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      if (!accounts[0]) throw new Error('No account returned');
      const network = await provider.getNetwork();
      currentAddress.current = accounts[0];
      currentChainId.current = Number(network.chainId);
      setAddress(accounts[0]);
      setChainId(Number(network.chainId));
      setHasExplicitConnection(true);
    } catch (caughtError) {
      const code = (caughtError as { code?: number }).code;
      setError(code === 4001 ? 'rejected' : code === -32002 ? 'requestPending' : 'connection');
      setAddress(null);
    } finally { connecting.current = false; setIsConnecting(false); }
  }, [ethereum]);

  const switchToHardhat = useCallback(async () => {
    if (!ethereum?.isMetaMask || isSwitchingNetwork) return;
    setIsSwitchingNetwork(true);
    setNetworkError(null);

    try {
      try {
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x7a69' }],
        });
      } catch (switchError) {
        const code = (switchError as { code?: number }).code;
        if (code !== 4902) throw switchError;

        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x7a69',
            chainName: 'Fundora Hardhat Local',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['http://127.0.0.1:8545'],
          }],
        });
      }

      const nextChainId = parseChainId(await ethereum.request({ method: 'eth_chainId' }));
      currentChainId.current = nextChainId;
      setChainId(nextChainId);
    } catch (caughtError) {
      const code = (caughtError as { code?: number | string }).code;
      setNetworkError(code === 4001 || code === 'ACTION_REJECTED' ? 'rejected' : 'failed');
    } finally {
      setIsSwitchingNetwork(false);
    }
  }, [ethereum, isSwitchingNetwork]);

  const changeWallet = useCallback(async () => {
    if (!ethereum?.isMetaMask) return 'unsupported' as const;
    setError(null);
    try {
      await ethereum.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
      const [accountsResult, chainResult] = await Promise.all([
        ethereum.request({ method: 'eth_accounts' }),
        ethereum.request({ method: 'eth_chainId' }),
      ]);
      const nextAddress = (accountsResult as string[])[0] ?? null;
      const nextChainId = parseChainId(chainResult);
      const accountChanged = nextAddress?.toLowerCase() !== currentAddress.current?.toLowerCase();
      const networkChanged = nextChainId !== currentChainId.current;
      currentAddress.current = nextAddress;
      currentChainId.current = nextChainId;
      locallyDisconnected.current = false;
      setAddress(nextAddress);
      setChainId(nextChainId);
      setHasExplicitConnection(Boolean(nextAddress));
      if (accountChanged || networkChanged) setWalletEventId((value) => value + 1);
      return 'changed' as const;
    } catch (caughtError) {
      if (isWalletPermissionUnsupported(caughtError)) return 'unsupported' as const;
      const code = (caughtError as { code?: number | string }).code;
      if (code === 4001 || code === 'ACTION_REJECTED') return 'rejected' as const;
      setError('connection');
      return 'rejected' as const;
    }
  }, [ethereum]);

  const disconnectLocal = useCallback(() => { locallyDisconnected.current = true; currentAddress.current = null; setAddress(null); setHasExplicitConnection(false); setWalletEventId((value) => value + 1); setError(null); }, []);
  const refreshCfdBalance = useCallback(() => setBalanceRefresh((value) => value + 1), []);
  const cfdBalance = address && balanceResult?.address === address ? balanceResult.value : null;
  const isCfdBalanceLoading = Boolean(address && chainId === 31337 && balanceResult?.address !== address);
  return <WalletContext.Provider value={{ address, chainId, isMetaMaskAvailable, isWalletReady, hasExplicitConnection, walletEventId, isConnecting, error, isSepolia: chainId === SEPOLIA_CHAIN_ID, cfdBalance, isCfdBalanceLoading, isSwitchingNetwork, networkError, connect, changeWallet, switchToHardhat, refreshCfdBalance, disconnectLocal, clearError: () => setError(null) }}>{children}</WalletContext.Provider>;
}
