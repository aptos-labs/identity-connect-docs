// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { WalletConnectionDataMap } from '@identity-connect/wallet-sdk';
import makeLocalStorageAppStateContext from './utils/makeLocalStorageAppStateContext.ts';

export interface WalletAccount {
  address: string;
  publicKeyB64: string;
  secretKeyB64: string;
}

export interface AppState {
  accounts: { [address: string]: WalletAccount };
  activeAccountAddress?: string;
  icWalletConnections: WalletConnectionDataMap;
}

const STORAGE_KEY_PREFIX = 'appState';
export const [AppStateContextProvider, useAppState] = makeLocalStorageAppStateContext<AppState>(STORAGE_KEY_PREFIX, {
  accounts: {},
  icWalletConnections: {},
});
