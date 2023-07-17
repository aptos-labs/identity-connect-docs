// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { WalletConnectionData } from '@identity-connect/wallet-sdk';
import { useRef } from 'react';
import useAsyncAction from '../utils/useAsyncAction.ts';
import { useWalletClient } from '../WalletClientContext.ts';
import AccountsList, { AccountsListHandle } from './AccountsList.tsx';
import './index.css';

export interface UpdateConnectionProps {
  connection: WalletConnectionData;
}

export default function UpdateConnection({ connection }: UpdateConnectionProps) {
  const accountsListRef = useRef<AccountsListHandle>(null);
  const walletClient = useWalletClient();

  const update = useAsyncAction(async () => {
    if (!accountsListRef.current) {
      return;
    }
    const actionRequests = accountsListRef.current.getActionRequests();
    await walletClient.updateAccounts(connection.walletId, actionRequests);
  });

  const initialConnectedAddresses = new Set(Object.keys(connection.accounts));

  return (
    <div>
      <AccountsList
        ref={accountsListRef}
        walletId={connection.walletId}
        initialConnectedAddresses={initialConnectedAddresses}
      />
      <button type="button" onClick={update.trigger} disabled={update.isLoading}>
        Update
      </button>
    </div>
  );
}
