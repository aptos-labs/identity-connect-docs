// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { WalletConnectionDataMap, WalletStateAccessors } from '../state';

export function makeMockWalletState() {
  const mockWalletState = {
    pairings: {} as WalletConnectionDataMap,
  };
  const mockWalletStateAccessors: WalletStateAccessors = {
    get: async (address) => mockWalletState.pairings[address],
    getAll: async () => mockWalletState.pairings,
    update: async (address, pairing) => {
      if (pairing === undefined) {
        delete mockWalletState.pairings[address];
      } else {
        mockWalletState.pairings[address] = pairing;
      }
    },
  };
  return { mockWalletState, mockWalletStateAccessors };
}

export interface WrappedPromise<T> extends Promise<T> {
  pending: boolean;
  rejected: boolean;
  resolved: boolean;
}

/**
 * Utility to detect the state of a promise before awaiting it
 * @param promise
 */
export function wrapPromise<T>(promise: Promise<T>) {
  const wrapper = promise
    .then((result) => {
      wrapper.pending = false;
      wrapper.resolved = true;
      return result;
    })
    .catch((err) => {
      wrapper.pending = false;
      wrapper.rejected = true;
      throw err;
    }) as WrappedPromise<T>;
  wrapper.pending = true;
  wrapper.resolved = false;
  wrapper.rejected = false;
  return wrapper;
}
