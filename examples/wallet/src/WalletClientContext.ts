// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import ICWalletClient, { WalletConnectionData, WalletInfo } from '@identity-connect/wallet-sdk';
import { useMemo } from 'react';
import { useAppState } from './AppStateContext.ts';
import makeContext from './utils/makeContext.tsx';

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

    return new ICWalletClient(walletInfo, { accessors });
  }, [appState]);
});
