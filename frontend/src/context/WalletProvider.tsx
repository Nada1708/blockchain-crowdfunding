import { BrowserProvider } from 'ethers';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { WalletContext, type WalletError } from './wallet-context';

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
    const handleChainChanged = (...args: unknown[]) => setChainId(parseChainId(args[0]));
    void readExistingConnection();
    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);
    return () => { active = false; ethereum.removeListener('accountsChanged', handleAccountsChanged); ethereum.removeListener('chainChanged', handleChainChanged); };
  }, [ethereum]);

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

  const disconnectLocal = useCallback(() => { locallyDisconnected.current = true; setAddress(null); setError(null); }, []);
  return <WalletContext.Provider value={{ address, chainId, isMetaMaskAvailable, isConnecting, error, isSepolia: chainId === SEPOLIA_CHAIN_ID, connect, disconnectLocal, clearError: () => setError(null) }}>{children}</WalletContext.Provider>;
}
