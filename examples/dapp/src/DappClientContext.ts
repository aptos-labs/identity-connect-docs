// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { DappPairingData, ICDappClient } from '@identity-connect/dapp-sdk';
import { useMemo } from 'react';
import { useAppState } from './AppStateContext.ts';
import makeContext from './utils/makeContext.tsx';

const { VITE_DAPP_ID, VITE_IC_BACKEND_URL, VITE_IC_FRONTEND_URL } = import.meta.env;

export const [DappClientContextProvider, useDappClient] = makeContext<ICDappClient>('DappClientContext', () => {
  const appState = useAppState();

  const selectedNetwork = appState.watch('selectedNetwork');
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

    if (VITE_DAPP_ID === undefined) {
      throw new Error('VITE_DAPP_ID env variable not provided');
    }

    return new ICDappClient(VITE_DAPP_ID, {
      accessors,
      axiosConfig: VITE_IC_BACKEND_URL ? { baseURL: VITE_IC_BACKEND_URL } : undefined,
      defaultNetworkName: appState.get('selectedNetwork'),
      frontendBaseURL: VITE_IC_FRONTEND_URL,
    });
  }, [appState, selectedNetwork]);
});
