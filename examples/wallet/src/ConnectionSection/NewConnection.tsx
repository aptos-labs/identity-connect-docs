// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { useRef } from 'react';
import useAsyncAction from '../utils/useAsyncAction.ts';
import { useWalletClient } from '../WalletClientContext.ts';
import AccountsList, { AccountsListHandle } from './AccountsList.tsx';
import './index.css';

export interface NewConnectionProps {
  walletId: string;
}

export default function NewConnection({ walletId }: NewConnectionProps) {
  const accountsListRef = useRef<AccountsListHandle>(null);
  const walletClient = useWalletClient();

  const connect = useAsyncAction(async () => {
    if (!accountsListRef.current) {
      return;
    }
    const actionRequests = accountsListRef.current.getActionRequests();
    await walletClient.finalizeConnection(walletId, actionRequests);
  });

  return (
    <div>
      <AccountsList ref={accountsListRef} walletId={walletId} />
      <button type="button" onClick={connect.trigger} disabled={connect.isLoading}>
        Connect
      </button>
    </div>
  );
}
