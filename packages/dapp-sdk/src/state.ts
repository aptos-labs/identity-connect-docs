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
  pairingId: string;
}

export type DappPairingDataMap = { [address: string]: DappPairingData };

export interface DappStateAccessors {
  get: (address: string) => Promise<DappPairingData | undefined>;
  update: (address: string, pairing?: DappPairingData) => Promise<void>;
}

export const DAPP_PAIRINGS_WINDOW_STORAGE_KEY = 'icDappPairings';

/**
 * Default implementation of DappStateAccessors that uses the Window localStorage API.
 * This should work for most dapps.
 */
export const windowStateAccessors: DappStateAccessors = {
  get: async (address: string) => {
    const serialized = window.localStorage.getItem(DAPP_PAIRINGS_WINDOW_STORAGE_KEY);
    const pairings = serialized ? (JSON.parse(serialized) as DappPairingDataMap) : {};
    return pairings[address];
  },
  update: async (address: string, pairing?: DappPairingData) => {
    const serialized = window.localStorage.getItem(DAPP_PAIRINGS_WINDOW_STORAGE_KEY);
    const pairings = serialized ? (JSON.parse(serialized) as DappPairingDataMap) : {};
    if (pairing === undefined) {
      delete pairings[address];
    } else {
      pairings[address] = pairing;
    }
    const newSerialized = JSON.stringify(pairings);
    window.localStorage.setItem(DAPP_PAIRINGS_WINDOW_STORAGE_KEY, newSerialized);
  },
};
