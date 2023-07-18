// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import {
  ed25519KeypairFromSecret,
  Ed25519PublicKey,
  Ed25519SecretKey,
  encryptAndSignEnvelope,
} from '@identity-connect/crypto';
import { DappPairingDataMap, DappStateAccessors } from '../state';

export function makeMockDappState() {
  const mockDappState = {
    pairings: {} as DappPairingDataMap,
  };
  const mockDappStateAccessors: DappStateAccessors = {
    get: async (address) => mockDappState.pairings[address],
    update: async (address, pairing) => {
      if (pairing === undefined) {
        delete mockDappState.pairings[address];
      } else {
        mockDappState.pairings[address] = pairing;
      }
    },
  };
  return { mockDappState, mockDappStateAccessors };
}

export async function makeResponseEnvelope(
  accountSecretKey: Ed25519SecretKey,
  dappPublicKey: Ed25519PublicKey,
  body: any,
) {
  const accountPublicKey = ed25519KeypairFromSecret(accountSecretKey.key).publicKey;
  return encryptAndSignEnvelope(accountSecretKey, accountPublicKey, dappPublicKey, 0, {}, body);
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
