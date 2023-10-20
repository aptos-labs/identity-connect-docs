// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

export interface DappPairingData {
  accountAddress: string;
  accountAlias?: string;
  accountEd25519PublicKeyB64: string;
  accountTransportEd25519PublicKeyB64: string;
  currSequenceNumber: number;
  dappEd25519PublicKeyB64: string;
  dappEd25519SecretKeyB64: string;
  dappWalletId?: string;
  pairingId: string;
}

export type DappPairingDataMap = { [address: string]: DappPairingData };

export interface DappStateAccessors {
  get: (address: string) => Promise<DappPairingData | undefined>;
  getAll: () => Promise<DappPairingDataMap>;
  update: (address: string, pairing?: DappPairingData) => Promise<void>;
}

export const DAPP_PAIRINGS_WINDOW_STORAGE_KEY = 'icDappPairings';

/**
 * Default implementation of DappStateAccessors that uses the Window localStorage API.
 * This should work for most dapps.
 */
export const windowStateAccessors: DappStateAccessors = {
  async get(address: string) {
    const pairings = await this.getAll();
    return pairings[address];
  },
  async getAll() {
    const serialized = window.localStorage.getItem(DAPP_PAIRINGS_WINDOW_STORAGE_KEY);
    return serialized ? (JSON.parse(serialized) as DappPairingDataMap) : {};
  },
  async update(address: string, pairing?: DappPairingData) {
    const pairings = await this.getAll();
    if (pairing === undefined) {
      delete pairings[address];
    } else {
      pairings[address] = pairing;
    }
    const newSerialized = JSON.stringify(pairings);
    window.localStorage.setItem(DAPP_PAIRINGS_WINDOW_STORAGE_KEY, newSerialized);
  },
};
