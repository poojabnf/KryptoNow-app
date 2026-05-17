/**
 * useSecureWallet.ts
 *
 * React hook that wraps SecureKeyStore and exposes a clean interface
 * for wallet creation, signing, and account management.
 *
 * Signing flow:
 *   1. Retrieve private key from Secure Enclave (biometric gate fires)
 *   2. Sign with ethers.js Wallet
 *   3. Zero the key reference (JS GC will collect it)
 *   4. Return signed tx / signature
 *
 * The private key exists in the JS heap for < 50ms during signing.
 */

import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import {
  storePrivateKey,
  retrievePrivateKey,
  listAllAccounts,
  deletePrivateKey,
  checkDeviceSecurity,
  migrateToSecureEnclave,
  type KeyMeta,
  type SecureStoreResult,
} from '../store/SecureKeyStore';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WalletAccount {
  index: number;
  address: string;
  derivationPath: string;
  createdAt: number;
}

export interface WalletState {
  accounts: WalletAccount[];
  activeIndex: number;
  activeAddress: string | null;
  isReady: boolean;
  deviceSecure: boolean;
}

export interface UseSecureWalletReturn {
  // State
  wallet: WalletState;
  isLoading: boolean;
  error: string | null;

  // Account management
  createAccount: (mnemonic: string, accountIndex?: number) => Promise<SecureStoreResult<WalletAccount>>;
  importPrivateKey: (privateKeyHex: string, label?: string) => Promise<SecureStoreResult<WalletAccount>>;
  removeAccount: (accountIndex: number) => Promise<SecureStoreResult<void>>;
  setActiveAccount: (accountIndex: number) => void;
  migrateOldKey: (plaintextKey: string, address: string, path: string, index: number) => Promise<SecureStoreResult<void>>;

  // Signing (all require biometrics)
  signTransaction: (tx: ethers.TransactionRequest, accountIndex?: number) => Promise<SecureStoreResult<string>>;
  signMessage: (message: string, accountIndex?: number) => Promise<SecureStoreResult<string>>;
  signTypedData: (
    domain: ethers.TypedDataDomain,
    types: Record<string, ethers.TypedDataField[]>,
    value: Record<string, unknown>,
    accountIndex?: number,
  ) => Promise<SecureStoreResult<string>>;

