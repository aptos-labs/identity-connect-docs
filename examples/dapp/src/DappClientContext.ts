// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import ICDappClient, { DappPairingData } from '@identity-connect/dapp-sdk';
import { useMemo } from 'react';
import { useAppState } from './AppStateContext.ts';
import makeContext from './utils/makeContext.tsx';

const { VITE_DAPP_ID } = import.meta.env;

export const [DappClientContextProvider, useDappClient] = makeContext<ICDappClient>('DappClientContext', () => {
  const appState = useAppState();

  return useMemo(() => {
    const accessors = {
      get: async (address: string) => {
        const pairings = appState.get('icPairings');
        return pairings[address];
      },
      getAll: async () => appState.get('icPairings'),
      update: async (address: string, newValue?: DappPairingData) => {
        const pairings = appState.get('icPairings');
        if (newValue === undefined) {
          delete pairings[address];
        } else {
          pairings[address] = newValue;
        }
        appState.set('icPairings', pairings);
      },
    };

    return new ICDappClient(VITE_DAPP_ID, { accessors });
  }, [appState]);
});
