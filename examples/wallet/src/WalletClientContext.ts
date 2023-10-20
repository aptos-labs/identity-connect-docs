// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { NetworkName } from '@identity-connect/api';
import { ICWalletClient, WalletConnectionData, WalletInfo } from '@identity-connect/wallet-sdk';
import { useMemo } from 'react';
import { useAppState } from './AppStateContext.ts';
import makeContext from './utils/makeContext.tsx';

const { VITE_IC_BACKEND_URL } = import.meta.env;
const walletInfo: WalletInfo = {
  deviceIdentifier: 'example-wallet',
  platform: 'chrome-extension',
  platformOS: 'osx',
  walletName: 'petra',
};

export const [WalletClientContextProvider, useWalletClient] = makeContext<ICWalletClient>('WalletClientContext', () => {
  const appState = useAppState();

  return useMemo(() => {
    const accessors = {
      get: async (walletId: string) => {
        const connections = appState.get('icWalletConnections');
        return connections[walletId];
      },
      getAll: async () => appState.get('icWalletConnections'),
      update: async (walletId: string, newValue?: WalletConnectionData) => {
        const connections = appState.get('icWalletConnections');
        if (newValue === undefined) {
          delete connections[walletId];
        } else {
          connections[walletId] = newValue;
        }
        appState.set('icWalletConnections', connections);
      },
    };

    return new ICWalletClient(walletInfo, accessors, {
      axiosConfig: VITE_IC_BACKEND_URL ? { baseURL: VITE_IC_BACKEND_URL } : undefined,
      defaultNetworkName: NetworkName.TESTNET,
    });
  }, [appState]);
});
