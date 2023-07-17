// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { DappPairingDataMap } from '@identity-connect/dapp-sdk';
import makeLocalStorageAppStateContext from './utils/makeLocalStorageAppStateContext.ts';

export interface AppState {
  activeAccountAddress?: string;
  icPairings: DappPairingDataMap;
}

const STORAGE_KEY_PREFIX = 'appState';
export const [AppStateContextProvider, useAppState] = makeLocalStorageAppStateContext<AppState>(STORAGE_KEY_PREFIX, {
  icPairings: {},
});
