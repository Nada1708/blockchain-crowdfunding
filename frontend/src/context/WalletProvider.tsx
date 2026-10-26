import { BrowserProvider, formatUnits } from 'ethers';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { getReadContract } from '../services/blockchain';
import { WalletContext, type WalletError, type WalletNetworkError } from './wallet-context';

type EthereumProvider = {
  isMetaMask?: boolean;
  request: (request: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: 'accountsChanged' | 'chainChanged', listener: (...args: unknown[]) => void) => void;
  removeListener: (event: 'accountsChanged' | 'chainChanged', listener: (...args: unknown[]) => void) => void;
};

declare global { interface Window { ethereum?: EthereumProvider } }

const SEPOLIA_CHAIN_ID = 11155111;
const parseChainId = (value: unknown) => typeof value === 'string' ? Number.parseInt(value, 16) : typeof value === 'number' ? value : null;

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<WalletError>(null);
  const [networkError, setNetworkError] = useState<WalletNetworkError>(null);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [balanceResult, setBalanceResult] = useState<{ address: string; value: string | null } | null>(null);
  const [balanceRefresh, setBalanceRefresh] = useState(0);
  const locallyDisconnected = useRef(false);
  const connecting = useRef(false);
  const ethereum = window.ethereum;
  const isMetaMaskAvailable = Boolean(ethereum?.isMetaMask);

  useEffect(() => {
    if (!ethereum?.isMetaMask) return;
    let active = true;
    const readExistingConnection = async () => {
      try {
        const [accountsResult, chainResult] = await Promise.all([ethereum.request({ method: 'eth_accounts' }), ethereum.request({ method: 'eth_chainId' })]);
        if (!active) return;
        setAddress((accountsResult as string[])[0] ?? null);
        setChainId(parseChainId(chainResult));
      } catch { if (active) setError('connection'); }
    };
    const handleAccountsChanged = (...args: unknown[]) => { if (!locallyDisconnected.current) setAddress((args[0] as string[])[0] ?? null); };
    const handleChainChanged = (...args: unknown[]) => {
      setChainId(parseChainId(args[0]));
      setNetworkError(null);
    };
    void readExistingConnection();
    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);
    return () => { active = false; ethereum.removeListener('accountsChanged', handleAccountsChanged); ethereum.removeListener('chainChanged', handleChainChanged); };
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
      setAddress(accounts[0]);
      setChainId(Number(network.chainId));
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

      setChainId(parseChainId(await ethereum.request({ method: 'eth_chainId' })));
    } catch (caughtError) {
      const code = (caughtError as { code?: number | string }).code;
      setNetworkError(code === 4001 || code === 'ACTION_REJECTED' ? 'rejected' : 'failed');
    } finally {
      setIsSwitchingNetwork(false);
    }
  }, [ethereum, isSwitchingNetwork]);

  const disconnectLocal = useCallback(() => { locallyDisconnected.current = true; setAddress(null); setError(null); }, []);
  const refreshCfdBalance = useCallback(() => setBalanceRefresh((value) => value + 1), []);
  const cfdBalance = address && balanceResult?.address === address ? balanceResult.value : null;
  const isCfdBalanceLoading = Boolean(address && chainId === 31337 && balanceResult?.address !== address);
  return <WalletContext.Provider value={{ address, chainId, isMetaMaskAvailable, isConnecting, error, isSepolia: chainId === SEPOLIA_CHAIN_ID, cfdBalance, isCfdBalanceLoading, isSwitchingNetwork, networkError, connect, switchToHardhat, refreshCfdBalance, disconnectLocal, clearError: () => setError(null) }}>{children}</WalletContext.Provider>;
}