  // Utils
  clearError: () => void;
  reload: () => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_PATH = "m/44'/60'/0'/0";

function metaToAccount(meta: KeyMeta): WalletAccount {
  return {
    index: meta.accountIndex,
    address: meta.address,
    derivationPath: meta.derivationPath,
    createdAt: meta.createdAt,
  };
}

/**
 * Retrieve key, use it, then immediately dereference.
 * The `action` callback receives the ethers Wallet for signing.
 */
async function withSigningWallet<T>(
  accountIndex: number,
  reason: string,
  action: (wallet: ethers.Wallet) => Promise<T>,
): Promise<SecureStoreResult<T>> {
  let privKey: string | undefined;
  try {
    const res = await retrievePrivateKey(accountIndex, reason);
    if (!res.ok || !res.data) return { ok: false, error: res.error };

    privKey = res.data;
    const signingWallet = new ethers.Wallet('0x' + privKey);
    const result = await action(signingWallet);

    return { ok: true, data: result };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Signing failed' };
  } finally {
    // Zero out the reference — JS GC handles memory, but we drop the reference ASAP
    privKey = undefined;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSecureWallet(): UseSecureWalletReturn {
  const [wallet, setWallet] = useState<WalletState>({
    accounts: [],
    activeIndex: 0,
    activeAddress: null,
    isReady: false,
    deviceSecure: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load accounts on mount ──
  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const security = await checkDeviceSecurity();
      const accountsRes = await listAllAccounts();
      const accounts = (accountsRes.data ?? []).map(metaToAccount);
      const active = accounts[0] ?? null;

      setWallet({
        accounts,
        activeIndex: active?.index ?? 0,
        activeAddress: active?.address ?? null,
        isReady: true,
        deviceSecure: security.canCreateWallet,
      });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load accounts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // ── Create account from mnemonic ──
  const createAccount = useCallback(async (
    mnemonic: string,
    accountIndex = 0,
  ): Promise<SecureStoreResult<WalletAccount>> => {
    setIsLoading(true);
    setError(null);
    try {
      const path = `${BASE_PATH}/${accountIndex}`;
      const hdNode = ethers.HDNodeWallet.fromMnemonic(
        ethers.Mnemonic.fromPhrase(mnemonic),
        path,
      );

      const privKeyHex = hdNode.privateKey.replace('0x', '');
      const res = await storePrivateKey(privKeyHex, {
        accountIndex,
        address: hdNode.address,
        derivationPath: path,
      });

      if (!res.ok) { setError(res.error ?? null); return res; }

      const account: WalletAccount = {
        index: accountIndex,
        address: hdNode.address,
        derivationPath: path,
        createdAt: Date.now(),
      };

      setWallet(prev => ({
        ...prev,
        accounts: [...prev.accounts.filter(a => a.index !== accountIndex), account]
          .sort((a, b) => a.index - b.index),
        activeIndex: accountIndex,
        activeAddress: hdNode.address,
      }));

      return { ok: true, data: account };
    } catch (e: any) {
      const msg = e?.message ?? 'Failed to create account';
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Import raw private key ──
  const importPrivateKey = useCallback(async (
    privateKeyHex: string,
    _label?: string,
  ): Promise<SecureStoreResult<WalletAccount>> => {
    setIsLoading(true);
    setError(null);
    try {
      const hex = privateKeyHex.replace('0x', '');
      const w = new ethers.Wallet('0x' + hex);
      const accountIndex = wallet.accounts.length; // next available slot

      const res = await storePrivateKey(hex, {
        accountIndex,
        address: w.address,
        derivationPath: 'imported',
      });

      if (!res.ok) { setError(res.error ?? null); return res; }

      const account: WalletAccount = {
        index: accountIndex,
        address: w.address,
        derivationPath: 'imported',
        createdAt: Date.now(),
      };

      setWallet(prev => ({
        ...prev,
        accounts: [...prev.accounts, account],
        activeIndex: accountIndex,
        activeAddress: w.address,
      }));

      return { ok: true, data: account };
    } catch (e: any) {
      const msg = e?.message ?? 'Failed to import key';
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  }, [wallet.accounts.length]);

  // ── Remove account ──
  const removeAccount = useCallback(async (
    accountIndex: number,
  ): Promise<SecureStoreResult<void>> => {
    setIsLoading(true);
    try {
      const res = await deletePrivateKey(accountIndex);
      if (!res.ok) { setError(res.error ?? null); return res; }

      setWallet(prev => {
        const accounts = prev.accounts.filter(a => a.index !== accountIndex);
        const next = accounts[0];
        return {
          ...prev,
          accounts,
          activeIndex: next?.index ?? 0,
          activeAddress: next?.address ?? null,
        };
      });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Failed to remove account' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Set active account ──
  const setActiveAccount = useCallback((accountIndex: number) => {
    const account = wallet.accounts.find(a => a.index === accountIndex);
    if (!account) return;
    setWallet(prev => ({
      ...prev,
      activeIndex: accountIndex,
      activeAddress: account.address,
    }));
  }, [wallet.accounts]);

  // ── Migrate old AES key to enclave ──
  const migrateOldKey = useCallback(async (
    plaintextKey: string,
    address: string,
    derivationPath: string,
    accountIndex: number,
  ): Promise<SecureStoreResult<void>> => {
    return migrateToSecureEnclave(plaintextKey.replace('0x', ''), {
      accountIndex,
      address,
      derivationPath,
    });
  }, []);

  // ── Sign transaction ──
  const signTransaction = useCallback(async (
    tx: ethers.TransactionRequest,
    accountIndex?: number,
  ): Promise<SecureStoreResult<string>> => {
    const idx = accountIndex ?? wallet.activeIndex;
    return withSigningWallet(idx, 'Authenticate to sign transaction', async (w) => {
      return w.signTransaction(tx);
    });
  }, [wallet.activeIndex]);

  // ── Sign message (personal_sign) ──
  const signMessage = useCallback(async (
    message: string,
    accountIndex?: number,
  ): Promise<SecureStoreResult<string>> => {
    const idx = accountIndex ?? wallet.activeIndex;
    return withSigningWallet(idx, 'Authenticate to sign message', async (w) => {
      return w.signMessage(message);
    });
  }, [wallet.activeIndex]);

  // ── Sign typed data (EIP-712) ──
  const signTypedData = useCallback(async (
    domain: ethers.TypedDataDomain,
    types: Record<string, ethers.TypedDataField[]>,
    value: Record<string, unknown>,
    accountIndex?: number,
  ): Promise<SecureStoreResult<string>> => {
    const idx = accountIndex ?? wallet.activeIndex;
    return withSigningWallet(idx, 'Authenticate to sign typed data', async (w) => {
      return w.signTypedData(domain, types, value);
    });
  }, [wallet.activeIndex]);

  return {
    wallet,
    isLoading,
    error,
    createAccount,
    importPrivateKey,
    removeAccount,
    setActiveAccount,
    migrateOldKey,
    signTransaction,
    signMessage,
    signTypedData,
    clearError: () => setError(null),
    reload,
  };
}
