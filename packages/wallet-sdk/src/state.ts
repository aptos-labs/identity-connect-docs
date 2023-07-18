// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

export interface WalletConnectionAccount {
  address: string;
  ed25519PublicKeyB64: string;
  transportEd25519PublicKeyB64: string;
  transportEd25519SecretKeyB64: string;
  userSubmittedAlias?: string;
}

export interface WalletConnectionData {
  accounts: { [address: string]: WalletConnectionAccount };
  icEd25519PublicKeyB64: string;
  walletEd25519PublicKeyB64: string;
  walletEd25519SecretKeyB64: string;
  walletId: string;
}

export type WalletConnectionDataMap = { [walletId: string]: WalletConnectionData };

export interface WalletStateAccessors {
  get: (walletId: string) => Promise<WalletConnectionData | undefined>;
  getAll: () => Promise<WalletConnectionDataMap>;
  update: (walletId: string, pairing?: WalletConnectionData) => Promise<void>;
}

export const IC_WALLET_CONNECTIONS_WINDOW_STORAGE_KEY = 'icWalletConnections';

/**
 * Default implementation of WalletStateAccessors that uses the Window localStorage API.
 * Wallet developers are expected to provide their own implementation.
 */
export const windowStateAccessors: WalletStateAccessors = {
  async get(walletId: string) {
    const pairings = await this.getAll();
    return pairings[walletId];
  },
  async getAll() {
    const serialized = window.localStorage.getItem(IC_WALLET_CONNECTIONS_WINDOW_STORAGE_KEY);
    return serialized ? (JSON.parse(serialized) as WalletConnectionDataMap) : {};
  },
  async update(walletId: string, pairing?: WalletConnectionData) {
    const pairings = await this.getAll();
    if (pairing === undefined) {
      delete pairings[walletId];
    } else {
      pairings[walletId] = pairing;
    }
    const newSerialized = JSON.stringify(pairings);
    window.localStorage.setItem(IC_WALLET_CONNECTIONS_WINDOW_STORAGE_KEY, newSerialized);
  },
};
