// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { DappPairingDataMap } from '@identity-connect/dapp-sdk';
import { NetworkName } from '@identity-connect/api';
import makeLocalStorageAppStateContext from './utils/makeLocalStorageAppStateContext.ts';

export interface AppState {
  activeAccountAddress?: string;
  icPairings: DappPairingDataMap;
  selectedNetwork: NetworkName;
}

const STORAGE_KEY_PREFIX = 'appState';
export const [AppStateContextProvider, useAppState] = makeLocalStorageAppStateContext<AppState>(STORAGE_KEY_PREFIX, {
  icPairings: {},
  selectedNetwork: NetworkName.TESTNET,
});
